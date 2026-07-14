"""Atomic model-installation readiness tests."""

from __future__ import annotations

import json
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch

import backend.start as start


class ModelInstallationTests(unittest.TestCase):
    def test_partial_download_is_not_complete(self):
        with tempfile.TemporaryDirectory() as temp:
            directory = Path(temp)
            (directory / "config.json").write_text("{}")
            (directory / "vocab.json").write_text("{}")
            with patch.object(start, "MODEL_DIR", directory):
                self.assertFalse(start.model_is_complete())

    def test_marker_requires_all_files_and_pinned_revision(self):
        with tempfile.TemporaryDirectory() as temp:
            directory = Path(temp)
            for name in start.REQUIRED_FILES:
                (directory / name).write_bytes(b"test")
            (directory / start.COMPLETE_MARKER).write_text(json.dumps({
                "revision": start.MODEL_REVISION,
                "model_sha256": start.MODEL_SHA256,
            }))
            with patch.object(start, "MODEL_DIR", directory):
                self.assertTrue(start.model_is_complete())
                (directory / "model.safetensors").unlink()
                self.assertFalse(start.model_is_complete())


if __name__ == "__main__":
    unittest.main()
