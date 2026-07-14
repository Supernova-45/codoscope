"""Download DeCodon when needed, then start the production API."""

from __future__ import annotations

import os
import sys
from pathlib import Path

from huggingface_hub import snapshot_download

MODEL_REPO = os.environ.get("DECODON_MODEL_REPO", "goodarzilab/decodon-200M")
MODEL_DIR = Path(os.environ.get("DECODON_MODEL_DIR", "/models/decodon"))


def ensure_model() -> None:
    required = (MODEL_DIR / "vocab.json", MODEL_DIR / "config.json")
    if all(path.exists() for path in required):
        return
    if os.environ.get("DOWNLOAD_MODEL", "1") != "1":
        raise RuntimeError(
            f"DeCodon is missing at {MODEL_DIR} and DOWNLOAD_MODEL is disabled"
        )

    MODEL_DIR.mkdir(parents=True, exist_ok=True)
    snapshot_download(
        repo_id=MODEL_REPO,
        local_dir=MODEL_DIR,
    )


def main() -> None:
    ensure_model()
    port = os.environ.get("PORT", "8000")
    os.execvp(
        "uvicorn",
        [
            "uvicorn",
            "backend.main:app",
            "--host",
            "0.0.0.0",
            "--port",
            port,
            "--workers",
            "1",
            "--proxy-headers",
        ],
    )


if __name__ == "__main__":
    try:
        main()
    except Exception as error:
        print(f"Codoscope startup failed: {error}", file=sys.stderr)
        raise
