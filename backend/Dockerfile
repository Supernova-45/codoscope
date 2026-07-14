FROM python:3.12-slim

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PIP_NO_CACHE_DIR=1 \
    DECODON_MODEL_DIR=/models/decodon \
    PRELOAD_MODEL=1

WORKDIR /app

COPY backend/requirements.txt /tmp/requirements.txt
RUN pip install --index-url https://download.pytorch.org/whl/cpu torch==2.13.0 \
    && pip install -r /tmp/requirements.txt

COPY adapter ./adapter
COPY backend ./backend
COPY data/concept_layers.json ./data/concept_layers.json
COPY data/organisms.json ./data/organisms.json

RUN useradd --create-home --uid 10001 codoscope \
    && mkdir -p /models \
    && chown -R codoscope:codoscope /app /models

USER codoscope
EXPOSE 8000

HEALTHCHECK --interval=30s --timeout=5s --start-period=5m --retries=3 \
  CMD python -c "import urllib.request; urllib.request.urlopen('http://127.0.0.1:8000/api/health', timeout=4)"

CMD ["python", "-m", "backend.start"]
