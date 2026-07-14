# BioJ-Space / CodonLens — decisions to settle before kickoff

A register of the open decisions, grouped by urgency. For each: the choice, why it matters, and a recommended default. "Blocking" = resolve before writing code, because it changes what code you write. "Shaping" = resolve before the design freezes. "Deferrable" = fine to revisit after the first result.

The through-line from the review: **the single biggest risk is building a platform around a null result.** Several decisions below exist specifically to fail cheaply before you commit.

---

## A. BLOCKING — settle these first (they change the code you write)

### A1. Which model + architecture — encoder or decoder?
- **Options:** EnCodon-80M (masked encoder) · DeCodon-200M (autoregressive) · both.
- **Why it matters:** this decides whether "output-accessible" is a *causal transport* claim (autoregressive, faithful to Anthropic) or a *masked-saliency proxy* (encoder). It changes the adapter's forward/backward call, and it changes what you can honestly claim. The encoder is what the whole brief assumes; the decoder is the more faithful analogue and is sitting in the same repo.
- **Still to research:** does DeCodon expose clean per-layer hidden states and gradients the way EnCodon does? (Verify before committing — the brief never checked.)
- **Recommended default:** **EnCodon-80M to build/iterate** (cheapest, matches the memo), but **run one DeCodon sanity pass early** to see if the causal-faithful version is within reach. Do not use the 1B checkpoint — bigger *lowers* the fraction of the model your dictionary covers.

### A2. Lens definition — transport-first vs. average logit-gradient?
- **Options:** transport-first J-lens (apply real nonlinear head to Jᵢₕ) · average logit-gradient dictionary (fixed vector per codon per layer) · plain logit lens baseline.
- **Why it matters:** transport-first gives per-input directions that *move every input* → no fixed dictionary → no sparse decomposition, steering, or swaps possible. Average-gradient gives fixed directions but blurs away the context-dependence the trajectory view is supposed to show. This is a difference in kind, not a tradeoff. You cannot design the JSON contract or the intervention panel until you pick.
- **Recommended default:** **average logit-gradient as the primary** (it's the only one that supports the swap demo), **plain logit lens as the honesty baseline**, and treat transport-first as a research-only comparison, not a product surface.

### A3. Masking protocol for the encoder
- **Options:** masked target only · unmasked (teacher-forced) · pseudo-likelihood · random.
- **Why it matters:** at an *unmasked* position the codon logit is dominated by that position's own input embedding (near-copying); at a *masked* position it's the model's prior. "Synonymous preference beyond amino-acid identity" is only well-defined under one protocol — and you can *manufacture* a positive or null result by choosing it. This is the most subtle correctness trap in the whole project.
- **Recommended default:** **masked-target** as canonical; document it explicitly; report the unmasked version only as a labeled contrast. (Moot if you go DeCodon — autoregressive has no masking choice.)
- **Still to research:** what masking scheme was EnCodon actually *trained* under? The lens should match the training objective or you're reading off-distribution.

### A4. The gating experiment — what result kills the project?
- **Decision:** define, in writing, the single test whose null result stops the build.
- **Recommended framing:** "Do middle layers carry synonymous-residual structure *beyond* input codon identity and amino-acid family?" If no → the atlas is just re-printing the input, and the platform is moot. This must be **Deliverable #1**, a notebook, before any web code. (Prior from the review: the native 64-atom dictionary spans ≤6% of hidden space and the grouped axes are a change of basis, so a null here is a live possibility, not a formality.)

---

## B. SHAPING — settle before the design freezes

### B1. Native dictionary vs. augmented — and how to differentiate from InterProt
- **Options:** native codon/grouped only · add SAE features · add phenotype/assay heads.
- **Why it matters:** the moment you add SAEs you're doing InterProt-on-codons (represented side), which already exists for proteins. Staying native keeps you on the *output-accessible* side — the one genuinely novel axis — but risks a visually thin atlas. This decision *is* your novelty positioning.
- **Recommended default:** **native + grouped as the hero**, plus an **optional SAE panel specifically to stage the "represented vs. output-accessible" contrast** — the one comparison nobody has published. That converts "how is this different from InterProt?" into your headline result rather than a weakness.

### B2. The JSON data contract
- **Decision:** freeze the per-sequence schema (`label`+`kind`, top-k mandatory, dense-per-pinned-concept optional) before building either half.
- **Why it matters:** it's the seam that lets the frontend be built against fixtures while the adapter is still unwritten. Getting `kind ∈ {codon, aa_mean, derived, sae, phenotype, assay}` in from day one means augmented dictionaries need no schema change.
- **Recommended default:** freeze it first; write a fixture generator that emits random-but-valid readouts so the frontend never blocks on the model.

### B3. Fitting corpus for the dictionary
- **Still to research / decide:** which coding sequences, how many, what taxonomic spread, held out how? The brief hand-waves "100–500 sequences." Direction stability vs. corpus size is itself one of the feasibility questions (does top-k ranking converge?).
- **Open bio question:** hold out by **gene family and species** (not random) so "transfer across genes/taxa" is a real test, not leakage. Decide the taxa up front.
- **Recommended default:** a few taxonomic groups, held out by family+species; test convergence of direction cosines as corpus grows *before* trusting any readout.

### B4. Intervention evaluation — de-circularizing the swap
- **Why it matters:** ablating along `v_GCG` is guaranteed to move the GCG logit (the axis is defined from that derivative) → high "selectivity" is near-tautological. The swap demo looks impressive for reasons unrelated to biology unless you evaluate on quantities *not* used to build the direction.
- **Decision needed:** which frozen heads (expression / translation-efficiency / stability) will score interventions, and which null directions (random norm-matched, GC-matched non-synonymous) are the controls.
- **Still to research:** do CodonFM's phenotype heads exist as loadable frozen heads (NVIDIA's `-TE-` checkpoints)? Verify availability before promising the causal-phenotype panel.

