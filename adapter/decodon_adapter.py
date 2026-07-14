"""
decodon_adapter.py — reference DeCodon-200M -> BioJ-Space atlas JSON adapter.

This is the BACKEND half of the contract. It loads DeCodon, runs a coding
sequence under one or more organisms (taxid tokens), and emits a document that
validates against docs/02_json_contract.md. The frontend never imports this;
it only consumes the JSON.

WHAT THIS FILE ENCODES (hard-won, do not rediscover):
  1. DeCodon ships custom modeling code that imports xformers + flash-attn.
     On CPU / no-xformers, set config.use_flash_attn = False BEFORE loading;
     the model has a pure-einsum fallback that IS causal (the 4-D causal mask
     is added inside the einsum branch).
  2. The custom code double-imports `einsum` (torch shadows einops) and mixes
     calling conventions. Patch the module's `einsum` with a dispatcher that
     routes by whether the first or last arg is the pattern string.
  3. Input layout is [<CLS>, <taxid>, codon_0, ..., codon_{n-1}, <SEP>].
     Autoregressive: the logits at input index (1 + p) predict codon p.
     Position 0 is predicted from the taxid alone -> exclude it from analysis.
  4. Vocabulary: 5 specials + 64 codons (ids 5..68, alphabetical) + 1667 taxid
     tokens named "<NCBI_taxid>" (e.g. "<562>" for E. coli). Only taxids in the
     vocab can be used; check `("<%d>" % taxid) in vocab`.

DOWNLOAD NOTE: HuggingFace serves model.safetensors through its Xet CDN. In a
sandboxed/proxied network, standard hf clients may hang at 0 bytes. If that
happens, the reconstruction path is: GET the file with
Accept: application/vnd.xet-fileinfo+json to get the file hash, GET a
xet-read-token, GET /v1/reconstructions/{hash} from cas-server.xethub.hf.co,
then plain-curl each term's byte-range from transfer.xethub.hf.co/xorbs/...
and de-chunk (8-byte header [ver(1),clen(3LE),scheme(1),ulen(3LE)]; scheme
0=raw, 1=lz4-frame, 2=BG4 = lz4 then un-shuffle 4 byte-planes). On a normal
network, `huggingface_hub.snapshot_download` just works — try that first.
"""
import sys, json, math
import numpy as np
import torch
from transformers import AutoConfig, AutoModelForCausalLM

STANDARD_CODON_TABLE = {}  # fill from Bio.Data.CodonTable or a literal dict; code[codon]->aa, '*' for stop

def load_decodon(model_dir, device="cpu"):
    cfg = AutoConfig.from_pretrained(model_dir, trust_remote_code=True)
    cfg.use_flash_attn = False                      # gotcha #1
    model = AutoModelForCausalLM.from_pretrained(
        model_dir, config=cfg, trust_remote_code=True).to(device).eval()
    torch.set_grad_enabled(False)

    # gotcha #2: patch the custom module's einsum dispatcher
    from einops import einsum as _eeinsum
    def smart_einsum(*a):
        if isinstance(a[0], str):  return torch.einsum(a[0], *a[1:])
        if isinstance(a[-1], str): return _eeinsum(*a)
        raise ValueError("einsum: no pattern string found")
    dmod = [m for n, m in sys.modules.items() if n.endswith("modeling_decodon")][0]
    dmod.einsum = smart_einsum

    vocab = json.load(open(f"{model_dir}/vocab.json"))
    assert not any(torch.isnan(p).any() for p in model.parameters()), "NaN weights — bad download"
    return model, vocab

def codon_columns(vocab, code):
    codons = sorted([k for k in vocab if len(k) == 3 and set(k) <= set("ACGT")])
    return codons, {c: i for i, c in enumerate(codons)}

def softmax(x):
    e = np.exp(x - x.max()); return e / e.sum()

