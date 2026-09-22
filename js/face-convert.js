const FACE_MODEL_PATH = "/models/facefinder";
const WORKER_PATH = "/js/face-worker.js";
const DETECT_TIMEOUT_MS = 8000;

let picoWorker = null;
let picoReady = null;

function withTimeout(promise, ms, message) {
  return new Promise((resolve, reject) => {
    const timer = window.setTimeout(() => reject(new Error(message)), ms);
    promise.then(
      (value) => {
        window.clearTimeout(timer);
        resolve(value);
      },
      (error) => {
        window.clearTimeout(timer);
        reject(error);
      }
    );
  });
}

function addPicoWorker() {
  if (picoReady) {
    return picoReady;
  }
  picoWorker = new Worker(WORKER_PATH);
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
  if (onStatus) onStatus("loading", "Finding faces…");
  await withTimeout(addPicoWorker(), DETECT_TIMEOUT_MS, "Detector startup timed out");
  if (onStatus) onStatus("ready", "Local detector ready");
  return withTimeout(detectWithPico(sourceCanvas), DETECT_TIMEOUT_MS, "Face search timed out");
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
