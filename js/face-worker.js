importScripts("../vendor/pico.js");

const DETECT_MAX_EDGE = 640;
const MIN_SCORE = 12;
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

function equalizeGray(gray) {
  const hist = new Uint32Array(256);
  for (let i = 0; i < gray.length; i += 1) {
    hist[gray[i]] += 1;
  }
  const cdf = new Uint32Array(256);
  cdf[0] = hist[0];
  for (let i = 1; i < 256; i += 1) {
    cdf[i] = cdf[i - 1] + hist[i];
  }
  let minCdf = 0;
  for (let i = 0; i < 256; i += 1) {
    if (cdf[i] > 0) {
      minCdf = cdf[i];
      break;
    }
  }
  const span = gray.length - minCdf || 1;
  const out = new Uint8Array(gray.length);
  for (let i = 0; i < gray.length; i += 1) {
    out[i] = Math.round(((cdf[gray[i]] - minCdf) / span) * 255);
  }
  return out;
}

function scaleGray(pixels, width, height, workWidth, workHeight) {
  if (width === workWidth && height === workHeight) {
    return pixels;
  }
  const scaled = new Uint8Array(workWidth * workHeight);
  for (let y = 0; y < workHeight; y += 1) {
    const srcY = Math.min(height - 1, Math.round((y * (height - 1)) / Math.max(1, workHeight - 1)));
    for (let x = 0; x < workWidth; x += 1) {
      const srcX = Math.min(width - 1, Math.round((x * (width - 1)) / Math.max(1, workWidth - 1)));
      scaled[y * workWidth + x] = pixels[srcY * width + srcX];
    }
  }
  return scaled;
}

function runOnGray(pixels, workWidth, workHeight, scale) {
  const image = {
    pixels: pixels,
    nrows: workHeight,
    ncols: workWidth,
    ldim: workWidth,
  };
  const params = {
    shiftfactor: 0.1,
    minsize: Math.max(16, Math.round(Math.min(workWidth, workHeight) * 0.04)),
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

function findBoxes(width, height, rgba) {
  const scale = Math.min(1, DETECT_MAX_EDGE / Math.max(width, height));
  const workWidth = Math.max(1, Math.round(width * scale));
  const workHeight = Math.max(1, Math.round(height * scale));
  const gray = scaleGray(rgbaToGray(rgba, height, width), width, height, workWidth, workHeight);
  const equalized = equalizeGray(gray);
  return runOnGray(gray, workWidth, workHeight, scale).concat(
    runOnGray(equalized, workWidth, workHeight, scale)
  );
}

self.onmessage = (event) => {
  const message = event.data;
  try {
    if (message.type === "start") {
      const bytes = new Int8Array(message.cascade);
      classifyRegion = pico.unpack_cascade(bytes);
      self.postMessage({ type: "ready" });
      return;
    }
    if (message.type === "detect") {
      if (!classifyRegion) {
        throw new Error("Face engine is not ready");
      }
      const boxes = findBoxes(message.width, message.height, new Uint8ClampedArray(message.rgba));
      self.postMessage({ type: "boxes", boxes: boxes });
    }
  } catch (error) {
    self.postMessage({ type: "error", message: error.message || "Detect failed" });
  }
};
