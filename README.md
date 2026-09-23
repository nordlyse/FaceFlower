# FaceFlower

FaceFlower is a static HTML app that covers faces and license plates in a photo before you share it. Faces get flower icons. Plates get a **NO NUMBER** sticker. Detection and drawing run in the browser. Nothing is sent to a server.

The goal is GDPR-friendly sharing: people and children in the photo do not have to give consent if their faces are covered, and vehicle numbers stay hidden.

Live source: [github.com/nordlyse/FaceFlower](https://github.com/nordlyse/FaceFlower)

## How to use

1. Open the app in a browser (see [Run locally](#run-locally)).
2. Press **Upload** or drop a JPEG, PNG, or WebP photo onto the original pane.
3. Press **Convert**. The app looks for faces and plates, then draws covers on a copy of the photo.
4. Use **Cover size** − / + if the flowers or stickers should be smaller or larger.
5. Right-click (or click) a cover and choose **Remove flower** or **Remove label** if that person or plate should stay visible.
6. Press **Download** for a PNG named `faceflower.png`.

Photos are scaled so the long edge stays at 720 px, which keeps Convert responsive. EXIF rotation is applied when the browser loads the file.

## Run locally

The face model is loaded with `fetch`, so open the folder through HTTP rather than a `file://` URL.

```bash
python3 -m http.server 8080
```

Then open [http://127.0.0.1:8080/](http://127.0.0.1:8080/). Any other static file server works the same way.

## Tools and libraries

| Piece | Role | Licence |
| --- | --- | --- |
| HTML, CSS, and vanilla JavaScript | UI, convert flow, download | this repo |
| [pico.js](https://github.com/nenadmarkus/picojs) (`vendor/pico.js`) | Local face finder | MIT |
| `models/facefinder` | pico cascade model used by the face finder | shipped with pico |
| Canvas 2D (`js/flowers.js`) | Daisy, rose, tulip, sunflower, and blossom covers | this repo |
| `js/plates.js` | License-plate finder and NO NUMBER sticker | this repo |
| WebGL (`js/prism-bg.js`) | Full-page prism background | this repo |
| `python3 -m http.server` | Optional local static host | Python |

There is no npm install, no cloud vision API, and no extra runtime besides a browser.

**Face finder.** pico.js runs a packed cascade on grayscale pixels on the main thread. A copy of the canvas RGBA buffer is passed in so the detector reads the photo correctly.

**Plate finder.** `js/plates.js` looks for bright, wide rectangles with strong vertical edges (letter-like strokes), joins them, and skips boxes that overlap a face. It is a local heuristic, not a commercial ANPR product, so very small, blurred, or steeply angled plates can be missed. Wrong stickers can be removed with the context menu.

**Background.** The prism layer is a small WebGL raymarch in `js/prism-bg.js`. The look is close to [React Bits Prism](https://reactbits.dev/backgrounds/prism) (MIT). The shader in this repo is original.

Third-party libraries are limited to MIT or Apache-2.0.

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

pico.js is MIT (see `vendor/LICENSE-pico.txt`). App code in this repository follows the same MIT terms unless a file says otherwise.
