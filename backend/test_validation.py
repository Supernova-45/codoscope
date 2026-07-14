import unittest

from backend.validation import CDSValidationError, validate_cds


VALID_CDS = "ATG" + ("GCT" * 19)


class ValidateCDSTest(unittest.TestCase):
    def test_accepts_clean_cds_and_normalizes_whitespace(self):
        result = validate_cds(f"atg\n{'gct' * 19}")
        self.assertEqual(result.sequence, VALID_CDS)
        self.assertEqual(len(result.codons), 20)
        self.assertFalse(result.terminal_stop_removed)

    def test_removes_terminal_stop(self):
        result = validate_cds(VALID_CDS + "TAA")
        self.assertEqual(result.sequence, VALID_CDS)
        self.assertTrue(result.terminal_stop_removed)

    def test_rejects_non_dna_bases(self):
        with self.assertRaisesRegex(CDSValidationError, "only A, C, G, T"):
            validate_cds("ATG" + ("GCN" * 19))

    def test_rejects_wrong_frame(self):
        with self.assertRaisesRegex(CDSValidationError, "not divisible by 3"):
            validate_cds(VALID_CDS + "A")

    def test_rejects_missing_start(self):
        with self.assertRaisesRegex(CDSValidationError, "start with ATG"):
            validate_cds("GTG" + ("GCT" * 19))

    def test_rejects_internal_stop(self):
        with self.assertRaisesRegex(CDSValidationError, "position\\(s\\): 10"):
            validate_cds("ATG" + ("GCT" * 9) + "TAG" + ("GCT" * 9))

    def test_rejects_short_sequence_after_terminal_stop_is_removed(self):
        with self.assertRaisesRegex(CDSValidationError, "at least 20"):
            validate_cds("ATG" + ("GCT" * 18) + "TGA")


if __name__ == "__main__":
    unittest.main()
