# FaceFlower

FaceFlower covers faces and license plates in a photo before you share it. Faces get flower icons. Plates get a **NO NUMBER** sticker. Detection and drawing run in the browser. Convert does not upload the photo.

An optional local host (`serve.py`) serves the page and a small REST API for photos stored in `saved/`.

The goal is GDPR-friendly sharing: people and children in the photo do not have to give consent if their faces are covered, and vehicle numbers stay hidden.

Live source: [github.com/nordlyse/FaceFlower](https://github.com/nordlyse/FaceFlower)

## How to use

1. Open the app in a browser (see [Run locally](#run-locally)). The header jumps to **Home**, **About**, **Projects**, and **Help** on this page. **Light** and **Dark** next to Ready switch the page background. Dark is the default.
2. Press **Upload** or drop a JPEG, PNG, or WebP photo onto the original pane.
3. Press **Convert**. The app looks for faces and plates, then draws covers on a copy of the photo.
4. Use **Cover size** − / + if the flowers or stickers should be smaller or larger.
5. Right-click (or click) a cover and choose **Remove flower** or **Remove plate** if that person or plate should stay visible. For a plate sticker that missed the number, choose **Move plate** (or drag the sticker) and drop it on the plate.
6. Press **Download** for a PNG. With `python3 serve.py`, a copy is also stored under `saved/` and the file name is returned.

Photos are scaled so the long edge stays at 960 px, which keeps Convert responsive. EXIF rotation is applied when the browser loads the file.

## Run locally

The face model is loaded with `fetch`, so open the folder through HTTP rather than a `file://` URL. For the saved-photo endpoints, run the FaceFlower host:

```bash
python3 serve.py
```

Then open [http://127.0.0.1:8080/](http://127.0.0.1:8080/). If port 8080 is already in use:

```bash
FACEFLOWER_PORT=8765 python3 serve.py
```

`python3 -m http.server 8080` still serves the page, but it does not offer `/saved-photos`.

### REST API

Stored files live in `saved/`. Convert still runs in the browser. Download inserts a PNG into that folder when `serve.py` is running.

| Method | Path | Role |
| --- | --- | --- |
| `GET` | `/saved-photos` | JSON list of stored names: `{ "names": ["faceflower-20261018T003512.png"] }` |
| `GET` | `/saved-photos/{name}` | Photo bytes for that file name only |
| `POST` | `/saved-photos` | Insert a PNG body; the reply is `{ "name": "..." }` |
| `DELETE` | `/saved-photos/{name}` | Remove that stored photo; the reply is `{ "name": "..." }` |

The name in the get and delete path is the file name only. Names with `/`, `..`, or a suffix other than `.png`, `.jpg`, `.jpeg`, or `.webp` are rejected.

```bash
curl -sS http://127.0.0.1:8080/saved-photos
curl -sS -o out.png http://127.0.0.1:8080/saved-photos/faceflower-20261018T003512.png
curl -sS -X DELETE http://127.0.0.1:8080/saved-photos/faceflower-20261018T003512.png
```

### Tests

REST API tests use Python unittest (stdlib). They start a short-lived host and write into a temp folder, not into `saved/`.

```bash
python3 -m unittest tests.test_saved_photos
```

## Tools and libraries

The only third-party library shipped in this app is **pico.js** (MIT). Flowers, plate stickers, the convert flow, and the prism background are FaceFlower code in this repository.

| Piece | Role | Licence | In the repo? |
| --- | --- | --- | --- |
| [pico.js](https://github.com/nenadmarkus/picojs) (`vendor/pico.js`) | Local face finder | MIT | yes, vendored |
| `models/facefinder` | pico cascade used by the face finder | MIT (same pico.js project) | yes |
| HTML, CSS, `js/app.js`, `js/face-convert.js` | UI, convert, download | MIT (this repo) | yes |
| `serve.py` | Local host and saved-photo endpoints | MIT (this repo); uses Python stdlib | yes |
| `tests/test_saved_photos.py` | Saved-photo endpoint tests | MIT (this repo); Python unittest | yes |
| `js/flowers.js` | Flower covers (Canvas 2D) | MIT (this repo) | yes |
| `js/plates.js` | Plate finder and NO NUMBER sticker | MIT (this repo) | yes |
| `js/prism-bg.js` | Prism background (WebGL) | MIT (this repo) | yes |
| Canvas 2D and WebGL | Drawing APIs in the browser | browser platform | no extra package |
| `python3 -m http.server` | Local run only: optional static host | [PSF Licence](https://docs.python.org/3/license.html) | not shipped |
| [React Bits](https://reactbits.dev/) (Prism, Shiny Text) | Look reference only | MIT | not shipped |

There is no npm install, no CDN script, no cloud vision API, and no OpenCV / MediaPipe / TensorFlow build.

**Face finder.** pico.js runs a packed cascade on grayscale pixels on the main thread. A copy of the canvas RGBA buffer is passed in so the detector reads the photo correctly.

**Plate finder.** `js/plates.js` looks for bright, wide rectangles with strong vertical edges (letter-like strokes), joins them, and skips boxes that overlap a face. It is a local heuristic, not a commercial ANPR product, so very small, blurred, or steeply angled plates can be missed. Right-click (or click) a NO NUMBER sticker and choose **Move plate** to drag it onto the number, or **Remove plate** if that plate should stay visible. Dragging the sticker also works.

**Background.** The prism layer is a small WebGL raymarch in `js/prism-bg.js`. The look is close to [React Bits Prism](https://reactbits.dev/backgrounds/prism) (**MIT**). That package is **not** included; the shader in this repo is original FaceFlower code.

**Header and footer.** The sticky pill bar and the tall glass footer are FaceFlower CSS: Home, About, Projects, Help, plus GitHub, LinkedIn, and X buttons. The rainbow title sits in the home block. The credit line uses a [Shiny Text](https://reactbits.dev/text-animations/shiny-text) sweep. React Bits packages are **not** included.

Third-party libraries bundled with the app are limited to MIT or Apache-2.0. pico.js is MIT. Nothing Apache-2.0 is bundled today.

## Privacy

- Convert never uploads the photo.
- Face and plate work stays on the device.
- Download writes a PNG from the result canvas in the same tab. With `serve.py`, that PNG is also inserted into `saved/` on the same host. `saved/` is gitignored.

## Layout

```
LICENSE                       MIT and hobby notice
serve.py                      Local host and REST API
tests/test_saved_photos.py    REST API tests
saved/                        Stored PNGs (gitignored)
index.html                    App shell
css/app.css                   Layout and theme
js/app.js                     Upload, convert, size, menu, move plate, download
js/face-convert.js            Face pipeline and cover paint
js/flowers.js                 Flower drawing
js/plates.js                  Plate finder and sticker
js/prism-bg.js                Prism background
vendor/pico.js                Face library (MIT)
models/facefinder             Face cascade
```

## Disclaimer

FaceFlower is a hobby project. Use of this app is at your own risk. No liability is accepted for errors, bugs, missed faces or plates, photos that still identify people or vehicles, or any other outcome of running the software or sharing the output. The software is provided as-is, without warranty of any kind. The same points are in `LICENSE`.

## Licence

FaceFlower app files (HTML, CSS, `js/` except `vendor/pico.js`, `serve.py`, and `tests/`) use MIT, same as pico.js. Full text, including the hobby notice: `LICENSE`.

Third-party code that ships with the app:

- **pico.js** — MIT, Nenad Markus / [picojs](https://github.com/nenadmarkus/picojs). Full text: `vendor/LICENSE-pico.txt`.
- **models/facefinder** — face cascade from the same pico.js project, MIT under the same terms.

Not bundled. Listed only because they are used to run the page locally or as a look reference:

- **python3 -m http.server** and **unittest** — local run and REST API tests, [Python Software Foundation Licence](https://docs.python.org/3/license.html).
- **React Bits** (Prism, Shiny Text) — MIT look reference only. FaceFlower does not include React Bits, GSAP, or OGL.
