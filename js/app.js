const uploadButton = document.getElementById("upload-button");
const convertButton = document.getElementById("convert-button");
const downloadButton = document.getElementById("download-button");
const fileInput = document.getElementById("file-input");
const sourceCanvas = document.getElementById("source-canvas");
const resultCanvas = document.getElementById("result-canvas");
const sourcePlaceholder = document.getElementById("source-placeholder");
const resultPlaceholder = document.getElementById("result-placeholder");
const sourceFrame = document.getElementById("source-frame");
const engineStatus = document.getElementById("engine-status");
const convertStatus = document.getElementById("convert-status");

let sourceReady = false;
let resultReady = false;
let converting = false;

const MAX_SOURCE_EDGE = 960;

function setEngineStatus(state, text) {
  engineStatus.dataset.state = state;
  engineStatus.textContent = text;
}

function setConvertStatus(text) {
  convertStatus.textContent = text;
}

function refreshButtons() {
  convertButton.disabled = !sourceReady || converting;
  downloadButton.disabled = !resultReady;
}

function bindSpotlight(card) {
  card.addEventListener("pointermove", (event) => {
    const rect = card.getBoundingClientRect();
    card.style.setProperty("--spot-x", `${event.clientX - rect.left}px`);
    card.style.setProperty("--spot-y", `${event.clientY - rect.top}px`);
  });
}

function showCanvas(canvas, placeholder) {
  canvas.hidden = false;
  placeholder.hidden = true;
  placeholder.classList.add("is-off");
}

function clearResult() {
  resultReady = false;
  resultCanvas.hidden = true;
  resultPlaceholder.hidden = false;
  resultPlaceholder.classList.remove("is-off");
  refreshButtons();
}

function insertUploadedPhoto(file) {
  if (!file || !file.type.startsWith("image/")) {
    setConvertStatus("Please choose an image file.");
    return;
  }

  const url = URL.createObjectURL(file);
  const image = new Image();
  image.onload = () => {
    const scale = Math.min(
      1,
      MAX_SOURCE_EDGE / Math.max(image.naturalWidth, image.naturalHeight)
    );
    sourceCanvas.width = Math.max(1, Math.round(image.naturalWidth * scale));
    sourceCanvas.height = Math.max(1, Math.round(image.naturalHeight * scale));
    const ctx = sourceCanvas.getContext("2d");
    ctx.drawImage(image, 0, 0, sourceCanvas.width, sourceCanvas.height);
    URL.revokeObjectURL(url);
    sourceReady = true;
    showCanvas(sourceCanvas, sourcePlaceholder);
    clearResult();
    setConvertStatus("Photo ready. Press Convert to cover faces.");
    refreshButtons();
  };
  image.onerror = () => {
    URL.revokeObjectURL(url);
    setConvertStatus("That photo could not be read.");
  };
  image.src = url;
}

function onFileChosen(event) {
  const file = event.target.files && event.target.files[0];
  insertUploadedPhoto(file);
  fileInput.value = "";
}

async function onConvertClick() {
  if (!sourceReady || converting) {
    return;
  }

  converting = true;
  resultReady = false;
  refreshButtons();
  setConvertStatus("Finding faces…");

  try {
    const count = await convertSourceToFlowers(sourceCanvas, resultCanvas, setEngineStatus);
    if (count === 0) {
      resultReady = false;
      resultCanvas.hidden = true;
      resultPlaceholder.hidden = false;
      resultPlaceholder.classList.remove("is-off");
      setConvertStatus("No faces found. Try a clearer frontal photo.");
    } else {
      showCanvas(resultCanvas, resultPlaceholder);
      resultReady = true;
      setConvertStatus(
        count === 1 ? "Covered 1 face with a flower." : `Covered ${count} faces with flowers.`
      );
    }
  } catch (error) {
    resultReady = false;
    setEngineStatus("error", "Detector failed");
    setConvertStatus(error.message || "Convert failed.");
  }

  converting = false;
  refreshButtons();
}

function onDownloadClick() {
  if (!resultReady) {
    return;
  }
  resultCanvas.toBlob((blob) => {
    if (!blob) {
      setConvertStatus("Download failed.");
      return;
    }
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "faceflower.png";
    link.click();
    URL.revokeObjectURL(url);
  }, "image/png");
}

function bindDrop(frame) {
  frame.addEventListener("dragover", (event) => {
    event.preventDefault();
    frame.classList.add("is-hot");
  });
  frame.addEventListener("dragleave", () => frame.classList.remove("is-hot"));
  frame.addEventListener("drop", (event) => {
    event.preventDefault();
    frame.classList.remove("is-hot");
    const file = event.dataTransfer.files && event.dataTransfer.files[0];
    insertUploadedPhoto(file);
  });
}

function startApp() {
  bindSpotlight(document.getElementById("source-card"));
  bindSpotlight(document.getElementById("result-card"));
  bindDrop(sourceFrame);
  uploadButton.addEventListener("click", () => fileInput.click());
  fileInput.addEventListener("change", onFileChosen);
  convertButton.addEventListener("click", onConvertClick);
  downloadButton.addEventListener("click", onDownloadClick);
  setEngineStatus("ready", "Ready");
  refreshButtons();
}

startApp();
