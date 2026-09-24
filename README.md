# FaceFlower

FaceFlower is a static HTML app that covers faces and license plates in a photo before you share it. Faces get flower icons. Plates get a **NO NUMBER** sticker. Detection and drawing run in the browser. Nothing is sent to a server.

The goal is GDPR-friendly sharing: people and children in the photo do not have to give consent if their faces are covered, and vehicle numbers stay hidden.

Live source: [github.com/nordlyse/FaceFlower](https://github.com/nordlyse/FaceFlower)

## How to use

1. Open the app in a browser (see [Run locally](#run-locally)).
2. Press **Upload** or drop a JPEG, PNG, or WebP photo onto the original pane.
3. Press **Convert**. The app looks for faces and plates, then draws covers on a copy of the photo.
4. Use **Cover size** − / + if the flowers or stickers should be smaller or larger.
5. Right-click (or click) a cover and choose **Remove flower** or **Remove plate** if that person or plate should stay visible.
6. Press **Download** for a PNG named `faceflower.png`.

Photos are scaled so the long edge stays at 720 px, which keeps Convert responsive. EXIF rotation is applied when the browser loads the file.

## Run locally

The face model is loaded with `fetch`, so open the folder through HTTP rather than a `file://` URL.

```bash
python3 -m http.server 8080
```

Then open [http://127.0.0.1:8080/](http://127.0.0.1:8080/). Any other static file server works the same way.

## Tools and libraries

The only third-party library shipped in this app is **pico.js** (MIT). Flowers, plate stickers, the convert flow, and the prism background are FaceFlower code in this repository.

| Piece | Role | Licence | In the repo? |
| --- | --- | --- | --- |
| [pico.js](https://github.com/nenadmarkus/picojs) (`vendor/pico.js`) | Local face finder | MIT | yes, vendored |
| `models/facefinder` | pico cascade used by the face finder | MIT (same pico.js project) | yes |
| HTML, CSS, `js/app.js`, `js/face-convert.js` | UI, convert, download | MIT (this repo) | yes |
| `js/flowers.js` | Flower covers (Canvas 2D) | MIT (this repo) | yes |
| `js/plates.js` | Plate finder and NO NUMBER sticker | MIT (this repo) | yes |
| `js/prism-bg.js` | Prism background (WebGL) | MIT (this repo) | yes |
| Canvas 2D and WebGL | Drawing APIs in the browser | browser platform | no extra package |
| `python3 -m http.server` | Optional local static host | [PSF Licence](https://docs.python.org/3/license.html) | not shipped |

There is no npm install, no CDN script, no cloud vision API, and no OpenCV / MediaPipe / TensorFlow build.

**Face finder.** pico.js runs a packed cascade on grayscale pixels on the main thread. A copy of the canvas RGBA buffer is passed in so the detector reads the photo correctly.

**Plate finder.** `js/plates.js` looks for bright, wide rectangles with strong vertical edges (letter-like strokes), joins them, and skips boxes that overlap a face. It is a local heuristic, not a commercial ANPR product, so very small, blurred, or steeply angled plates can be missed. Wrong stickers can be removed with the context menu.

**Background.** The prism layer is a small WebGL raymarch in `js/prism-bg.js`. The look is close to [React Bits Prism](https://reactbits.dev/backgrounds/prism) (**MIT**). That package is **not** included; the shader in this repo is original FaceFlower code.

Third-party libraries bundled with the app are limited to MIT or Apache-2.0. pico.js is MIT. Nothing Apache-2.0 is bundled today.

## Privacy

- Convert never uploads the photo.
- Face and plate work stays on the device.
- Download writes a PNG from the result canvas in the same tab.

## Layout

```
index.html          App shell
css/app.css         Layout and theme
js/app.js           Upload, convert, size, menu, download
js/face-convert.js  Face pipeline and cover paint
js/flowers.js       Flower drawing
js/plates.js        Plate finder and sticker
js/prism-bg.js      Prism background
vendor/pico.js      Face library (MIT)
models/facefinder   Face cascade
```

## Licence

Third-party code that ships with the app:

- **pico.js** — MIT, Nenad Markus / [picojs](https://github.com/nenadmarkus/picojs). Full text: `vendor/LICENSE-pico.txt`.
- **models/facefinder** — face cascade from the same pico.js project, MIT under the same terms.

Not bundled, listed only because they show up in docs or local run:

- **python3 -m http.server** — optional host, [Python Software Foundation Licence](https://docs.python.org/3/license.html).
- **React Bits Prism** — MIT look reference only. FaceFlower does not include React Bits or OGL.

FaceFlower app files (HTML, CSS, and `js/` except `vendor/pico.js`) use MIT, same as pico.js, unless a file says otherwise.