@torch.no_grad()
def run_sequence(model, vocab, code, codon_list, taxid, layers=None):
    """Return (logits[L+2, V], hidden_states tuple) for one CDS under one organism."""
    CLS, SEP = vocab["<CLS>"], vocab["<SEP>"]
    ttok = vocab["<%d>" % taxid]
    ids = [CLS, ttok] + [vocab[c] for c in codon_list] + [SEP]
    out = model(input_ids=torch.tensor([ids]), output_hidden_states=(layers is not None))
    return out.logits[0], (out.hidden_states if layers is not None else None)

def build_document(model, vocab, code, sequence_id, codon_list, organisms):
    """organisms: dict {display_label: taxid_int}. Emits the frozen contract document."""
    codons, col = codon_columns(vocab, code)
    vcols = [vocab[c] for c in codons]
    aa3 = {'A':'Ala','R':'Arg','N':'Asn','D':'Asp','C':'Cys','E':'Glu','Q':'Gln','G':'Gly',
           'H':'His','I':'Ile','L':'Leu','K':'Lys','M':'Met','F':'Phe','P':'Pro','S':'Ser',
           'T':'Thr','W':'Trp','Y':'Tyr','V':'Val'}
    doc = {
        "schema_version": "biojspace/decodon-1.0",
        "model": {"name": "DeCodon-200M", "repo": "goodarzilab/decodon-200M",
                  "type": "autoregressive_codon_lm", "n_layers": 12, "hidden_size": 1024},
        "sequence_id": sequence_id,
        "organism_default": next(iter(organisms)),
        "organisms": list(organisms),
        "tokens": [{"pos": p, "codon": c, "aa": code[c], "aa3": aa3.get(code[c], code[c]), "frame": 0}
                   for p, c in enumerate(codon_list)],
        "per_organism": {},
    }
    for label, taxid in organisms.items():
        logits, _ = run_sequence(model, vocab, code, codon_list, taxid)
        per_pos = []
        for p, c in enumerate(codon_list):
            l64 = logits[1 + p, vcols].float().numpy()      # gotcha #3: logits at 1+p predict codon p
            prob = softmax(l64)
            aa_mass = {}
            for j, cc in enumerate(codons):
                aa_mass[code[cc]] = aa_mass.get(code[cc], 0.0) + prob[j]
            fam = [cc for cc in codons if code[cc] == code[c]]        # condition on TRUE aa family
            fp = {cc: prob[col[cc]] for cc in fam}
            s = sum(fp.values()) + 1e-12; fp = {k: v / s for k, v in fp.items()}
            ent = -sum(v * math.log(v + 1e-12) for v in fp.values()) / math.log(max(len(fp), 2))
            per_pos.append({
                "pos": p, "true_codon": c, "true_aa": aa3.get(code[c], code[c]),
                "aa_readout": [{"label": aa3.get(a, a), "kind": "aa_mean", "score": round(float(m), 4)}
                               for a, m in sorted(aa_mass.items(), key=lambda x: -x[1])[:5]],
                "synonym_readout": [{"label": cc, "kind": "codon", "score": round(float(v), 4)}
                                    for cc, v in sorted(fp.items(), key=lambda x: -x[1])[:6]],
                "aa_confidence": round(float(aa_mass.get(code[c], 0.0)), 4),
                "synonym_entropy": round(float(ent), 3),
            })
        doc["per_organism"][label] = per_pos
    return doc

if __name__ == "__main__":
    # Example. Fill STANDARD_CODON_TABLE (e.g. from Bio.Data.CodonTable.standard_dna_table.forward_table
    # plus stop codons -> '*'). MODEL_DIR is the extracted decodon200m_model.tar.gz.
    MODEL_DIR = "./decodon_model"
    model, vocab = load_decodon(MODEL_DIR)
    gene = "ATGCTG..."                       # a clean CDS: starts ATG, length % 3 == 0, no internal stop
    codon_list = [gene[i:i+3] for i in range(0, len(gene), 3)][:60]
    doc = build_document(model, vocab, STANDARD_CODON_TABLE, "demo_gene", codon_list,
                         {"E. coli (562)": 562, "B. subtilis (1423)": 1423, "P. aeruginosa (287)": 287})
    json.dump(doc, open("atlas_fixture.json", "w"))
