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
let engineReady = false;

function setEngineStatus(state, text) {
  engineStatus.dataset.state = state;
  engineStatus.textContent = text;
}

function setConvertStatus(text) {
  convertStatus.textContent = text;
}

function refreshButtons() {
  convertButton.disabled = !(engineReady && sourceReady);
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
}

function clearResult() {
  resultReady = false;
  resultCanvas.hidden = true;
  resultPlaceholder.hidden = false;
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
    sourceCanvas.width = image.naturalWidth;
    sourceCanvas.height = image.naturalHeight;
    const ctx = sourceCanvas.getContext("2d");
    ctx.drawImage(image, 0, 0);
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

function onConvertClick() {
  if (!engineReady || !sourceReady) {
    return;
  }

  convertButton.disabled = true;
  setConvertStatus("Finding faces…");

  window.setTimeout(() => {
    try {
      const count = convertSourceToFlowers(sourceCanvas, resultCanvas);
      showCanvas(resultCanvas, resultPlaceholder);
      resultReady = true;
      if (count === 0) {
        setConvertStatus("No faces found. Try a clearer frontal photo.");
      } else {
        setConvertStatus(
          count === 1 ? "Covered 1 face with a flower." : `Covered ${count} faces with flowers.`
        );
      }
    } catch (error) {
      resultReady = false;
      setConvertStatus(error.message || "Convert failed.");
    }
    refreshButtons();
  }, 30);
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
  refreshButtons();

  startFaceEngine()
    .then(() => {
      engineReady = true;
      setEngineStatus("ready", "Face engine ready");
      refreshButtons();
    })
    .catch((error) => {
      engineReady = false;
      setEngineStatus("error", "Face engine failed");
      setConvertStatus(error.message || "Face engine failed to start.");
      refreshButtons();
    });
}

startApp();
