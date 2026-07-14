# Biology primer — read this first if you don't know molecular biology

This project visualizes a model of DNA coding sequences. The frontend work is ordinary web engineering, but several **data invariants and design decisions come from biology**, and getting them wrong will silently corrupt the demo. This doc explains every biological concept the rest of the package assumes, in plain terms, and flags the decisions where biology — not engineering taste — dictates the answer. When in doubt on anything biological, **ask rather than guess**; a wrong biological assumption produces output that looks fine and is meaningless.

## The absolute basics

- **DNA** is a string over a 4-letter alphabet: `A, C, G, T` (the "bases" or "nucleotides").
- A **codon** is a group of **3 consecutive bases** — e.g. `ATG`, `GCG`. There are 4³ = **64 possible codons**.
- A **coding sequence (CDS)** is a DNA string that a cell reads **3 bases at a time**, in order, to build a protein. So a CDS is really a sequence of codons.
- Each codon maps to one **amino acid** (the building blocks of proteins) via the **genetic code** — a fixed lookup table. There are **20 amino acids** plus a "stop" signal.
- A protein is the chain of amino acids you get by translating each codon in the CDS.

## The one fact the whole project hinges on: synonymous codons

The genetic code is **redundant**: 64 codons map to only 20 amino acids + stop, so **most amino acids are encoded by several different codons**. Codons that code for the *same* amino acid are called **synonymous**.

Example — the amino acid Alanine (Ala) is coded by **four** synonymous codons: `GCA, GCC, GCG, GCT`. All four produce an identical protein. But organisms are **not** indifferent to which one is used — different species systematically prefer different synonymous codons (this is "codon usage bias," driven by things like which transfer-RNAs are abundant in that organism). E. coli loves `GCG`; another species might prefer `GCC`.

**This is the entire scientific hook of the demo:**
- **Which amino acid** a position codes = "what protein is being built" (biologically constrained, the model is usually confident).
- **Which synonymous codon** within that amino acid = "the organism's dialect" (a preference, and the thing that differs between species).

The model (DeCodon) was trained on real coding sequences from thousands of organisms and given the organism's identity as an input. So it learned organism-specific codon preferences. **The hero interaction switches that organism token while holding the DNA fixed. The amino acid encoded by the input therefore stays fixed, but DeCodon's predicted amino-acid confidence can change.** Codoscope shows that confidence beside the conditional synonymous preference, making the model counterfactual visible without treating it as a clean biological intervention.

## The genetic code table (you need this exact mapping)

The frontend/adapter must map each of the 64 codons to its amino acid. Use the **standard genetic code** (NCBI translation table 1). Do not hand-type it — get it from a library (`Bio.Data.CodonTable.standard_dna_table` in Biopython) or a vetted constant. Key structural facts the code encodes, which the UI relies on:
- **21 groups**: 20 amino acids + stop.
- **Group sizes vary**: 2 amino acids have only 1 codon (Met=`ATG`, Trp=`TGG` — *no synonymous choice, exclude them from the synonym demo*); others have 2, 3, 4, or 6 synonymous codons.
- **`ATG` = Met = "start"**: a valid CDS begins with `ATG`.
- **`TAA, TAG, TGA` = stop**: these terminate translation and must not appear *inside* a CDS.

## What makes a sequence valid input (enforce this — biology, not arbitrary)

A sequence is only a meaningful CDS if **all** of these hold. The adapter rejects sequences that fail; the frontend should explain *why* to the user:
1. **Only A/C/G/T** — no `N`, no RNA `U`, no lowercase surprises (uppercase-normalize first).
2. **Length is a multiple of 3** — because it's read in codons. A length of 100 is invalid; 99 or 102 is fine.
3. **Starts with `ATG`** — the biological start codon.
4. **No internal stop codon** — `TAA/TAG/TGA` may appear only as the final codon (and is usually trimmed). An internal stop means the frame is wrong or the sequence isn't a real CDS.
5. **Reasonable length** — at least ~20 codons to be a plausible gene.

