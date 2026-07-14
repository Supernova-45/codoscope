# What this is, and what the science says

## The one-paragraph pitch

Build an interactive, Neuronpedia-style website that visualizes what **DeCodon-200M** (an autoregressive codon language model) is *poised to output* at every position of a coding sequence, layer by layer — a "BioJ-space" atlas. The final-output baseline separates the probability of each amino-acid family from the conditional distribution among the observed family's synonymous codons. A fitted averaged Jacobian then transports intermediate residual states into that output vocabulary. The signature interaction holds the DNA sequence fixed and switches the organism token. The encoded amino acid is invariant by construction; both of the model's predicted distributions may change, and Codoscope shows that calibration rather than hiding it.

## What "J-space" means (and the protein precedents)

**The Anthropic Jacobian lens ("J-lens").** The method takes the Jacobian of the map from an intermediate residual-stream state to the model's *output*, averages it over contexts, and expresses it in a token dictionary. "J-space" is the space of those **residual→output transport directions** — it answers "which output tokens is this internal state poised to produce." Original write-up: transformer-circuits.pub (2026); reference code `github.com/anthropics/jacobian-lens`. Neuronpedia ships a reusable frontend for it: `github.com/neuronpedia/jacobian-lens` (also on HuggingFace).

**For proteins, two related things already exist — and neither is the Anthropic lens ported straight over. Cite them; do not claim their ground.**

1. **Categorical Jacobian on ESM-2** (Zhang & Ovchinnikov, *PNAS* 2024, "Structure-informed protein language models..."; a.k.a. the "categorical Jacobian" work). This computes the Jacobian of output log-probabilities at each position **with respect to input tokens at every other position** — an *input→output coupling matrix*. Its headline result: it recovers residue–residue **contacts** (structure), essentially reading out the coevolutionary couplings the masked model learned. It is Jacobian-based, but it captures pairwise position couplings, **not** the residual→unembedding transport dictionary of the Anthropic lens.
2. **Interpretability *atlases* for proteins — the closest product competitors, but a different lens (SAE, not Jacobian):**
   - **InterPLM** (Simon & Zou, *Nature Methods* 2026; `interPLM.ai`; code `github.com/ElanaPearl/InterPLM`; arXiv 2412.12101) — sparse-autoencoder features of ESM-2, thousands of features per layer mapped to interpretable concepts.
   - **InterProt** (`interprot.com`; code `github.com/etowahadams/interprot`; ICML 2025 workshop) — an ESM-2 SAE feature visualizer; paste a sequence, see per-position/per-layer features, structure overlay. This is the closest existing *product* to what you're building — study its UX, then differentiate on **method** (J-lens/output-accessible, not SAE/represented) and **modality** (codon, not protein).

**So the unclaimed strip your project occupies:** the literal residual→output J-lens (or even a plain logit-lens), ported to a *codon* model, made interactive, with the amino-acid-vs-synonym decomposition as the interpretable readout. Jacobian methods on bio models exist (→ contacts); feature atlases on bio models exist (→ SAE); the transport-lens codon atlas does not.

**Nucleotide precedent to stay clear of:** Arc Institute + Goodfire already shipped an SAE-feature visualizer for **Evo 2** (`goodfire.ai/research/interpreting-evo-2`; Evo 2 in *Nature* 2026, `github.com/ArcInstitute/evo2`). That is nucleotide-level, SAE-based, GPU/hosted-API only, and already polished — which is exactly why this project uses a codon model and the transport lens instead.

## Why DeCodon, specifically — and why not the alternatives

This was decided empirically in the work that produced this handoff (full memos in `evidence/`). The summary:

- **EnCodon (masked codon encoder) FAILS the gate.** At a masked position the model's synonymous preference does not beat a bulk codon-frequency prior (−0.10 nats; synonym decodability is pure *input echo*). Building the atlas on EnCodon would visualize an artifact. See `evidence/A4_gating_result.md` + `figures/A4_gating_result.png`.
- **DeCodon (autoregressive codon decoder) PASSES the gate.** Predicting each codon from true left context, its synonymous preference beats a *fair, taxid-conditioned* frequency prior by **+0.43 nats pooled** (up to 0.95 synonym accuracy on E. coli). This is real, non-echo signal. See `evidence/DeCodon_gating_result.md` + `figures/DeCodon_gating_result.png`.
- **Evo 2 is the wrong fit for THIS project:** nucleotide vocabulary (4-token output → native atlas nearly blank), GPU/hosted-API only, SAE/represented axis, and the atlas already exists (Arc/Goodfire). Great model, redundant demo.

**Two measured caveats that shape the design (do not hide them):**
1. **Species heterogeneity.** The synonym signal is strong on E. coli (+0.96 nats) and P. aeruginosa (+0.32) but nearly flat on B. subtilis (+0.009) — DeCodon's per-organism competence varies. The atlas should let the visitor pick a weak organism and *see* the signal shrink; that's honest calibration, not a bug to hide.
2. **Concepts resolve at different depths (this rescues the layer axis).** Measured per-layer probe trajectories (`evidence/DeCodon_concept_sweep.csv`, `figures/DeCodon_concept_sweep.png`):
   - **Organism (taxid):** decodable from **layer 1** (it's an input token), ~1.0 by the top.
   - **Relative position in CDS:** a genuine **mid-layer** concept, peaking ~L7 then decaying.
   - **Amino-acid identity / chemical class:** **late buildup**, climbing L9→L12.
   - **Synonym preference:** crystallizes **only at L12** (no trajectory) — so it's shown via the taxid-switch, not the layer axis.
   - **GC3 (wobble base):** flat, not linearly separable from codon identity — **drop it as a standalone track.**

The vertical story the layer axis should tell is therefore real and specific: *organism at the bottom → positional context in the middle → amino acid at the top.*

## What the codon outputs actually show (the reader's takeaway per position)

At each codon position, the atlas surfaces:
- **`aa_readout`** — probability mass over amino-acid families after restricting the model softmax to its 64 codon outputs.
- **`synonym_readout`** — codon probability conditioned on the amino-acid family encoded by the observed input.
- **`lens`** — when present, ranked codon/amino-acid readouts for each measured layer and position, explicitly labeled as direct logit lens or averaged Jacobian lens.
- **How these change when you switch the taxid** — a model-input counterfactual. Codoscope always shows observed-amino-acid support alongside the conditional synonym shift because a dramatic conditional change can sit inside a low-probability amino-acid tail.
