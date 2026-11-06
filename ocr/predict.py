"""Run the trained LayoutLMv3 BIO model on a JPG/PNG document image."""

from __future__ import annotations

import argparse
import json
import os
from pathlib import Path
from typing import Any

os.environ["PATH"] = ";".join(
    p for p in os.environ.get("PATH", "").split(";") if "msys64" not in p.lower()
)

import numpy as np
import torch
from PIL import Image
from paddleocr import PaddleOCR
from transformers import AutoModelForTokenClassification, AutoProcessor


ROOT = Path(__file__).resolve().parent.parent
MODEL_DIR = Path(os.environ.get("MODEL_DIR", ROOT / "layoutlmv3-bio-model"))


def normalize_box(box: list[float], width: int, height: int) -> list[int]:
    """Convert pixel coordinates to LayoutLM's 0..1000 coordinate space."""
    x_values = box[0::2]
    y_values = box[1::2]
    return [
        max(0, min(1000, round(min(x_values) * 1000 / width))),
        max(0, min(1000, round(min(y_values) * 1000 / height))),
        max(0, min(1000, round(max(x_values) * 1000 / width))),
        max(0, min(1000, round(max(y_values) * 1000 / height))),
    ]


def extract_ocr(result: Any, width: int, height: int) -> tuple[list[str], list[list[int]]]:
    """Read the common PaddleOCR 2.x nested result format."""
    if not result:
        return [], []

    lines = result[0] if isinstance(result, list) and len(result) == 1 else result
    words: list[str] = []
    boxes: list[list[int]] = []
    for line in lines or []:
        if isinstance(line, dict):
            text = line.get("rec_texts", line.get("text", ""))
            box = line.get("dt_polys", line.get("box", []))
            if isinstance(text, list):
                for item_text, item_box in zip(text, box):
                    words.append(str(item_text).strip())
                    boxes.append(normalize_box(np.asarray(item_box).reshape(-1).tolist(), width, height))
            else:
                words.append(str(text).strip())
                boxes.append(normalize_box(np.asarray(box).reshape(-1).tolist(), width, height))
            continue

        if not isinstance(line, (list, tuple)) or len(line) < 2:
            continue
        polygon, recognition = line[0], line[1]
        text = recognition[0] if isinstance(recognition, (list, tuple)) else recognition
        text = str(text).strip()
        if text:
            words.append(text)
            boxes.append(normalize_box(np.asarray(polygon).reshape(-1).tolist(), width, height))
    return words, boxes


def decode_bio(words: list[str], labels: list[str]) -> dict[str, str]:
    """Merge word-level BIO labels into field values."""
    entities: dict[str, list[str]] = {}
    current_type: str | None = None
    current_words: list[str] = []

    def flush() -> None:
        nonlocal current_type, current_words
        if current_type and current_words:
            entities.setdefault(current_type, []).append(" ".join(current_words))
        current_type = None
        current_words = []

    for word, label in zip(words, labels):
        if label == "O" or "-" not in label:
            flush()
            continue
        prefix, entity_type = label.split("-", 1)
        if prefix == "B" or entity_type != current_type:
            flush()
            current_type = entity_type
        current_words.append(word)
    flush()

    output = {}
    for entity_type, values in entities.items():
        output[entity_type.lower()] = " ".join(values)
    return output


def predict_fields(
    image: Image.Image,
    words: list[str],
    boxes: list[list[int]],
    processor: Any,
    model: Any,
    device: torch.device,
) -> dict[str, str]:
    """Run LayoutLMv3 over OCR words and decode BIO labels into field values."""
    encoded = processor(
        images=image,
        text=words,
        boxes=boxes,
        return_tensors="pt",
        truncation=True,
        padding="longest",
        max_length=512,
    )
    model_inputs = {key: value.to(device) for key, value in encoded.items() if hasattr(value, "to")}
    with torch.inference_mode():
        predictions = model(**model_inputs).logits.argmax(-1)[0].cpu().tolist()

    word_ids = encoded.word_ids(batch_index=0)
    word_labels: dict[int, str] = {}
    for token_index, word_id in enumerate(word_ids):
        if word_id is not None and word_id not in word_labels:
            word_labels[word_id] = model.config.id2label[int(predictions[token_index])]

    labels = [word_labels.get(index, "O") for index in range(len(words))]
    return decode_bio(words, labels)


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("image", type=Path, help="Path to a JPG/PNG surat image")
    parser.add_argument("--lang", default="id", help="PaddleOCR language (default: id)")
    parser.add_argument("--cpu", action="store_true", help="Force CPU inference")
    args = parser.parse_args()

    image_path = args.image.expanduser().resolve()
    if not image_path.is_file():
        raise SystemExit(f"Image not found: {image_path}")

    image = Image.open(image_path).convert("RGB")
    width, height = image.size
    print("Loading PaddleOCR...", flush=True)
    ocr = PaddleOCR(lang=args.lang, use_gpu=False, show_log=False)
    words, boxes = extract_ocr(ocr.ocr(np.asarray(image), cls=True), width, height)
    if not words:
        raise SystemExit("PaddleOCR tidak menemukan teks pada gambar.")

    print(f"OCR menemukan {len(words)} kata.", flush=True)
    processor = AutoProcessor.from_pretrained(MODEL_DIR)
    model = AutoModelForTokenClassification.from_pretrained(MODEL_DIR)
    device = torch.device("cpu" if args.cpu or not torch.cuda.is_available() else "cuda")
    model.to(device).eval()

    print(json.dumps(predict_fields(image, words, boxes, processor, model, device), ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()
