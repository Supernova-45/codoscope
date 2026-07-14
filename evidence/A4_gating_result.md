# A4 — the gating experiment, run on the real model

**Question (from the decision register):** does CodonFM's context carry synonymous-codon structure *beyond* input codon identity and amino-acid family? If not, the atlas is re-printing its own input and the platform is moot.

**Verdict: the gate does not open. On this model, at masked positions, context does not encode synonymous preference beyond bulk codon frequency.** The synonym signal the demo is built around is input echo, not a computed feature.

This is a real, adversarial test on the actual model — not a re-derivation of the genetic-code algebra from the earlier review. Every number below comes from EnCodon-80M (= CodonFM, 80M checkpoint) run on held-out coding sequences.

---

## What was actually run

- **Model:** EnCodon-80M (`goodarzilab/encodon-80M`), the masked codon encoder — 6 layers, hidden 1024, 64-codon vocabulary. Weights downloaded, validated (0 NaN, all 6 layers, byte-exact), and archived as an artifact. Custom attention run on CPU via the model's own non-flash fallback.
- **Data:** real coding sequences from three species held out from each other — *E. coli* (3,818 CDS), *B. subtilis* (3,277), *S. cerevisiae* (764) — pulled from NCBI RefSeq. Clean CDS only (start ATG, in-frame, no internal stops).
- **Sampling:** 250 sequences per species; 12 masked positions per sequence drawn only from amino-acid families that *have* a synonymous choice (Met/Trp excluded). **9,000 masked records** for the behavioral + masked-probe analysis, plus **9,000 unmasked records** for the echo control.
- **The key discipline:** every "does context know the synonym?" number is measured at a **masked** position, so the input codon token is hidden and any signal must be reconstructed from context. The **unmasked** condition is the control that shows what trivial input-echo looks like.

## The three results (figure panels A–C)

**A. Behavioral — context does not beat bulk frequency.** At a masked codon, restrict the model's prediction to the correct amino-acid's synonyms and ask how much probability it puts on the *true* synonym, versus a context-free baseline that just uses each species' global codon-usage frequencies.

| species | CodonFM context (cross-entropy, nats ↓) | frequency prior (nats ↓) | model − prior |
|---|---|---|---|
| *E. coli* | 1.120 | 1.121 | **+0.001** (tie) |
| *B. subtilis* | 1.246 | 1.100 | **−0.146** (worse) |
| *S. cerevisiae* | 1.262 | 1.100 | **−0.162** (worse) |

The model, given the entire rest of the gene, predicts the synonymous codon *no better than — and usually worse than — a lookup table of that organism's codon-usage bias.* Argmax accuracy tells the same story (pooled 0.459 model vs 0.469 prior).

**B. Representational — synonym identity is input echo, not a computed feature.** Train per-layer linear probes to recover which synonymous codon was used.
- **Unmasked** (input token visible): **1.00** at every layer — perfect, because the codon *is* the input.
- **Masked** (context only): **0.39–0.41** at every layer, i.e. *at or below* the 0.42 frequency baseline.

The gap between the purple line (1.00) and the blue line (~0.40) is the entire "signal" — and it vanishes the moment you stop letting the model read the answer off its own input. There is no middle-layer enrichment; the masked curve is flat across all 6 layers.

**C. Why — at a masked codon the model knows almost nothing.** Amino-acid identity is perfectly decodable when the codon is visible (1.00) but **collapses to 0.07 — below the 0.11 majority-class baseline — when the position is masked.** The model cannot even recover the amino acid at a masked position from context, let alone the finer synonymous choice. (This is consistent with CodonFM being trained at a low mask rate on long CDS, where most positions are weakly determined by context.)

## What this means for the project

1. **The hero panel of the mockup — "GCG 62% → after ablation GCC 47%", the synonymous-swap interaction — is measuring input echo.** When you display a codon and read a "synonym preference" off the model, you are largely reading back the codon you fed in. Ablate/swap the input and the readout follows the input, not a learned biological preference. That is the circularity the review flagged (A2/B4), now confirmed on the model rather than argued from the genetic code.

2. **The native-dictionary atlas will look busy but say little.** Layer-1 will echo the input codons (the mockup even shows this), and deeper layers add no decodable synonymous structure beyond frequency. The "layer trajectory" for a synonymous concept is, on this model, close to a flat line at the codon-usage prior.

3. **This is a property of the masked-encoder objective, not a bug in the analysis.** It is exactly why the register's A1 (encoder vs decoder) is the first blocking decision. An autoregressive model (**DeCodon**) predicts each codon from the true left context with nothing masked, so "what does the model expect here, and does it prefer a synonym" is a well-posed, non-echo question. The identical experiment on DeCodon is the natural next test — and the honest place to look for a signal that would open the gate.

## Caveats (stated so they aren't a reviewer's later gift)

- **One model, one checkpoint.** This is EnCodon-80M. A negative here is decisive *for the encoder the brief actually names*, not for every codon model. DeCodon-200M and the 600M/1B EnCodon checkpoints are untested; the register already predicts the larger encoders would be worse for this method (smaller represented fraction), but that is a prediction, not a measurement.
- **Three bacterial/fungal genomes.** Broadly representative of coding sequence, but not mammalian; a signal that only exists in complex 5′/3′ regulatory context wouldn't show here. That is a scope statement, not a rescue — the demo's premise is codon-level synonymous preference, which is exactly what's absent.
- **Masking protocol.** Canonical single-position masking, matching how one would query the atlas. A different protocol (multi-mask, pseudo-likelihood) changes absolute numbers but not the echo-vs-context logic: the frequency baseline is the floor either way.

## The decision this forces

- **Do not build the native-codon synonymous-swap atlas on EnCodon as the headline.** It will demo an artifact.
- **Re-run this exact notebook on DeCodon-200M before committing to any model.** If DeCodon's masked-equivalent (next-codon) prediction beats the frequency prior, the project has a real signal and the atlas has something to show. If it doesn't, pivot the "cool" demo to the *represented* side (SAE features, the InterProt-style contrast) where the signal demonstrably exists — and drop the "output-accessible synonymous preference" claim entirely.

Files: `A4_gating_result.png` (figure), `A4_results.csv` (all numbers), `encodon80m_model.tar.gz` (validated weights + code, for re-running on DeCodon).
