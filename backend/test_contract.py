"""Golden tests for the shared atlas contract and biological invariants."""

from __future__ import annotations

import json
import unittest
from pathlib import Path

from Bio.Data.CodonTable import standard_dna_table
from jsonschema import validate

ROOT = Path(__file__).resolve().parent.parent


class ContractTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.schema = json.loads((ROOT / "adapter" / "schema.json").read_text())
        cls.fixture = json.loads((ROOT / "data" / "atlas_fixture.json").read_text())

    def test_source_and_public_fixture_are_identical(self):
        self.assertEqual(
            (ROOT / "data" / "atlas_fixture.json").read_bytes(),
            (ROOT / "public" / "data" / "atlas_fixture.json").read_bytes(),
        )

    def test_fixture_validates_against_authoritative_schema(self):
        validate(self.fixture, self.schema)

    def test_fixture_cross_field_biology_is_consistent(self):
        code = dict(standard_dna_table.forward_table)
        code.update({codon: "*" for codon in standard_dna_table.stop_codons})
        aa3 = {
            "A": "Ala", "R": "Arg", "N": "Asn", "D": "Asp", "C": "Cys",
            "E": "Glu", "Q": "Gln", "G": "Gly", "H": "His", "I": "Ile",
            "L": "Leu", "K": "Lys", "M": "Met", "F": "Phe", "P": "Pro",
            "S": "Ser", "T": "Thr", "W": "Trp", "Y": "Tyr", "V": "Val",
        }
        for position, token in enumerate(self.fixture["tokens"]):
            self.assertEqual(token["pos"], position)
            self.assertEqual(code[token["codon"]], token["aa"])
            self.assertEqual(aa3[token["aa"]], token["aa3"])
            for organism in self.fixture["organisms"]:
                readout = self.fixture["per_organism"][organism][position]
                self.assertEqual(readout["pos"], position)
                self.assertEqual(readout["true_codon"], token["codon"])
                self.assertEqual(readout["true_aa"], token["aa3"])
                self.assertAlmostEqual(
                    sum(entry["score"] for entry in readout["synonym_readout"]),
                    1,
                    places=3,
                )
                self.assertTrue(all(
                    code[entry["label"]] == token["aa"]
                    for entry in readout["synonym_readout"]
                ))

    def test_concept_scores_align_with_layers(self):
        evidence = self.fixture["concept_layers"]
        for concept in evidence["concepts"].values():
            self.assertEqual(len(concept["scores"]), len(evidence["layers"]))


if __name__ == "__main__":
    unittest.main()
