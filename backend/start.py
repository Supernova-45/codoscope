"""Download DeCodon when needed, then start the production API."""

from __future__ import annotations

import os
import sys
import hashlib
import json
from pathlib import Path

from huggingface_hub import snapshot_download

MODEL_REPO = os.environ.get("DECODON_MODEL_REPO", "goodarzilab/decodon-200M")
MODEL_DIR = Path(os.environ.get("DECODON_MODEL_DIR", "/models/decodon"))
MODEL_REVISION = os.environ.get(
    "DECODON_MODEL_REVISION",
    "5c5c3da137dec756245b4cf65b8ff5bfd285d8f4",
)
MODEL_SHA256 = "54744307bb9215d44a912f5a571ba8b36954c0685849331575d69e6387d7ebd2"
REQUIRED_FILES = (
    "config.json",
    "configuration_decodon.py",
    "model.safetensors",
    "modeling_decodon.py",
    "tokenization_decodon.py",
    "tokenizer_config.json",
    "vocab.json",
)
COMPLETE_MARKER = ".codoscope-model-complete.json"


def _sha256(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as file:
        for chunk in iter(lambda: file.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def model_is_complete() -> bool:
    marker = MODEL_DIR / COMPLETE_MARKER
    if not marker.is_file() or any(
        not (MODEL_DIR / name).is_file() for name in REQUIRED_FILES
    ):
        return False
    try:
        metadata = json.loads(marker.read_text())
    except (OSError, json.JSONDecodeError):
        return False
    return (
        metadata.get("revision") == MODEL_REVISION
        and metadata.get("model_sha256") == MODEL_SHA256
    )


def ensure_model() -> None:
    if model_is_complete():
        return
    if os.environ.get("DOWNLOAD_MODEL", "1") != "1":
        raise RuntimeError(
            f"DeCodon is missing at {MODEL_DIR} and DOWNLOAD_MODEL is disabled"
        )

    MODEL_DIR.mkdir(parents=True, exist_ok=True)
    snapshot_download(
        repo_id=MODEL_REPO,
        revision=MODEL_REVISION,
        local_dir=MODEL_DIR,
    )
    missing = [name for name in REQUIRED_FILES if not (MODEL_DIR / name).is_file()]
    if missing:
        raise RuntimeError(f"Incomplete DeCodon download; missing {missing}")
    actual_sha256 = _sha256(MODEL_DIR / "model.safetensors")
    if actual_sha256 != MODEL_SHA256:
        raise RuntimeError(
            "DeCodon model checksum mismatch: "
            f"expected {MODEL_SHA256}, found {actual_sha256}"
        )
    marker = MODEL_DIR / COMPLETE_MARKER
    temporary = marker.with_suffix(".tmp")
    temporary.write_text(json.dumps({
        "repo": MODEL_REPO,
        "revision": MODEL_REVISION,
        "model_sha256": MODEL_SHA256,
    }))
    temporary.replace(marker)


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
