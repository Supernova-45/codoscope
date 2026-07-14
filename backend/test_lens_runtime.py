"""Safety gates for loading optional Jacobian-lens artifacts."""

from __future__ import annotations

import json
import tempfile
import unittest
from pathlib import Path

import torch

from adapter.jacobian_adapter import RuntimeJacobianLens


class LensRuntimeTests(unittest.TestCase):
    def write_artifacts(self, directory: Path, status: str):
        lens = directory / "lens.pt"
        validation = directory / "validation.json"
        torch.save(
            {
                "J": {0: torch.eye(4)},
                "n_prompts": 100,
                "d_model": 4,
            },
            lens,
        )
        validation.write_text(json.dumps({"status": status}))
        return lens, validation

    def test_loads_only_validated_lens(self):
        with tempfile.TemporaryDirectory() as temp:
            lens, validation = self.write_artifacts(Path(temp), "passed")
            runtime = RuntimeJacobianLens(lens, validation)
            self.assertEqual(runtime.source_layers, [0])
            self.assertEqual(runtime.n_prompts, 100)

    def test_rejects_unvalidated_lens(self):
        with tempfile.TemporaryDirectory() as temp:
            lens, validation = self.write_artifacts(Path(temp), "failed")
            with self.assertRaisesRegex(RuntimeError, "validation gates"):
                RuntimeJacobianLens(lens, validation)


if __name__ == "__main__":
    unittest.main()
