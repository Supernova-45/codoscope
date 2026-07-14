"""Adapter from DeCodon's custom decoder to Anthropic's ``jlens`` protocol."""

from __future__ import annotations

import sys
from pathlib import Path
from typing import Any, Sequence

import torch
from torch import nn
from transformers import AutoTokenizer

ROOT = Path(__file__).resolve().parent.parent
SHIMS = ROOT / "adapter" / "shims"
if str(SHIMS) not in sys.path:
    sys.path.insert(0, str(SHIMS))
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

from adapter.decodon_adapter import load_decodon  # noqa: E402


class DeCodonLensModel:
    """The model surface required by ``jlens.fit`` and ``JacobianLens.apply``.

    Prompts use ``<taxid>ATG...``. The tokenizer adds ``<CLS>`` and ``<SEP>``,
    producing the same ``[CLS, taxid, codons..., SEP]`` layout as the validated
    adapter. Residual hooks attach to decoder block outputs. DeCodon's
    distilled LM head contains its own transform and normalization, so
    :meth:`unembed` applies that head directly.
    """

    def __init__(self, model: nn.Module, tokenizer: Any, vocab: dict[str, int]):
        self.model = model.eval()
        self.tokenizer = tokenizer
        self.vocab = vocab
        self.layers: Sequence[nn.Module] = model.gpt.decoder.blocks
        self.n_layers = int(model.config.num_hidden_layers)
        self.d_model = int(model.config.hidden_size)

        if len(self.layers) != self.n_layers:
            raise ValueError(
                f"Config declares {self.n_layers} blocks, found {len(self.layers)}"
            )
        for parameter in self.model.parameters():
            parameter.requires_grad_(False)

    @property
    def input_device(self) -> torch.device:
        return self.model.get_input_embeddings().weight.device

    def encode(self, text: str, *, max_length: int = 512) -> torch.Tensor:
        encoded = self.tokenizer(
            text,
            return_tensors="pt",
            truncation=True,
            max_length=max_length,
            add_special_tokens=True,
        )
        return encoded.input_ids.to(self.input_device)

    def forward(self, input_ids: torch.Tensor) -> Any:
        return self.model.gpt(
            input_ids=input_ids,
            token_type_ids=torch.zeros_like(input_ids),
            use_cache=False,
            output_hidden_states=False,
            return_dict=True,
        )

    def unembed(self, residual: torch.Tensor) -> torch.Tensor:
        head_parameter = next(self.model.lm_head.parameters())
        return self.model.lm_head(
            residual.to(device=head_parameter.device, dtype=head_parameter.dtype)
        )

    def codon_token_ids(self) -> dict[str, int]:
        return {
            token: token_id
            for token, token_id in self.vocab.items()
            if len(token) == 3 and set(token) <= set("ACGT")
        }


def load_lens_model(
    model_dir: str | Path,
    *,
    device: str | torch.device = "cpu",
) -> DeCodonLensModel:
    """Load the validated model and matching custom tokenizer."""
    model_dir = Path(model_dir)
    model, vocab = load_decodon(str(model_dir), device=str(device))
    tokenizer = AutoTokenizer.from_pretrained(
        str(model_dir),
        trust_remote_code=True,
    )
    return DeCodonLensModel(model, tokenizer, vocab)


def prompt_from_codons(taxid: int, codons: Sequence[str]) -> str:
    """Serialize a clean CDS into DeCodon's taxid-conditioned prompt format."""
    return f"<{taxid}>{''.join(codons)}"
