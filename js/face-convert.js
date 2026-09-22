const FACE_MODEL_PATH = "models/facefinder";

let nativeDetector = null;
let picoWorker = null;
let picoReady = null;

function mapNativeBoxes(faces) {
  return faces.map((face) => ({
    x: face.boundingBox.x,
    y: face.boundingBox.y,
    width: face.boundingBox.width,
    height: face.boundingBox.height,
  }));
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
    const onMessage = (event) => {
      const message = event.data;
      if (message.type === "boxes") {
        picoWorker.removeEventListener("message", onMessage);
        resolve(message.boxes);
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
        rgba: imageData.data.buffer,
      },
      [imageData.data.buffer]
    );
  });
}

async function findFaceBoxes(sourceCanvas, onStatus) {
  if (!nativeDetector) {
    nativeDetector = addNativeDetector();
  }

  if (nativeDetector) {
    try {
      if (onStatus) onStatus("ready", "Built-in detector");
      return mapNativeBoxes(await nativeDetector.detect(sourceCanvas));
    } catch (error) {
      nativeDetector = null;
    }
  }

  if (onStatus) onStatus("loading", "Starting local detector…");
  await addPicoWorker();
  if (onStatus) onStatus("ready", "Local detector ready");
  return detectWithPico(sourceCanvas);
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
