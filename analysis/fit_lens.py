"""Fit Anthropic's averaged Jacobian lens on balanced DeCodon CDS prompts."""

from __future__ import annotations

import argparse
import json
from datetime import datetime, timezone
from pathlib import Path

import torch
import transformers
from jlens import fit

from analysis.decodon_lens_model import load_lens_model
from analysis.download_model import JLENS_REVISION, MODEL_REPO, MODEL_REVISION


def load_prompts(path: str | Path, limit: int | None) -> list[str]:
    prompts = [
        json.loads(line)["prompt"]
        for line in Path(path).read_text().splitlines()
        if line.strip()
    ]
    return prompts if limit is None else prompts[:limit]


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--model-dir", default="decodon_model")
    parser.add_argument("--corpus", default="analysis/artifacts/corpus.jsonl")
    parser.add_argument("--output", default="analysis/artifacts/decodon_jlens.pt")
    parser.add_argument("--checkpoint", default="analysis/artifacts/decodon_jlens.ckpt")
    parser.add_argument("--manifest", default="analysis/lens_fit_manifest.json")
    parser.add_argument("--device", default="cpu")
    parser.add_argument("--max-prompts", type=int)
    parser.add_argument("--dim-batch", type=int, default=4)
    parser.add_argument("--max-seq-len", type=int, default=128)
    parser.add_argument("--skip-first", type=int, default=3)
    parser.add_argument(
        "--source-layers",
        default="0,1,2,3,4,5,6,7,8,9,10",
        help="Zero-indexed decoder block outputs; target defaults to block 11.",
    )
    args = parser.parse_args()

    prompts = load_prompts(args.corpus, args.max_prompts)
    if not prompts:
        raise RuntimeError("No fitting prompts found")
    source_layers = [int(value) for value in args.source_layers.split(",") if value]
    model = load_lens_model(args.model_dir, device=args.device)
    if max(source_layers) >= model.n_layers - 1:
        raise ValueError("Source layers must precede the final target block")

    lens = fit(
        model,
        prompts,
        source_layers=source_layers,
        target_layer=model.n_layers - 1,
        dim_batch=args.dim_batch,
        max_seq_len=args.max_seq_len,
        skip_first=args.skip_first,
        checkpoint_path=args.checkpoint,
        checkpoint_every=1,
        resume=True,
    )
    lens.save(args.output, dtype=torch.float16)

    manifest = {
        "schema_version": "codoscope/lens-fit-1.0",
        "status": "fitted",
        "generated_at": datetime.now(timezone.utc).isoformat(),
        "method": "averaged_future_position_jacobian",
        "model_repo": MODEL_REPO,
        "model_revision": MODEL_REVISION,
        "jlens_revision": JLENS_REVISION,
        "n_prompts": lens.n_prompts,
        "source_layers": lens.source_layers,
        "target_layer": model.n_layers - 1,
        "d_model": lens.d_model,
        "dim_batch": args.dim_batch,
        "max_seq_len": args.max_seq_len,
        "skip_first": args.skip_first,
        "runtime": {
            "python": __import__("sys").version.split()[0],
            "torch": torch.__version__,
            "transformers": transformers.__version__,
            "layer_norm": "native DeCodon modules with configured eps=1e-12",
        },
        "split": {
            "fitting_records": f"first {lens.n_prompts} records",
            "held_out_records": "remaining corpus records",
        },
        "corpus_manifest": "analysis/corpus_manifest.json",
        "artifact": args.output,
    }
    Path(args.manifest).write_text(json.dumps(manifest, indent=2) + "\n")
    print(lens)


if __name__ == "__main__":
    main()
