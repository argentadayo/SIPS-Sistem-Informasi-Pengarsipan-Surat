"""HTTP service wrapper around predict.py for Docker deployment.

Loads PaddleOCR + LayoutLMv3 once at startup (from MODEL_DIR), then answers:
  POST /predict  multipart file=image -> {"fields": {...}, "words": N}
  GET  /health                         -> {"status": "ok", "model_dir": ..., "device": ...}

Update model di VPS: flip symlink /models/current lalu `docker compose restart ocr`.
"""

from __future__ import annotations

import io
import logging
import os
import threading
from contextlib import asynccontextmanager
from typing import Any

import numpy as np
import torch
from fastapi import FastAPI, File, HTTPException, UploadFile
from PIL import Image
from paddleocr import PaddleOCR
from transformers import AutoModelForTokenClassification, AutoProcessor

from predict import MODEL_DIR, extract_ocr, predict_fields

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(message)s")
log = logging.getLogger("ocr-service")

MAX_IMAGE_BYTES = int(os.environ.get("OCR_MAX_IMAGE_BYTES", str(20 * 1024 * 1024)))
LANG = os.environ.get("OCR_LANG", "id")

_lock = threading.Lock()
_state: dict[str, Any] = {}


@asynccontextmanager
async def lifespan(_: FastAPI):
    log.info("Loading PaddleOCR (lang=%s)...", LANG)
    _state["ocr"] = PaddleOCR(lang=LANG, use_gpu=False, show_log=False)
    log.info("Loading LayoutLMv3 from %s ...", MODEL_DIR)
    processor = AutoProcessor.from_pretrained(MODEL_DIR)
    model = AutoModelForTokenClassification.from_pretrained(MODEL_DIR)
    device = torch.device("cuda" if torch.cuda.is_available() else "cpu")
    _state["processor"] = processor
    _state["model"] = model.to(device).eval()
    _state["device"] = device
    log.info("Ready on device=%s", device)
    yield
    _state.clear()


app = FastAPI(title="OCR Surat Service", lifespan=lifespan)


@app.get("/health")
def health() -> dict[str, Any]:
    return {
        "status": "ok" if _state else "loading",
        "model_dir": str(MODEL_DIR),
        "device": str(_state.get("device", "")),
    }


@app.post("/predict")
def predict(file: UploadFile = File(...)) -> dict[str, Any]:
    if not _state:
        raise HTTPException(status_code=503, detail="Model masih loading")
    raw = file.file.read(MAX_IMAGE_BYTES + 1)
    if len(raw) > MAX_IMAGE_BYTES:
        raise HTTPException(status_code=413, detail=f"Image melebihi {MAX_IMAGE_BYTES // (1024 * 1024)} MB")
    try:
        image = Image.open(io.BytesIO(raw)).convert("RGB")
    except Exception as exc:  # noqa: BLE001
        raise HTTPException(status_code=400, detail=f"File bukan gambar yang valid: {exc}") from exc

    width, height = image.size
    words, boxes = extract_ocr(_state["ocr"].ocr(np.asarray(image), cls=True), width, height)
    if not words:
        return {"fields": {}, "words": 0}

    # PaddleOCR + torch inference sama-sama CPU-bound; serialkan supaya tidak berebut RAM/CPU VPS
    with _lock:
        fields = predict_fields(
            image, words, boxes, _state["processor"], _state["model"], _state["device"]
        )
    log.info("Predicted %d words -> %s", len(words), fields)
    return {"fields": fields, "words": len(words)}


if __name__ == "__main__":
    import uvicorn

    uvicorn.run(app, host="0.0.0.0", port=int(os.environ.get("PORT", "8000")))
