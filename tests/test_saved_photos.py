#!/usr/bin/env python3
"""Tests for GET/POST /saved-photos. MIT, this repo. Uses Python unittest."""

from __future__ import annotations

import http.client
import json
import sys
import tempfile
import threading
import unittest
from http.server import ThreadingHTTPServer
from pathlib import Path
from unittest.mock import patch

ROOT = Path(__file__).resolve().parents[1]
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

import serve

DOT_PNG = bytes(
    [
        0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A, 0x00, 0x00, 0x00, 0x0D,
        0x49, 0x48, 0x44, 0x52, 0x00, 0x00, 0x00, 0x01, 0x00, 0x00, 0x00, 0x01,
        0x08, 0x02, 0x00, 0x00, 0x00, 0x90, 0x77, 0x53, 0xDE, 0x00, 0x00, 0x00,
        0x0C, 0x49, 0x44, 0x41, 0x54, 0x08, 0xD7, 0x63, 0xF8, 0xCF, 0xC0, 0x00,
        0x00, 0x00, 0x03, 0x00, 0x01, 0x00, 0x05, 0xFE, 0xD4, 0xEF, 0x00, 0x00,
        0x00, 0x00, 0x49, 0x45, 0x4E, 0x44, 0xAE, 0x42, 0x60, 0x82,
    ]
)


class QuietHandler(serve.FaceFlowerHandler):
    def log_message(self, format: str, *args) -> None:
        return


class SavedPhotoNameTests(unittest.TestCase):
    def test_png_name_is_ok(self) -> None:
        self.assertTrue(serve.photo_name_ok("faceflower-20261018T003512.png"))

    def test_slash_in_name_is_rejected(self) -> None:
        self.assertFalse(serve.photo_name_ok("a/b.png"))

    def test_dotdot_name_is_rejected(self) -> None:
        self.assertFalse(serve.photo_name_ok("../LICENSE"))

    def test_txt_suffix_is_rejected(self) -> None:
        self.assertFalse(serve.photo_name_ok("notes.txt"))


class SavedPhotoEndpointTests(unittest.TestCase):
    def setUp(self) -> None:
        self._tmp = tempfile.TemporaryDirectory()
        self.saved = Path(self._tmp.name)
        serve.set_saved_dir(self.saved)
        self.server = ThreadingHTTPServer(("127.0.0.1", 0), QuietHandler)
        self.thread = threading.Thread(target=self.server.serve_forever, daemon=True)
        self.thread.start()
        self.port = self.server.server_address[1]

    def tearDown(self) -> None:
        self.server.shutdown()
        self.server.server_close()
        self.thread.join(timeout=2)
        serve.set_saved_dir(serve.ROOT / "saved")
        self._tmp.cleanup()

    def request(
        self,
        method: str,
        path: str,
        body: bytes | None = None,
        headers: dict[str, str] | None = None,
    ) -> tuple[int, dict[str, str], bytes]:
        conn = http.client.HTTPConnection("127.0.0.1", self.port, timeout=5)
        conn.request(method, path, body=body, headers=headers or {})
        response = conn.getresponse()
        payload = response.read()
        header_map = {key.lower(): value for key, value in response.getheaders()}
        status = response.status
        conn.close()
        return status, header_map, payload

    def test_list_is_empty_when_folder_has_no_photos(self) -> None:
        (self.saved / ".gitkeep").write_text("", encoding="utf-8")
        status, headers, payload = self.request("GET", "/saved-photos")
        self.assertEqual(status, 200)
        self.assertIn("application/json", headers.get("content-type", ""))
        self.assertEqual(json.loads(payload), {"names": []})

    def test_list_trailing_slash_matches_list(self) -> None:
        status, _headers, payload = self.request("GET", "/saved-photos/")
        self.assertEqual(status, 200)
        self.assertEqual(json.loads(payload), {"names": []})

    def test_insert_then_list_and_load_by_name(self) -> None:
        status, _headers, payload = self.request(
            "POST",
            "/saved-photos",
            body=DOT_PNG,
            headers={"Content-Type": "image/png"},
        )
        self.assertEqual(status, 200)
        name = json.loads(payload)["name"]
        self.assertTrue(serve.photo_name_ok(name))

        list_status, _list_headers, list_body = self.request("GET", "/saved-photos")
        self.assertEqual(list_status, 200)
        self.assertEqual(json.loads(list_body), {"names": [name]})

        get_status, get_headers, get_body = self.request("GET", f"/saved-photos/{name}")
        self.assertEqual(get_status, 200)
        self.assertEqual(get_headers.get("content-type"), "image/png")
        self.assertEqual(get_body, DOT_PNG)

    def test_load_missing_name_is_404(self) -> None:
        status, _headers, _payload = self.request("GET", "/saved-photos/missing.png")
        self.assertEqual(status, 404)

    def test_load_rejects_slash_in_name(self) -> None:
        status, _headers, _payload = self.request("GET", "/saved-photos/foo%2Fbar.png")
        self.assertEqual(status, 400)

    def test_load_rejects_dotdot_name(self) -> None:
        status, _headers, _payload = self.request("GET", "/saved-photos/..%2FLICENSE")
        self.assertEqual(status, 400)

    def test_load_rejects_txt_suffix(self) -> None:
        status, _headers, _payload = self.request("GET", "/saved-photos/notes.txt")
        self.assertEqual(status, 400)

    def test_jpg_in_folder_is_listed_and_loaded(self) -> None:
        (self.saved / "plate.jpg").write_bytes(b"jpeg-bytes")
        status, _headers, payload = self.request("GET", "/saved-photos")
        self.assertEqual(status, 200)
        self.assertEqual(json.loads(payload), {"names": ["plate.jpg"]})
        get_status, get_headers, get_body = self.request("GET", "/saved-photos/plate.jpg")
        self.assertEqual(get_status, 200)
        self.assertEqual(get_headers.get("content-type"), "image/jpeg")
        self.assertEqual(get_body, b"jpeg-bytes")

    def test_insert_missing_length_is_411(self) -> None:
        conn = http.client.HTTPConnection("127.0.0.1", self.port, timeout=5)
        conn.putrequest("POST", "/saved-photos")
        conn.putheader("Content-Type", "image/png")
        conn.endheaders()
        response = conn.getresponse()
        status = response.status
        response.read()
        conn.close()
        self.assertEqual(status, 411)

    def test_insert_over_limit_is_413(self) -> None:
        with patch.object(serve, "MAX_INSERT_BYTES", 8):
            status, _headers, _payload = self.request(
                "POST",
                "/saved-photos",
                body=DOT_PNG,
                headers={"Content-Type": "image/png"},
            )
        self.assertEqual(status, 413)

    def test_post_unknown_path_is_404(self) -> None:
        status, _headers, _payload = self.request(
            "POST",
            "/other",
            body=DOT_PNG,
            headers={"Content-Type": "image/png"},
        )
        self.assertEqual(status, 404)


if __name__ == "__main__":
    unittest.main()
