const FACE_MODEL_PATH = "models/facefinder";

let nativeDetector = null;
let picoWorker = null;
let picoReady = null;

function mapNativeBoxes(faces) {
  return faces.map((face) => {
    const box = face.boundingBox;
    return {
      x: box.x ?? box.left ?? 0,
      y: box.y ?? box.top ?? 0,
      width: box.width,
      height: box.height,
    };
  }).filter((box) => box.width > 8 && box.height > 8);
}

function overlapScore(a, b) {
  const x = Math.max(a.x, b.x);
  const y = Math.max(a.y, b.y);
  const w = Math.min(a.x + a.width, b.x + b.width) - x;
  const h = Math.min(a.y + a.height, b.y + b.height) - y;
  if (w <= 0 || h <= 0) {
    return 0;
  }
  const inter = w * h;
  const union = a.width * a.height + b.width * b.height - inter;
  return inter / union;
}

function mergeBoxes(boxes) {
  const sorted = boxes.slice().sort((a, b) => b.width * b.height - a.width * a.height);
  const kept = [];
  sorted.forEach((box) => {
    const duplicate = kept.some((other) => overlapScore(box, other) > 0.3);
    if (!duplicate) {
      kept.push(box);
    }
  });
  return kept;
}

function addNativeDetector() {
  if (typeof FaceDetector !== "function") {
    return null;
  }
  try {
    return new FaceDetector({ fastMode: true, maxDetectedFaces: 25 });
  } catch (error) {
    return null;
  }
}

function addPicoWorker() {
  if (picoReady) {
    return picoReady;
  }
  picoWorker = new Worker("js/face-worker.js");
  picoReady = new Promise((resolve, reject) => {
    const onMessage = (event) => {
      const message = event.data;
      if (message.type === "ready") {
        picoWorker.removeEventListener("message", onMessage);
        resolve(true);
      } else if (message.type === "error") {
        picoWorker.removeEventListener("message", onMessage);
        reject(new Error(message.message));
      }
    };
    picoWorker.addEventListener("message", onMessage);
    picoWorker.onerror = () => reject(new Error("Face worker failed"));
    fetch(FACE_MODEL_PATH)
      .then((response) => {
        if (!response.ok) {
          throw new Error("Face model could not be loaded");
        }
        return response.arrayBuffer();
      })
      .then((buffer) => {
        picoWorker.postMessage({ type: "start", cascade: buffer }, [buffer]);
      })
      .catch(reject);
  });
  return picoReady;
}

function detectWithPico(sourceCanvas) {
  return new Promise((resolve, reject) => {
    const ctx = sourceCanvas.getContext("2d", { willReadFrequently: true });
    const imageData = ctx.getImageData(0, 0, sourceCanvas.width, sourceCanvas.height);
    const rgbaCopy = imageData.data.slice().buffer;
    const onMessage = (event) => {
      const message = event.data;
      if (message.type === "boxes") {
        picoWorker.removeEventListener("message", onMessage);
        resolve(message.boxes || []);
      } else if (message.type === "error") {
        picoWorker.removeEventListener("message", onMessage);
        reject(new Error(message.message));
      }
    };
    picoWorker.addEventListener("message", onMessage);
    picoWorker.postMessage(
      {
        type: "detect",
        width: sourceCanvas.width,
        height: sourceCanvas.height,
        rgba: rgbaCopy,
      },
      [rgbaCopy]
    );
  });
}

async function findFaceBoxes(sourceCanvas, onStatus) {
  const boxes = [];

  if (!nativeDetector) {
    nativeDetector = addNativeDetector();
  }
  if (nativeDetector) {
    try {
      boxes.push(...mapNativeBoxes(await nativeDetector.detect(sourceCanvas)));
    } catch (error) {
      nativeDetector = null;
    }
  }

  if (onStatus) onStatus("loading", "Starting local detector…");
  await addPicoWorker();
  if (onStatus) onStatus("ready", "Local detector ready");
  boxes.push(...(await detectWithPico(sourceCanvas)));
  return mergeBoxes(boxes);
}

async function convertSourceToFlowers(sourceCanvas, resultCanvas, onStatus) {
  resultCanvas.width = sourceCanvas.width;
  resultCanvas.height = sourceCanvas.height;
  const ctx = resultCanvas.getContext("2d");
  ctx.drawImage(sourceCanvas, 0, 0);
  const boxes = await findFaceBoxes(sourceCanvas, onStatus);
  boxes.forEach((box, index) => coverFaceWithFlower(ctx, box, index));
  return boxes.length;
}