### B5. Tier target for v1
- **Options:** Tier 0 static (precomputed JSON, no serving) · Tier 1 live single-model · Tier 2 full Neuronpedia fork.
- **Recommended default:** **Tier 0**, and don't advance until A4's gating result is positive. The brief starts at Tier 2; that inverts cheap falsification into expensive falsification.

### B6. Build-from vs. fork
- **Options:** fork Neuronpedia (Postgres/Prisma/PyTorch) · study InterProt's `viz` React app (closer fit, lighter) · clean-room React grid.
- **Recommended default:** **clean-room grid for Tier 0** (the atlas is ~4 components; a fork drags in auth/DB you don't need), borrowing InterProt's sequence-strip/activation-rendering patterns and Neuronpedia's NDJSON streaming contract if/when you reach Tier 1.

---

## C. DEFERRABLE — revisit after the first result

- **C1. Live inference / steering / sharing / feature pages** — all Tier-2, only if Tier-0 shows something worth serving.
- **C2. Genome-browser tracks** (conservation, known variants, structure) — nice-to-have overlays; the atlas + swap stand without them.
- **C3. Multi-model comparison** (Enformer assay tracks, protein models) — expands scope and, for Enformer, quietly changes the method to attribution. Defer or drop.
- **C4. 600M/1B checkpoints** for sharper phenotype heads — only after the 80M pipeline works end to end.
- **C5. Compute budget for larger Jacobian fits** — irrelevant at 80M; becomes real only if you scale up (and scaling up is discouraged for this method).

---

## D. Non-code decisions that are really *positioning* decisions

- **D1. What is v1 claiming to be?** A **tooling/visualization contribution** (first J-lens-style codon atlas) + **one new comparison** (represented vs. output-accessible) — **not** a discovery that codon models encode synonymous structure (published ≥3×: codonGPT, SynCodonLM, cdsBERT). Decide the framing now so the whole build points at it.
- **D2. Cite the prior up front.** codonGPT / SynCodonLM / cdsBERT established the biology; InterProt/InterPLM established the product pattern. Decide to foreground these rather than let a reviewer surface them.
- **D3. Retire "workspace" language for the encoder.** Either switch to DeCodon (where present→future broadcast is real) or drop "global workspace / J-space" and call it a codon-logit saliency atlas. Don't ship both the encoder and the workspace claim.

---

## The critical path, compressed

1. **A1–A3** (model, lens, masking) — pick, and verify the gradients/heads actually exist. *Blocking.*
2. **A4 + B3** — run the gating notebook: does middle-layer synonymous structure exist beyond input identity, on a held-out corpus? *This is the go/no-go.*
3. **B4** — if go, run the de-circularized swap against frozen heads + nulls.
4. **B2 + B6** — freeze the JSON contract, build Tier-0 frontend against fixtures.
5. Swap fixtures → real JSON for a few curated sequences. Ship static.
6. Only then consider Tier-1 and the deferrable list.

Everything above step 4 is a notebook. Nothing needs a server, a database, or a GPU cluster until the science says there's something to look at.
