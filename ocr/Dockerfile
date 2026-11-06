# ═══════════════════════════════════════════════════════════
# OCR Surat Service — Python + torch CPU + PaddleOCR + LayoutLMv3
# Model TIDAK ikut image; di-mount dari host (lihat docker-compose.yml)
# ═══════════════════════════════════════════════════════════
FROM python:3.11-slim

RUN apt-get update && apt-get install -y --no-install-recommends \
        libgl1 \
        libglib2.0-0 \
        curl \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY requirements.txt .
# Install torch CPU dulu via index pytorch.org: di Linux, torch PyPI = build CUDA
# yang menarik ~1,4 GB paket nvidia-* (cudnn, cublas, nccl, ...) yang tak dipakai
# service CPU-only ini. Pin `torch==2.13.0` di requirements.txt tetap puas oleh
# 2.13.0+cpu (PEP 440), jadi langkah kedua skip torch dan install sisanya.
RUN pip install --no-cache-dir --index-url https://download.pytorch.org/whl/cpu \
        torch==2.13.0 torchvision==0.28.0 torchaudio==2.11.0 \
    && pip install --no-cache-dir -r requirements.txt

COPY predict.py serve.py ./

ENV PYTHONUNBUFFERED=1 \
    PORT=8000 \
    MODEL_DIR=/models/current

EXPOSE 8000

HEALTHCHECK --interval=30s --timeout=5s --retries=3 --start-period=180s \
    CMD curl -fsS http://127.0.0.1:8000/health || exit 1

CMD ["python", "serve.py"]
