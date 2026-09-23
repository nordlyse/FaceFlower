const uploadButton = document.getElementById("upload-button");
const convertButton = document.getElementById("convert-button");
const downloadButton = document.getElementById("download-button");
const sizeDownButton = document.getElementById("size-down-button");
const sizeUpButton = document.getElementById("size-up-button");
const sizeValue = document.getElementById("size-value");
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
let lastFaceBoxes = [];
let flowerScale = 1.08;
let hoverFlowerIndex = -1;
let menuFlowerIndex = -1;

const MAX_SOURCE_EDGE = 720;
const FLOWER_SCALE_MIN = 0.5;
const FLOWER_SCALE_MAX = 2.2;
const FLOWER_SCALE_STEP = 0.08;

const flowerMenu = document.getElementById("flower-menu");
const removeFlowerButton = document.getElementById("remove-flower-button");

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
  sizeDownButton.disabled = flowerScale <= FLOWER_SCALE_MIN + 0.001;
  sizeUpButton.disabled = flowerScale >= FLOWER_SCALE_MAX - 0.001;
}

function refreshSizeLabel() {
  sizeValue.textContent = `${Math.round(flowerScale * 100)}%`;
}

function applyFlowerSize(nextScale) {
  flowerScale = Math.min(FLOWER_SCALE_MAX, Math.max(FLOWER_SCALE_MIN, nextScale));
  flowerScale = Math.round(flowerScale * 100) / 100;
  refreshSizeLabel();
  refreshButtons();
  if (resultReady) {
    paintResult();
  }
}

function coverStatusText() {
  if (lastFaceBoxes.length === 0) {
    return "All flowers removed. Faces are visible.";
  }
  if (lastFaceBoxes.length === 1) {
    return "Covered 1 face. Right-click the flower to uncover it.";
  }
  return `Covered ${lastFaceBoxes.length} faces. Right-click a flower to uncover a face.`;
}

function paintResult() {
  paintFlowersOnResult(sourceCanvas, resultCanvas, lastFaceBoxes, flowerScale);
  if (hoverFlowerIndex >= 0 && lastFaceBoxes[hoverFlowerIndex]) {
    markFlowerHover(resultCanvas.getContext("2d"), lastFaceBoxes[hoverFlowerIndex], flowerScale);
  }
}

function hideFlowerMenu() {
  flowerMenu.hidden = true;
  menuFlowerIndex = -1;
}

function placeFlowerMenu(clientX, clientY) {
  flowerMenu.hidden = false;
  const pad = 8;
  const menuWidth = flowerMenu.offsetWidth;
  const menuHeight = flowerMenu.offsetHeight;
  const left = Math.min(clientX, window.innerWidth - menuWidth - pad);
  const top = Math.min(clientY, window.innerHeight - menuHeight - pad);
  flowerMenu.style.left = `${Math.max(pad, left)}px`;
  flowerMenu.style.top = `${Math.max(pad, top)}px`;
}

function pointOnResultCanvas(event) {
  const rect = resultCanvas.getBoundingClientRect();
  if (rect.width < 1 || rect.height < 1) {
    return null;
  }
  return {
    x: ((event.clientX - rect.left) / rect.width) * resultCanvas.width,
    y: ((event.clientY - rect.top) / rect.height) * resultCanvas.height,
  };
}

function flowerIndexAt(x, y) {
  for (let i = lastFaceBoxes.length - 1; i >= 0; i -= 1) {
    const box = lastFaceBoxes[i];
    const cx = box.x + box.width / 2;
    const cy = box.y + box.height / 2;
    const radius = flowerCoverRadius(box, flowerScale);
    const dx = x - cx;
    const dy = y - cy;
    if (dx * dx + dy * dy <= radius * radius) {
      return i;
    }
  }
  return -1;
}

function setHoverFlower(index) {
  resultCanvas.classList.toggle("is-over-flower", index >= 0);
  if (index === hoverFlowerIndex) {
    return;
  }
  hoverFlowerIndex = index;
  if (resultReady) {
    paintResult();
  }
}

function openFlowerMenu(index, clientX, clientY) {
  menuFlowerIndex = index;
  hoverFlowerIndex = index;
  resultCanvas.classList.add("is-over-flower");
  paintResult();
  placeFlowerMenu(clientX, clientY);
}

function removeCoveredFace() {
  if (menuFlowerIndex < 0 || menuFlowerIndex >= lastFaceBoxes.length) {
    hideFlowerMenu();
    return;
  }
  lastFaceBoxes.splice(menuFlowerIndex, 1);
  hideFlowerMenu();
  hoverFlowerIndex = -1;
  resultCanvas.classList.remove("is-over-flower");
  paintResult();
  setConvertStatus(coverStatusText());
}

