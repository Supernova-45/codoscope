# The JSON contract (frozen)

The frontend and the model backend talk through **one JSON document per sequence**. Freeze this before writing either side; the frontend is built against the fixture (`data/atlas_fixture.json`) with no model in the loop, and the backend's only job is to emit documents that validate against this shape.

A real, working example is in `data/atlas_fixture.json` — one 60-codon *E. coli* gene run under three organisms by the actual DeCodon-200M model. Open it alongside this spec.

## Top-level document

```jsonc
{
  "schema_version": "biojspace/decodon-1.0",
  "model": { "name": "DeCodon-200M", "repo": "goodarzilab/decodon-200M",
             "type": "autoregressive_codon_lm", "n_layers": 12, "hidden_size": 1024 },
  "sequence_id": "ecoli_demo_gene",
  "organism_default": "E. coli (562)",
  "organisms": ["E. coli (562)", "B. subtilis (1423)", "P. aeruginosa (287)"],
  "tokens": [ /* organism-independent per-position facts, see below */ ],
  "per_organism": { "<organism label>": [ /* per-position readouts */ ] },
  "concept_layers": { /* layer-resolved probe scores, see below */ }
}
```

### `tokens[]` — organism-independent, one per codon position

```jsonc
{ "pos": 0, "codon": "ATG", "aa": "M", "aa3": "Met", "frame": 0 }
```

These are the x-axis of the atlas: the input coding sequence. `frame` is reserved (always 0 for a single CDS; used if you later show alternate reading frames).

### `per_organism[label][]` — the readouts that change with the taxid

One entry per position, **same length and order as `tokens`**:

```jsonc
{
  "pos": 37,
  "predicted_aa": "Ala",            // model's argmax amino acid at this position (optional)
  "true_aa": "Ala", "true_codon": "GCG",
  "aa_readout": [                    // amino-acid probability marginal
      {"label": "Ala", "kind": "aa_mean", "score": 0.71},
      {"label": "Gly", "kind": "aa_mean", "score": 0.11}, ...],
  "synonym_readout": [              // codon probability conditioned on the OBSERVED aa family
      {"label": "GCG", "kind": "codon", "score": 0.6561},
      {"label": "GCC", "kind": "codon", "score": 0.1287}, ...],
  "aa_confidence": 0.66,           // mass the model puts on the correct amino acid (0..1)
  "synonym_entropy": 0.42          // 0 = model committed to one synonym, 1 = flat across the family
}
```

**The two-part readout is the whole point of using a codon model** (see `docs/01_concept.md`): `aa_readout` is the codon-softmax probability mass marginalized by amino-acid family; `synonym_readout` is the within-observed-family conditional distribution. These are probabilities, not vector directions or subtraction residuals. The observed amino acid encoded by the fixed input stays constant; the model's predicted amino-acid distribution may change with taxid.

### The `label` + `kind` rule (do not violate)

Every readout entry is an object with **both** `label` and `kind` — never a bare string. `kind` is a closed enum that tells the frontend how to render and color the chip:

| `kind` | meaning | source |
|---|---|---|
| `aa_mean` | amino-acid probability marginal (legacy enum name) | codon-only DeCodon softmax, marginalized over synonyms |
| `codon` | conditional synonymous-codon probability | codon-only DeCodon softmax, conditioned on observed AA |
| `derived` | any computed scalar track (GC3, entropy) | adapter post-processing |
| `sae` | sparse-autoencoder feature (optional Tier-2 panel) | a trained SAE, if you add one |
| `phenotype` | a named functional head (optional) | NVIDIA -TE- checkpoints, if used |

Freezing `kind` as an enum is what lets you add an SAE panel later without touching the frontend's core render path — a new `kind` is a new chip style, not a new document shape.

### `concept_layers` — the layer axis (global, not per-position)

This is the measured depth-of-concept data from `evidence/DeCodon_concept_sweep.csv`, embedded so the frontend can render the **layer axis** honestly:

```jsonc
"concept_layers": {
  "layers": [0,1,...,12],
  "concepts": {
    "amino_acid_identity": {"kind":"clf","baseline":0.105,"scores":[...13 values...]},
    "organism_taxid":       {"kind":"clf","baseline":0.333,"scores":[...]},
    "rel_position_in_CDS":  {"kind":"reg","baseline":0.0,  "scores":[...]},
    ...
  }
}
```

The frontend uses this to draw the vertical "which biology resolves at which depth" story (organism at the bottom, position in the middle, amino acid at the top). See `docs/03_implementation.md` §Layer-axis.

### `lens` — optional measured layer×position readout (v1.1)

Documents with measured intermediate readouts may include a `lens` object:

```jsonc
"lens": {
  "method": "logit_lens" | "jacobian_lens",
  "status": "baseline" | "validated" | "development",
  "layers": [0, 1, ..., 12],
  "top_k": 8,
  "model_revision": "<immutable commit>",
  "lens_revision": "<immutable jlens commit>",
  "score_units": "probability",
  "normalization": "softmax restricted to the 64 codon output tokens",
  "source_position": "same autoregressive prediction position",
  "target_positions": "current only, or averaged current-and-future",
  "fit": {
    "corpus_manifest": "analysis/corpus_manifest.json",
    "n_sequences": 100,
    "skip_first": 3
  },
  "per_organism": {
    "<label>": [
      {
        "pos": 0,
        "layers": [
          {
            "layer": 1,
            "pos": 0,
            "aa_readout": [{"label":"Met","kind":"aa_mean","score":0.9,"rank":1}],
            "codon_readout": [{"label":"ATG","kind":"codon","score":0.8,"rank":1}]
          }
        ]
      }
    ]
  },
  "rank_tracks": {
    "<label>": {
      "ATG": [[1, 1, 1] /* layers for position 0 */, ...]
    }
  }
}
```

`logit_lens` means DeCodon's nonlinear LM head was applied directly to each hidden layer; it is a baseline, not Jacobian transport. `jacobian_lens` is allowed only when the residual was transported with a fitted averaged Jacobian and the held-out gates in `analysis/validate_lens.py` passed. Scores are codon-restricted probabilities; ranks are over all 64 codons. `rank_tracks` keeps pinning interactive without shipping all 64 probability objects in every cell.

## Versioning

`schema_version` is `biojspace/<model>-<major>.<minor>`. Adding an optional field → bump minor. Changing/removing a field or a `kind` enum value → bump major and update both sides. The frontend must ignore unknown optional fields (forward-compatible) and hard-fail on a major mismatch.
