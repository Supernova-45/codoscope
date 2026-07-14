# Is it novel? A literature scan of the *BioJ-Space / CodonLens* idea

**Method:** the brief's novelty claim ("I did not identify a published study applying the Jacobian lens to CodonFM") is only true for the *narrowest possible* framing. I decomposed the idea into its four load-bearing components and searched each against the literature. The verdict: **the specific method is unclaimed, but every component it stands on — and the biological finding it would produce — is already in the literature.** The novelty is a thin combinatorial strip surrounded on all sides by prior art, not an open gap.

## Verdict by component

| Component of the idea | Already done? | Closest prior art |
|---|---|---|
| Jacobian-based interpretability of a **biological** model | **Yes, repeatedly** | Categorical Jacobian on ESM-2 (PNAS 2024); "Central Dogma Transformer II: An AI Microscope" computes ∂output/∂input Jacobians through a full regulatory model (2026) |
| **Synonymous-codon structure** / amino-acid-vs-codon decomposition discovered in a codon model | **Yes, ≥3 groups** | codonGPT (NAR 2025); SynCodonLM (bioRxiv 2025 / NAR 2026); cdsBERT (2023) |
| **Interactive** bio-interpretability atlas (a "Neuronpedia for biology") | **Yes, ≥2 exist** | InterPLM / interPLM.ai and InterProt / interprot.com (both ESM-2 SAE explorers) |
| Logit-/Jacobian-lens *layerwise readout* ported to a **codon/DNA** model, output-accessible framing | **Not found** | J-lens exists for language (Neuronpedia Qwen3.6); no codon/genomic port located |
| **Represented (SAE) vs. output-accessible (J-lens)** contrast in a bio model | **Not found** | the two lines exist separately (InterPLM SAEs; Anthropic J-lens) but haven't been contrasted on a bio model |

## The evidence, component by component

### 1. "Jacobian interpretability on a bio model" is not new — it's a small field

- **Categorical Jacobian on ESM-2** (Zhang & Ovchinnikov, PNAS 2024 / bioRxiv 2024): computes an input→output Jacobian `[L,A,L,A]` over a protein language model and shows ESM-2 stores coevolutionary statistics analogous to a Markov Random Field. This is *a Jacobian used to interpret a biological language model*, published two years before the brief.
- **"Central Dogma Transformer II: An AI Microscope for Understanding Cellular Regulatory Mechanisms"** (arXiv 2602.08751, 2026): computes `J_ji = ∂output_j/∂input_i` by backprop through the full model, renders a **Jacobian heatmap** of regulatory structure, and even pre-empts the obvious criticism by arguing the gradient signal is "genuine biological signal rather than a tautological relationship." This is startlingly close in spirit to the brief's proposed intervention-selectivity story — and it's already a paper.

The distinction the brief can still claim: these are **input→output** Jacobians (attribution), whereas Anthropic's J-lens is a **residual→final-layer transport** decoded through the unembedding. That difference is real but narrow, and it is *not* the difference the brief foregrounds.

### 2. The headline biological finding is already published — three times

The brief's crown jewel is "decompose codon directions into an amino-acid mean and a synonymous residual, and show the model has learned synonymous structure." That finding already exists at the embedding/logit level:

- **codonGPT** (NAR 2025): t-SNE of codon embeddings shows synonymous codons cluster; cosine-similarity distributions quantify synonymous relationships; the geometry "mirror[s] the structure of the genetic code" with no amino-acid supervision. They even ship **synonymous logit masking** at inference.
- **SynCodonLM** (bioRxiv 2025 / NAR 2026): the *entire paper* is about disentangling codon-level from protein-level semantics via synonym-constrained masking; embeddings cluster by wobble base and dinucleotide suffix rather than amino acid.
- **cdsBERT** (2023): codon-embedding distogram with 21 visible synonymous segments around the diagonal.

So "the model represents synonymous choice as structure separable from amino-acid identity" is **established biology-of-the-model**, not a discovery the J-lens would make. The J-lens reframes it as *output-accessible* rather than *present-in-embeddings* — a genuine but incremental reframing, not a new phenomenon.

### 3. The "interactive Neuronpedia for biology" already exists (for proteins)

- **InterPLM / interPLM.ai** (Simon & Zou, Nature Methods): interactive platform to explore SAE features across every ESM-2 layer, with steering. 2,548 interpretable features/layer mapped to 143 biological concepts.
- **InterProt / interprot.com**: a second SAE visualizer, activations overlaid on structure and alignments.

The product concept — paste a sequence, explore a layer-by-position feature atlas, steer/intervene — is instantiated twice already. The brief's website would differ in the *readout* (J-lens directions vs. SAE features) and the *modality* (codon vs. protein), not the interaction model.

### 4. What is genuinely unclaimed (the thin strip)

Two things did **not** surface and appear open:

1. **The transport J-lens (or even a plain logit lens) ported to a codon/DNA model**, with the layer×position atlas. Neuronpedia has the J-lens for a *language* model (Qwen3.6); nobody has published the codon/genomic port. Notably even the *simpler* logit lens — standard for text, speech, vision, audio, 3D — has no codon/genomic application I could find, which tells you this strip is open mostly because the enabling method is one week old, not because it's hard or deep.
2. **The "represented (SAE) vs. output-accessible (J-lens)" contrast on a bio model.** This is the one idea in the whole brief that is both novel and conceptually interesting — and (per the accompanying review) it's exactly the one the brief under-develops relative to the website engineering.

## Bottom line

- **"Nobody has applied the J-lens to CodonFM"** is technically true and nearly vacuous: the method is ~1 week old, so it's true of most (model, method) pairs right now. It's a race condition, not a research gap.
- **The biological payoff** the demo would show — synonymous structure, amino-acid vs codon decomposition — is **already published by ≥3 groups**, so a reviewer will read the atlas as "a new visualization of a known result."
- **The product** (interactive bio-interpretability atlas) **already exists** for proteins (InterPLM, InterProt).
- **The defensible novelty** is narrow: (a) first lens-style layerwise readout on a codon model, and (b) the SAE-vs-J-lens "represented vs. accessible" contrast. Only (b) is conceptually new rather than a port.

**Implication for the project:** pitch it honestly as *a visualization/tooling contribution* (first J-lens-style codon atlas) plus *one genuinely new comparison* (represented vs. output-accessible), **not** as discovering that codon models encode synonymous structure — that ship has sailed. And if you build it, cite codonGPT / SynCodonLM / cdsBERT up front as the prior that established the biology, or a reviewer will do it for you.

---

*Scan performed via targeted literature search across the four decomposed claims. Existence of each cited work verified from its abstract/repository; the transport-vs-input Jacobian distinction and the "one-week-old method" caveat are the reviewer's characterization, not claims from the sources.*
