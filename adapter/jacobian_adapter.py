"""Attach a validated prefit Jacobian lens to an atlas document at inference."""

from __future__ import annotations

import json
from pathlib import Path

import torch

try:
    from .decodon_adapter import run_sequence
except ImportError:  # backend adds adapter/ directly to sys.path
    from decodon_adapter import run_sequence

MODEL_REVISION = "5c5c3da137dec756245b4cf65b8ff5bfd285d8f4"
JLENS_REVISION = "581d398613e5602a5af361e1c34d3a92ea82ba8e"


class RuntimeJacobianLens:
    def __init__(
        self,
        artifact_path: str | Path,
        validation_path: str | Path,
        *,
        top_k: int = 8,
    ):
        validation = json.loads(Path(validation_path).read_text())
        if validation.get("status") != "passed":
            raise RuntimeError("Jacobian lens validation gates did not pass")
        checkpoint = torch.load(
            artifact_path,
            map_location="cpu",
            weights_only=True,
        )
        self.jacobians = {
            int(layer): matrix.float()
            for layer, matrix in checkpoint["J"].items()
        }
        self.source_layers = sorted(self.jacobians)
        self.n_prompts = int(checkpoint["n_prompts"])
        self.d_model = int(checkpoint["d_model"])
        self.top_k = top_k


def _entries(labels, probabilities, kind, top_k):
    order = torch.argsort(probabilities, descending=True).tolist()
    return [
        {
            "label": labels[index],
            "kind": kind,
            "score": round(float(probabilities[index]), 6),
            "rank": rank,
        }
        for rank, index in enumerate(order[:top_k], start=1)
    ], order


@torch.inference_mode()
def attach_jacobian_lens(
    document,
    model,
    vocab,
    code,
    codon_list,
    organisms,
    lens: RuntimeJacobianLens,
):
    """Mutate and return ``document`` with compact layer readouts and ranks."""
    codons = sorted(
        token for token in vocab
        if len(token) == 3 and set(token) <= set("ACGT")
    )
    device = next(model.parameters()).device
    columns = torch.tensor([vocab[codon] for codon in codons], device=device)
    amino_acids = sorted(set(code.values()))
    aa3 = {
        "A": "Ala", "R": "Arg", "N": "Asn", "D": "Asp", "C": "Cys",
        "E": "Glu", "Q": "Gln", "G": "Gly", "H": "His", "I": "Ile",
        "L": "Leu", "K": "Lys", "M": "Met", "F": "Phe", "P": "Pro",
        "S": "Ser", "T": "Thr", "W": "Trp", "Y": "Tyr", "V": "Val",
        "*": "Stop",
    }
    aa_indices = {
        aa: [index for index, codon in enumerate(codons) if code[codon] == aa]
        for aa in amino_acids
    }
    display_layers = [layer + 1 for layer in lens.source_layers] + [
        int(model.config.num_hidden_layers)
    ]
    per_organism = {}
    rank_tracks = {}

    for label, taxid in organisms.items():
        _, hidden_states = run_sequence(
            model,
            vocab,
            code,
            codon_list,
            taxid,
            layers=lens.source_layers,
        )
        if hidden_states is None:
            raise RuntimeError("DeCodon did not return hidden states")
        positions = [{"pos": pos, "layers": []} for pos in range(len(codon_list))]
        tracks = {
            codon: [[0 for _ in display_layers] for _ in codon_list]
            for codon in codons
        }
        logits_by_layer = []
        for source_layer in lens.source_layers:
            residual = hidden_states[source_layer + 1][
                0, 1 : 1 + len(codon_list)
            ].float()
            transported = residual @ lens.jacobians[source_layer].to(residual.device).T
            logits_by_layer.append(model.lm_head(transported))
        final_residual = hidden_states[-1][0, 1 : 1 + len(codon_list)]
        logits_by_layer.append(model.lm_head(final_residual))

        for layer_index, (display_layer, logits) in enumerate(
            zip(display_layers, logits_by_layer, strict=True)
        ):
            probabilities_by_position = torch.softmax(
                logits.index_select(-1, columns).float(),
                dim=-1,
            ).cpu()
            for position, probabilities in enumerate(probabilities_by_position):
                aa_probabilities = torch.tensor([
                    float(probabilities[aa_indices[aa]].sum())
                    for aa in amino_acids
                ])
                aa_entries, _ = _entries(
                    [aa3[aa] for aa in amino_acids],
                    aa_probabilities,
                    "aa_mean",
                    min(5, len(amino_acids)),
                )
                codon_entries, order = _entries(
                    codons,
                    probabilities,
                    "codon",
                    min(lens.top_k, len(codons)),
                )
                positions[position]["layers"].append({
                    "layer": display_layer,
                    "pos": position,
                    "aa_readout": aa_entries,
                    "codon_readout": codon_entries,
                })
                for rank, codon_index in enumerate(order, start=1):
                    tracks[codons[codon_index]][position][layer_index] = rank
        per_organism[label] = positions
        rank_tracks[label] = tracks

    document["schema_version"] = "biojspace/decodon-1.1"
    document["lens"] = {
        "method": "jacobian_lens",
        "status": "validated",
        "layers": display_layers,
        "top_k": lens.top_k,
        "model_revision": MODEL_REVISION,
        "lens_revision": JLENS_REVISION,
        "score_units": "probability",
        "normalization": "softmax restricted to the 64 codon output tokens",
        "source_position": "same autoregressive prediction position",
        "target_positions": "averaged over current and future positions in fitting corpus",
        "fit": {
            "corpus_manifest": "analysis/corpus_manifest.json",
            "n_sequences": lens.n_prompts,
            "skip_first": 3,
        },
        "per_organism": per_organism,
        "rank_tracks": rank_tracks,
    }
    return document
