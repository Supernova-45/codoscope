"""FastAPI behavior tests that do not require loading model weights."""

from __future__ import annotations

import unittest
from unittest.mock import patch

from fastapi.testclient import TestClient

import backend.main as api


class ApiTests(unittest.TestCase):
    def setUp(self):
        self.client = TestClient(api.app)
        with api._cache_lock:
            api._result_cache.clear()
            api._result_cache_order.clear()

    def test_health_is_503_when_model_artifacts_are_incomplete(self):
        with patch.object(api, "_model_files_ready", return_value=False):
            response = self.client.get("/api/health")
        self.assertEqual(response.status_code, 503)
        self.assertEqual(response.json()["status"], "degraded")

    def test_organism_name_search_uses_local_cache(self):
        vocab = {"<CLS>": 0, "<562>": 69, "<1423>": 70}
        with patch.object(api, "_get_vocab", return_value=vocab):
            response = self.client.get("/api/organisms?query=coli")
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json(), [{"taxid": 562, "name": "Escherichia coli"}])

    def test_unsupported_taxid_is_rejected_before_model_loading(self):
        sequence = "ATG" + "GCT" * 19
        with patch.object(api, "_get_vocab", return_value={"<562>": 69}):
            response = self.client.post(
                "/api/atlas",
                json={"sequence": sequence, "organisms": [999999]},
            )
        self.assertEqual(response.status_code, 400)
        self.assertIn("not in model vocabulary", response.json()["detail"])

    def test_busy_model_returns_bounded_429(self):
        sequence = "ATG" + "GCT" * 19
        acquired = api._inference_slot.acquire(blocking=False)
        self.assertTrue(acquired)
        try:
            with (
                patch.object(api, "_get_vocab", return_value={"<562>": 69}),
                patch.object(api, "_get_model", return_value=(object(), {"<562>": 69})),
            ):
                response = self.client.post(
                    "/api/atlas",
                    json={"sequence": sequence, "organisms": [562]},
                )
        finally:
            api._inference_slot.release()
        self.assertEqual(response.status_code, 429)
        self.assertEqual(response.headers["retry-after"], "2")


if __name__ == "__main__":
    unittest.main()
