const FACE_MODEL_PATH = "models/facefinder";
const DETECT_MAX_EDGE = 480;
const MIN_SCORE = 1;

let classifyRegion = null;

function copyRgbaBytes(imageData) {
  const src = imageData.data;
  const rgba = new Uint8Array(src.length);
  rgba.set(src);
  return rgba;
}

function stretchGray(gray) {
  let lo = 255;
  let hi = 0;
  for (let i = 0; i < gray.length; i += 1) {
    const v = gray[i];
    if (v < lo) lo = v;
    if (v > hi) hi = v;
  }
  if (hi - lo < 28) {
    return gray;
  }
  const out = new Uint8Array(gray.length);
  const scale = 255 / (hi - lo);
  for (let i = 0; i < gray.length; i += 1) {
    out[i] = Math.round((gray[i] - lo) * scale);
  }
  return out;
}

function rgbaToGray(rgba, nrows, ncols) {
  const gray = new Uint8Array(nrows * ncols);
  for (let r = 0; r < nrows; r += 1) {
    for (let c = 0; c < ncols; c += 1) {
      const i = (r * ncols + c) * 4;
      gray[r * ncols + c] = (rgba[i] * 77 + rgba[i + 1] * 150 + rgba[i + 2] * 29) >> 8;
    }
  }
  return gray;
}

async function startFaceEngine(onStatus) {
  if (classifyRegion) {
    return;
  }
  if (typeof pico === "undefined") {
    throw new Error("pico.js failed to load");
  }
  if (onStatus) onStatus("loading", "Loading face model…");
  const response = await fetch(FACE_MODEL_PATH);
  if (!response.ok) {
    throw new Error("Face model could not be loaded");
  }
  classifyRegion = pico.unpack_cascade(new Int8Array(await response.arrayBuffer()));
}

function findBoxesFromRgba(width, height, rgba) {
  const scale = Math.min(1, DETECT_MAX_EDGE / Math.max(width, height));
  const workWidth = Math.max(1, Math.round(width * scale));
  const workHeight = Math.max(1, Math.round(height * scale));
  const fullGray = stretchGray(rgbaToGray(rgba, height, width));
  let pixels = fullGray;
  if (scale !== 1) {
    pixels = new Uint8Array(workWidth * workHeight);
    for (let y = 0; y < workHeight; y += 1) {
      const srcY = Math.min(height - 1, Math.floor(y / scale));
      for (let x = 0; x < workWidth; x += 1) {
        const srcX = Math.min(width - 1, Math.floor(x / scale));
        pixels[y * workWidth + x] = fullGray[srcY * width + srcX];
      }
    }
  }

  const dets = pico.cluster_detections(
    pico.run_cascade(
      { pixels: pixels, nrows: workHeight, ncols: workWidth, ldim: workWidth },
      classifyRegion,
      {
        shiftfactor: 0.1,
        minsize: Math.max(16, Math.round(Math.min(workWidth, workHeight) * 0.028)),
        maxsize: Math.min(workWidth, workHeight),
        scalefactor: 1.08,
      }
    ),
    0.2
  );

  const boxes = [];
  for (let i = 0; i < dets.length; i += 1) {
    if (dets[i][3] < MIN_SCORE) {
      continue;
    }
    const size = dets[i][2];
    boxes.push({
      x: (dets[i][1] - size / 2) / scale,
      y: (dets[i][0] - size / 2) / scale,
      width: size / scale,
      height: size / scale,
    });
  }
  return boxes;
}

function findFaceBoxes(sourceCanvas) {
  const ctx = sourceCanvas.getContext("2d", { willReadFrequently: true });
  const imageData = ctx.getImageData(0, 0, sourceCanvas.width, sourceCanvas.height);
  const rgba = copyRgbaBytes(imageData);
  if (rgba.length !== sourceCanvas.width * sourceCanvas.height * 4) {
    throw new Error("Photo pixels could not be read");
  }
  return findBoxesFromRgba(sourceCanvas.width, sourceCanvas.height, rgba);
}

async function convertSourceToCovers(sourceCanvas, resultCanvas, onStatus, flowerScale) {
  await startFaceEngine(onStatus);
  if (onStatus) onStatus("ready", "Local detector ready");
  await new Promise((resolve) => window.setTimeout(resolve, 20));
  const ctx = sourceCanvas.getContext("2d", { willReadFrequently: true });
  const imageData = ctx.getImageData(0, 0, sourceCanvas.width, sourceCanvas.height);
  const rgba = copyRgbaBytes(imageData);
  if (rgba.length !== sourceCanvas.width * sourceCanvas.height * 4) {
    throw new Error("Photo pixels could not be read");
  }
  const faces = findBoxesFromRgba(sourceCanvas.width, sourceCanvas.height, rgba);
  faces.forEach((box, index) => {
    box.kindIndex = index;
  });
  const plates = findPlateBoxes(sourceCanvas.width, sourceCanvas.height, rgba, faces);
  paintCoversOnResult(sourceCanvas, resultCanvas, faces, plates, flowerScale);
  return { faces: faces, plates: plates };
}

function paintCoversOnResult(sourceCanvas, resultCanvas, faces, plates, flowerScale) {
  resultCanvas.width = sourceCanvas.width;
  resultCanvas.height = sourceCanvas.height;
  const ctx = resultCanvas.getContext("2d");
  ctx.drawImage(sourceCanvas, 0, 0);
  faces.forEach((box, index) => coverFaceWithFlower(ctx, box, index, flowerScale));
  plates.forEach((box) => coverPlateWithLabel(ctx, box, flowerScale));
}
