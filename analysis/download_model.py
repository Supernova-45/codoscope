"""Download and verify the exact DeCodon checkpoint used by Codoscope."""

from __future__ import annotations

import argparse
import hashlib
import json
from datetime import datetime, timezone
from pathlib import Path

from huggingface_hub import snapshot_download

MODEL_REPO = "goodarzilab/decodon-200M"
MODEL_REVISION = "5c5c3da137dec756245b4cf65b8ff5bfd285d8f4"
JLENS_REVISION = "581d398613e5602a5af361e1c34d3a92ea82ba8e"
REQUIRED_FILES = (
    "config.json",
    "configuration_decodon.py",
    "model.safetensors",
    "modeling_decodon.py",
    "tokenization_decodon.py",
    "tokenizer_config.json",
    "vocab.json",
)


def sha256(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as file:
        for chunk in iter(lambda: file.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--model-dir", default="decodon_model")
    parser.add_argument(
        "--manifest",
        default="analysis/model_manifest.json",
        help="Small provenance manifest to commit; model files remain ignored.",
    )
    args = parser.parse_args()

    model_dir = Path(
        snapshot_download(
            repo_id=MODEL_REPO,
            revision=MODEL_REVISION,
            local_dir=args.model_dir,
        )
    )
    missing = [name for name in REQUIRED_FILES if not (model_dir / name).is_file()]
    if missing:
        raise RuntimeError(f"Incomplete model download; missing {missing}")

    files = {
        name: {
            "bytes": (model_dir / name).stat().st_size,
            "sha256": sha256(model_dir / name),
        }
        for name in REQUIRED_FILES
    }
    manifest = {
        "schema_version": "codoscope/model-manifest-1.0",
        "model_repo": MODEL_REPO,
        "model_revision": MODEL_REVISION,
        "jlens_revision": JLENS_REVISION,
        "runtime_required": {
            "transformers": "4.44.2",
            "torch": "2.13.0",
            "reason": "Newer Transformers produced non-finite DeCodon activations.",
        },
        "generated_at": datetime.now(timezone.utc).isoformat(),
        "files": files,
    }
    output = Path(args.manifest)
    output.parent.mkdir(parents=True, exist_ok=True)
    output.write_text(json.dumps(manifest, indent=2) + "\n")
    print(output)


if __name__ == "__main__":
    main()
