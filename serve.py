#!/usr/bin/env python3
"""FaceFlower local host: static files plus saved-photo endpoints. MIT, this repo."""

from __future__ import annotations

import json
import os
import re
from datetime import datetime, timezone
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.parse import unquote, urlparse

ROOT = Path(__file__).resolve().parent
SAVED_DIR = ROOT / "saved"
HOST = os.environ.get("FACEFLOWER_HOST", "127.0.0.1")
PORT = int(os.environ.get("FACEFLOWER_PORT", "8080"))
MAX_INSERT_BYTES = 8 * 1024 * 1024
NAME_PATTERN = re.compile(r"^[A-Za-z0-9][A-Za-z0-9._-]{0,199}$")
PHOTO_SUFFIXES = {".png", ".jpg", ".jpeg", ".webp"}
PHOTO_TYPES = {
    ".png": "image/png",
    ".jpg": "image/jpeg",
    ".jpeg": "image/jpeg",
    ".webp": "image/webp",
}


def set_saved_dir(path: Path) -> None:
    global SAVED_DIR
    SAVED_DIR = Path(path)


def ensure_saved_dir() -> None:
    SAVED_DIR.mkdir(parents=True, exist_ok=True)


def photo_name_ok(name: str) -> bool:
    if not NAME_PATTERN.fullmatch(name):
        return False
    suffix = Path(name).suffix.lower()
    return suffix in PHOTO_SUFFIXES


def saved_photo_path(name: str) -> Path | None:
    if not photo_name_ok(name):
        return None
    path = (SAVED_DIR / name).resolve()
    if not path.is_relative_to(SAVED_DIR.resolve()):
        return None
    return path


def list_saved_names() -> list[str]:
    ensure_saved_dir()
    names = [
        item.name
        for item in SAVED_DIR.iterdir()
        if item.is_file() and photo_name_ok(item.name)
    ]
    names.sort()
    return names


def next_saved_name() -> str:
    stamp = datetime.now(timezone.utc).strftime("%Y%m%dT%H%M%S")
    base = f"faceflower-{stamp}.png"
    path = saved_photo_path(base)
    if path is not None and not path.exists():
        return base
    for index in range(2, 1000):
        candidate = f"faceflower-{stamp}-{index}.png"
        next_path = saved_photo_path(candidate)
        if next_path is not None and not next_path.exists():
            return candidate
    raise RuntimeError("could not pick a saved photo name")


class FaceFlowerHandler(SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=str(ROOT), **kwargs)

    def do_GET(self) -> None:
        parsed = urlparse(self.path)
        path = unquote(parsed.path)
        if path in {"/saved-photos", "/saved-photos/"}:
            self.send_json(200, {"names": list_saved_names()})
            return
        if path.startswith("/saved-photos/"):
            name = path[len("/saved-photos/") :]
            self.send_saved_photo(name)
            return
        super().do_GET()

    def do_POST(self) -> None:
        parsed = urlparse(self.path)
        path = unquote(parsed.path)
        if path in {"/saved-photos", "/saved-photos/"}:
            self.insert_saved_photo()
            return
        self.send_error(404, "Not found")

    def do_DELETE(self) -> None:
        parsed = urlparse(self.path)
        path = unquote(parsed.path)
        if path in {"/saved-photos", "/saved-photos/"}:
            self.send_error(400, "Photo name required")
            return
        if path.startswith("/saved-photos/"):
            name = path[len("/saved-photos/") :]
            self.remove_saved_photo(name)
            return
        self.send_error(404, "Not found")

    def send_saved_photo(self, name: str) -> None:
        path = saved_photo_path(name)
        if path is None:
            self.send_error(400, "Bad photo name")
            return
        if not path.is_file():
            self.send_error(404, "Photo not found")
            return
        payload = path.read_bytes()
        suffix = path.suffix.lower()
        self.send_response(200)
        self.send_header("Content-Type", PHOTO_TYPES.get(suffix, "application/octet-stream"))
        self.send_header("Content-Length", str(len(payload)))
        self.send_header("Cache-Control", "no-store")
        self.end_headers()
        self.wfile.write(payload)

    def insert_saved_photo(self) -> None:
        length_header = self.headers.get("Content-Length")
        if length_header is None:
            self.send_error(411, "Length required")
            return
        try:
            length = int(length_header)
        except ValueError:
            self.send_error(400, "Bad length")
            return
        if length < 1 or length > MAX_INSERT_BYTES:
            self.send_error(413, "Photo too large")
            return
        body = self.rfile.read(length)
        if len(body) != length:
            self.send_error(400, "Incomplete photo")
            return
        ensure_saved_dir()
        try:
            name = next_saved_name()
        except RuntimeError:
            self.send_error(500, "Could not store photo")
            return
        path = saved_photo_path(name)
        if path is None:
            self.send_error(500, "Could not store photo")
            return
        path.write_bytes(body)
        self.send_json(200, {"name": name})

    def remove_saved_photo(self, name: str) -> None:
        path = saved_photo_path(name)
        if path is None:
            self.send_error(400, "Bad photo name")
            return
        if not path.is_file():
            self.send_error(404, "Photo not found")
            return
        path.unlink()
        self.send_json(200, {"name": name})

    def send_json(self, code: int, payload: dict) -> None:
        body = json.dumps(payload).encode("utf-8")
        self.send_response(code)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(body)))
        self.send_header("Cache-Control", "no-store")
        self.end_headers()
        self.wfile.write(body)

    def log_message(self, format: str, *args) -> None:
        super().log_message(format, *args)


def start_host(host: str = HOST, port: int = PORT) -> None:
    ensure_saved_dir()
    server = ThreadingHTTPServer((host, port), FaceFlowerHandler)
    print(f"FaceFlower at http://{host}:{port}/", flush=True)
    server.serve_forever()


if __name__ == "__main__":
    start_host()
