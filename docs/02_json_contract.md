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
  "aa_readout": [                    // AMINO-ACID-MEAN component: which AA the model expects next
      {"label": "Ala", "kind": "aa_mean", "score": 0.71},
      {"label": "Gly", "kind": "aa_mean", "score": 0.11}, ...],
  "synonym_readout": [              // SYNONYMOUS-RESIDUAL component, conditioned on the TRUE aa family
      {"label": "GCG", "kind": "codon", "score": 0.6561},
      {"label": "GCC", "kind": "codon", "score": 0.1287}, ...],
  "aa_confidence": 0.66,           // mass the model puts on the correct amino acid (0..1)
  "synonym_entropy": 0.42          // 0 = model committed to one synonym, 1 = flat across the family
}
```

**The two-part readout is the whole point of using a codon model** (see `docs/01_concept.md`): every position decomposes into *what protein* (`aa_readout`, the amino-acid-mean direction — high signal, coding-driven) and *whose dialect* (`synonym_readout`, the synonymous-residual direction — the organism-specific part that moves when you switch the taxid).

### The `label` + `kind` rule (do not violate)

Every readout entry is an object with **both** `label` and `kind` — never a bare string. `kind` is a closed enum that tells the frontend how to render and color the chip:

| `kind` | meaning | source |
|---|---|---|
| `aa_mean` | amino-acid-mean direction (what AA) | DeCodon logits, marginalized over synonyms |
| `codon` | synonymous-residual (which codon within the AA) | DeCodon logits, conditioned on true AA |
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

## Versioning

`schema_version` is `biojspace/<model>-<major>.<minor>`. Adding an optional field → bump minor. Changing/removing a field or a `kind` enum value → bump major and update both sides. The frontend must ignore unknown optional fields (forward-compatible) and hard-fail on a major mismatch.