**Why this matters for the demo:** the model's readout is only interpretable if the input is in the correct reading frame. Feed it a random DNA string or a frame-shifted sequence and it will still produce numbers, but they mean nothing. This is the single most important biology-driven guardrail.

## "Reading frame" — why position 0 is special

Because a CDS is read in fixed groups of 3 from the start, there is exactly **one correct grouping** ("frame 0"). The adapter always groups from the `ATG`. (You may later expose alternate frames as a curiosity, but frame 0 is the biology.) Note also: in the model's autoregressive setup, the **first codon has no preceding codons to condition on**, so its prediction comes only from the organism token — that's why the adapter excludes position 0 from the synonym analysis. That's a modeling decision with a biological reason (no upstream context exists yet).

## Organisms and "taxid"

Every organism has a unique integer ID in the **NCBI Taxonomy** database, called a **taxid** (e.g. E. coli = 562, B. subtilis = 1423, P. aeruginosa = 287). DeCodon takes the taxid as a special input token, which is how it knows "whose dialect" to predict. Two consequences for the UI:
- **Only organisms whose taxid is in the model's vocabulary can be selected** (1667 of them). The backend must expose the allowed list; don't let the user type an arbitrary organism.
- **Show human-readable names, not raw taxids.** Map taxid→name via NCBI Taxonomy (once, cached). "E. coli," not "562."

## Biology-driven design decisions (flagged for you — don't decide these on engineering taste)

These are places where the *right answer comes from biology*. They're already resolved in the docs, but here's the reasoning so you can defend or revisit them:

1. **Condition the synonym readout on the TRUE amino acid, not the model's predicted one.** The interpretable question is "given this position codes Alanine, which Ala-codon does the model prefer here, in this organism?" If you instead conditioned on the model's argmax amino acid at low-confidence positions, you'd show synonyms for the *wrong* amino acid family and the demo would look broken. (This was an actual bug caught while building the fixture.) → see `adapter/decodon_adapter.py`.
2. **Exclude Met (`ATG`) and Trp (`TGG`) from the synonym demo.** They have exactly one codon each — there is no synonymous choice to show. Including them would display a trivial "100% one codon" panel.
3. **Drop "GC3 / wobble base" as a standalone visualization track.** Biologically it's tempting (GC content at the 3rd codon position is a classic codon-bias signal), but it was measured to be *not linearly separable* from codon identity in the model — a track for it would be visualizing noise. → see `evidence/DeCodon_concept_sweep.csv`.
4. **Expect and SHOW species heterogeneity.** The model predicts codon preference well for some organisms (E. coli) and barely better than chance for others (B. subtilis), because its training data is uneven across the tree of life. Don't "fix" this or hide it — letting the user see the signal weaken on some organisms is honest and is itself interesting. → see `evidence/DeCodon_gating_result.md`.
5. **The layer axis reflects biology resolving at different depths.** Organism identity is known immediately (it's an input); positional context builds in the middle layers; the amino-acid decision resolves near the output. This ordering is measured, not assumed — render it as-is. → see `evidence/DeCodon_concept_sweep.png`.

## Glossary (quick reference)

| term | plain meaning |
|---|---|
| base / nucleotide | one DNA letter: A, C, G, T |
| codon | 3 bases; codes one amino acid |
| CDS | coding sequence; a gene read in codons |
| amino acid | protein building block; 20 of them |
| genetic code | the fixed 64-codon → 20-amino-acid+stop table |
| synonymous codons | different codons for the *same* amino acid |
| codon usage bias | organisms' systematic preference among synonymous codons |
| reading frame | the grouping of bases into codons from the start |
| start / stop codon | ATG starts; TAA/TAG/TGA end translation |
| taxid | NCBI integer ID for an organism |
| amino-acid-mean readout | "what protein" — the model's amino-acid expectation |
| synonymous-residual readout | "whose dialect" — the within-amino-acid codon preference |

**If a biological decision comes up that isn't covered here, flag it explicitly and ask — do not resolve it by analogy to non-biological software. The cost of a silent wrong assumption in this domain is a demo that looks correct and is scientifically empty.**