function onResultPointerMove(event) {
  if (!resultReady) {
    return;
  }
  const point = pointOnResultCanvas(event);
  if (!point) {
    setHoverFlower(-1);
    return;
  }
  setHoverFlower(flowerIndexAt(point.x, point.y));
}

function onResultPointerLeave() {
  if (flowerMenu.hidden) {
    setHoverFlower(-1);
  }
}

function onResultContextMenu(event) {
  if (!resultReady) {
    return;
  }
  event.preventDefault();
  const point = pointOnResultCanvas(event);
  if (!point) {
    hideFlowerMenu();
    return;
  }
  const index = flowerIndexAt(point.x, point.y);
  if (index < 0) {
    hideFlowerMenu();
    return;
  }
  openFlowerMenu(index, event.clientX, event.clientY);
}

function onResultClick(event) {
  if (!resultReady) {
    return;
  }
  const point = pointOnResultCanvas(event);
  if (!point) {
    hideFlowerMenu();
    return;
  }
  const index = flowerIndexAt(point.x, point.y);
  if (index < 0) {
    hideFlowerMenu();
    return;
  }
  event.preventDefault();
  openFlowerMenu(index, event.clientX, event.clientY);
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
  lastFaceBoxes = [];
  hoverFlowerIndex = -1;
  hideFlowerMenu();
  resultCanvas.classList.remove("is-over-flower");
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

  loadOrientedPhoto(file)
    .then((bitmap) => {
      const scale = Math.min(
        1,
        MAX_SOURCE_EDGE / Math.max(bitmap.width, bitmap.height)
      );
      sourceCanvas.width = Math.max(1, Math.round(bitmap.width * scale));
      sourceCanvas.height = Math.max(1, Math.round(bitmap.height * scale));
      const ctx = sourceCanvas.getContext("2d");
      ctx.drawImage(bitmap, 0, 0, sourceCanvas.width, sourceCanvas.height);
      if (typeof bitmap.close === "function") {
        bitmap.close();
      }
      sourceReady = true;
      showCanvas(sourceCanvas, sourcePlaceholder);
      clearResult();
      setConvertStatus("Photo ready. Press Convert to cover faces.");
      refreshButtons();
    })
    .catch(() => {
      setConvertStatus("That photo could not be read.");
    });
}

function loadOrientedPhoto(file) {
  if (typeof createImageBitmap === "function") {
    return createImageBitmap(file, { imageOrientation: "from-image" }).catch(() =>
      createImageBitmap(file)
    );
  }
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const image = new Image();
    image.onload = () => {
      URL.revokeObjectURL(url);
      resolve(image);
    };
    image.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("read failed"));
    };
    image.src = url;
  });
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
  hoverFlowerIndex = -1;
  hideFlowerMenu();
  refreshButtons();
  setConvertStatus("Finding faces…");

  try {
    const boxes = await convertSourceToFlowers(
      sourceCanvas,
      resultCanvas,
      setEngineStatus,
      flowerScale
    );
    lastFaceBoxes = boxes;
    if (boxes.length === 0) {
      resultReady = false;
      resultCanvas.hidden = true;
      resultPlaceholder.hidden = false;
      resultPlaceholder.classList.remove("is-off");
      setConvertStatus("No faces found. Try a clearer frontal photo.");
    } else {
      showCanvas(resultCanvas, resultPlaceholder);
      resultReady = true;
      setConvertStatus(coverStatusText());
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
  hoverFlowerIndex = -1;
  resultCanvas.classList.remove("is-over-flower");
  hideFlowerMenu();
  paintFlowersOnResult(sourceCanvas, resultCanvas, lastFaceBoxes, flowerScale);
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
  sizeDownButton.addEventListener("click", () => applyFlowerSize(flowerScale - FLOWER_SCALE_STEP));
  sizeUpButton.addEventListener("click", () => applyFlowerSize(flowerScale + FLOWER_SCALE_STEP));
  resultCanvas.addEventListener("pointermove", onResultPointerMove);
  resultCanvas.addEventListener("pointerleave", onResultPointerLeave);
  resultCanvas.addEventListener("click", onResultClick);
  resultCanvas.addEventListener("contextmenu", onResultContextMenu);
  removeFlowerButton.addEventListener("click", (event) => {
    event.stopPropagation();
    removeCoveredFace();
  });
  flowerMenu.addEventListener("contextmenu", (event) => event.preventDefault());
  document.addEventListener("click", (event) => {
    if (!flowerMenu.hidden && !flowerMenu.contains(event.target) && event.target !== resultCanvas) {
      hideFlowerMenu();
    }
  });
  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape") {
      hideFlowerMenu();
    }
  });
  window.addEventListener("resize", hideFlowerMenu);
  setEngineStatus("ready", "Ready");
  refreshSizeLabel();
  refreshButtons();
}

startApp();
