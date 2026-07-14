# Resources — papers, code, models, data

Links to reuse and to cite. Grouped by role in the project. (URLs given as plain paths; the coding agent can resolve them.)

## The method (J-lens / J-space)

- **Anthropic Jacobian lens** — original method. Write-up: `transformer-circuits.pub` (2026, the Jacobian-lens / "J-space" article). Reference code: `github.com/anthropics/jacobian-lens`.
- **Neuronpedia Jacobian-lens frontend** — reusable visualization frontend for the lens: `github.com/neuronpedia/jacobian-lens` (also mirrored on HuggingFace). Study for UX; a full fork is Tier-2+.
- **Neuronpedia** (general) — `neuronpedia.org` — the interpretability-atlas UX to emulate at a high level.

## The model (DeCodon / the cdsFM family)

- **DeCodon-200M** (the model to build on) — `huggingface.co/goodarzilab/decodon-200M`. Autoregressive codon LM, 12 layers, hidden 1024, taxid-conditioned vocab (64 codons + 1667 NCBI taxid tokens). Weights validated and shipped in this handoff as `decodon200m_model.tar.gz`.
- **EnCodon-80M** (the encoder that FAILS the gate — for contrast/ablation only) — `huggingface.co/goodarzilab/encodon-80M`. Masked codon encoder; documented here so nobody re-proposes it. Larger checkpoints: `nvidia/NV-CodonFM-Encodon-600M`, `nvidia/NV-CodonFM-Encodon-1B` (the NVIDIA `-TE-` checkpoints add phenotype heads; a Tier-2 refinement only).
- **cdsFM** — the library wrapping both (`AutoEnCodon` / `AutoDeCodon`); the models' custom `modeling_*.py` ship with the HF repos. Loading gotchas captured in `adapter/decodon_adapter.py`.

## Protein precedents (cite up front; do NOT claim their ground)

- **Categorical Jacobian on ESM-2** — Zhang & Ovchinnikov, *PNAS* 2024. Input→output Jacobian that recovers residue contacts. This is "Jacobian interpretability on a protein LM," and it is *different* from the residual→output transport lens (it captures pairwise couplings, not an output dictionary).
- **InterPLM** — Simon & Zou, *Nature Methods* 2026. SAE features of ESM-2. Site: `interPLM.ai`. Code: `github.com/ElanaPearl/InterPLM`. Preprint: arXiv 2412.12101.
- **InterProt** — ESM-2 SAE feature visualizer, the closest existing *product*. Site: `interprot.com`. Code: `github.com/etowahadams/interprot` (ICML 2025 workshop). **Study its React UX directly.**
- **"Central Dogma Transformer II: An AI Microscope"** — arXiv 2602.08751 (2026). Computes ∂output/∂input Jacobians on a central-dogma model and pre-argues the genuine-vs-tautological-signal distinction — directly relevant to the echo confound you must guard against.

## Codon-structure prior work (cite so you don't "rediscover" synonymous structure)

The amino-acid-vs-synonym decomposition is **already published** ≥3×; your contribution is the *tooling/visualization + transport-lens comparison*, not discovering that synonymous structure exists.
- **codonGPT** — *NAR* 2025. Synonymous codons cluster; model mirrors the genetic code unsupervised; ships synonymous logit masking.
- **SynCodonLM** — bioRxiv 2025 / *NAR* 2026. Entire paper on disentangling codon-vs-protein semantics via synonym-constrained masking.
- **cdsBERT** — 2023. Synonymous distogram.

## Nucleotide precedent to stay clear of

- **Evo 2** — *Nature* 2026 (Brixi et al.); `github.com/ArcInstitute/evo2`; `arcinstitute.org/tools/evo`. 40B params, nucleotide-level, GPU/hosted-NIM only.
- **Goodfire × Arc "Interpreting Evo 2"** — `goodfire.ai/research/interpreting-evo-2`. The SAE-feature visualizer already shipped for Evo 2. This is *why* the project uses a codon model + transport lens instead: that space is taken.

## Data (for Tier 1 live inference and for training an optional SAE)

- **NCBI RefSeq CDS** — the fixture and all evidence used whole-genome `fasta_cds_na` from NCBI E-utilities. Example accessions: E. coli K-12 MG1655 `NC_000913.3` (taxid 562), B. subtilis 168 `NC_000964.3` (taxid 1423), P. aeruginosa PAO1 `NC_002516.2` (taxid 287). Fetch: `eutils.ncbi.nlm.nih.gov/entrez/eutils/efetch.fcgi?db=nuccore&id=<ACC>&rettype=fasta_cds_na&retmode=text`.
- **Clean-CDS filter** (used throughout): starts `ATG`, length `% 3 == 0`, no internal stop, ≥20 codons, drop terminal stop, ACGT-only.
- **Supported organisms** = the taxid tokens present in DeCodon's `vocab.json` (1667 of them). Resolve taxid→name via NCBI Taxonomy once and cache.

## Frontend building blocks

- **React + TypeScript + Vite** — the stack InterProt uses; least-friction path.
- **d3** or plain SVG for the atlas grid (small; no WebGL needed until >500 positions).
- **NCBI Taxonomy** for human-readable organism names in the switch control.

## The evidence behind this handoff (in `evidence/`)

- `A4_gating_result.md` / `.png` — EnCodon fails the gate (echo).
- `DeCodon_gating_result.md` / `.png` — DeCodon passes (+0.43 nats); species heterogeneity; last-layer synonym signal.
- `DeCodon_concept_sweep.csv` / `.png` — per-layer depth of 5 concepts (the honest layer axis).
- `BioJSpace_decision_register.md` — the full set of design decisions and their options.
- `BioJSpace_novelty_scan.md` — what's already published; how to position the contribution.
- `BioJSpace_adversarial_review.md` — the attack on the original brief; the traps this design avoids.
