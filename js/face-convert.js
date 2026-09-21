const FACE_MODEL_PATH = "models/facefinder";
const DETECT_MAX_EDGE = 640;
const MIN_SCORE = 50;

let classifyRegion = null;

function rgbaToGray(rgba, nrows, ncols) {
  const gray = new Uint8Array(nrows * ncols);
  for (let r = 0; r < nrows; r += 1) {
    for (let c = 0; c < ncols; c += 1) {
      const i = (r * ncols + c) * 4;
      gray[r * ncols + c] = (2 * rgba[i] + 7 * rgba[i + 1] + rgba[i + 2]) >> 3;
    }
  }
  return gray;
}

async function startFaceEngine() {
  if (typeof pico === "undefined") {
    throw new Error("pico.js failed to load");
  }
  const response = await fetch(FACE_MODEL_PATH);
  if (!response.ok) {
    throw new Error("Face model could not be loaded");
  }
  const bytes = new Int8Array(await response.arrayBuffer());
  classifyRegion = pico.unpack_cascade(bytes);
  return true;
}

function findFaceBoxes(sourceCanvas) {
  if (!classifyRegion) {
    throw new Error("Face engine is not ready");
  }

  const scale = Math.min(1, DETECT_MAX_EDGE / Math.max(sourceCanvas.width, sourceCanvas.height));
  const workWidth = Math.max(1, Math.round(sourceCanvas.width * scale));
  const workHeight = Math.max(1, Math.round(sourceCanvas.height * scale));
  const workCanvas = document.createElement("canvas");
  workCanvas.width = workWidth;
  workCanvas.height = workHeight;
  const workCtx = workCanvas.getContext("2d", { willReadFrequently: true });
  workCtx.drawImage(sourceCanvas, 0, 0, workWidth, workHeight);
  const imageData = workCtx.getImageData(0, 0, workWidth, workHeight);

  const image = {
    pixels: rgbaToGray(imageData.data, workHeight, workWidth),
    nrows: workHeight,
    ncols: workWidth,
    ldim: workWidth,
  };
  const params = {
    shiftfactor: 0.1,
    minsize: Math.max(24, Math.round(Math.min(workWidth, workHeight) * 0.08)),
    maxsize: Math.min(workWidth, workHeight),
    scalefactor: 1.1,
  };

  let dets = pico.run_cascade(image, classifyRegion, params);
  dets = pico.cluster_detections(dets, 0.2);

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

function convertSourceToFlowers(sourceCanvas, resultCanvas) {
  resultCanvas.width = sourceCanvas.width;
  resultCanvas.height = sourceCanvas.height;
  const ctx = resultCanvas.getContext("2d");
  ctx.drawImage(sourceCanvas, 0, 0);
  const boxes = findFaceBoxes(sourceCanvas);
  boxes.forEach((box, index) => coverFaceWithFlower(ctx, box, index));
  return boxes.length;
}
