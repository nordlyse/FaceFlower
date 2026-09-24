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
let lastPlateBoxes = [];
let flowerScale = 1.08;
let hoverCover = null;
let menuCover = null;

const MAX_SOURCE_EDGE = 720;
const FLOWER_SCALE_MIN = 0.5;
const FLOWER_SCALE_MAX = 2.2;
const FLOWER_SCALE_STEP = 0.08;

const flowerMenu = document.getElementById("flower-menu");
const removeCoverButton = document.getElementById("remove-cover-button");

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
  const faces = lastFaceBoxes.length;
  const plates = lastPlateBoxes.length;
  if (faces === 0 && plates === 0) {
    return "All covers removed. Photo is uncovered.";
  }
  const bits = [];
  if (faces === 1) {
    bits.push("1 face");
  } else if (faces > 1) {
    bits.push(`${faces} faces`);
  }
  if (plates === 1) {
    bits.push("1 plate");
  } else if (plates > 1) {
    bits.push(`${plates} plates`);
  }
  return `Covered ${bits.join(" and ")}. Right-click a cover and choose Remove flower or Remove plate.`;
}

function paintResult() {
  paintCoversOnResult(sourceCanvas, resultCanvas, lastFaceBoxes, lastPlateBoxes, flowerScale);
  if (!hoverCover) {
    return;
  }
  const ctx = resultCanvas.getContext("2d");
  if (hoverCover.kind === "flower" && lastFaceBoxes[hoverCover.index]) {
    markFlowerHover(ctx, lastFaceBoxes[hoverCover.index], flowerScale);
  } else if (hoverCover.kind === "plate" && lastPlateBoxes[hoverCover.index]) {
    markPlateHover(ctx, lastPlateBoxes[hoverCover.index], flowerScale);
  }
}

function hideFlowerMenu() {
  flowerMenu.hidden = true;
  menuCover = null;
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

function coverHitAt(x, y) {
  for (let i = lastPlateBoxes.length - 1; i >= 0; i -= 1) {
    if (pointInPlateLabel(x, y, lastPlateBoxes[i], flowerScale)) {
      return { kind: "plate", index: i };
    }
  }
  const flowerIndex = flowerIndexAt(x, y);
  if (flowerIndex >= 0) {
    return { kind: "flower", index: flowerIndex };
  }
  return null;
}

function sameCover(a, b) {
  return a && b && a.kind === b.kind && a.index === b.index;
}

function setHoverCover(hit) {
  resultCanvas.classList.toggle("is-over-flower", Boolean(hit));
  if (sameCover(hit, hoverCover)) {
    return;
  }
  hoverCover = hit;
  if (resultReady) {
    paintResult();
  }
}

function openCoverMenu(hit, clientX, clientY) {
  menuCover = hit;
  hoverCover = hit;
  resultCanvas.classList.add("is-over-flower");
  removeCoverButton.textContent = hit.kind === "plate" ? "Remove plate" : "Remove flower";
  paintResult();
  placeFlowerMenu(clientX, clientY);
}

function removeCover() {
  if (!menuCover) {
    hideFlowerMenu();
    return;
  }
  if (menuCover.kind === "flower" && menuCover.index >= 0 && menuCover.index < lastFaceBoxes.length) {
    lastFaceBoxes.splice(menuCover.index, 1);
  } else if (menuCover.kind === "plate" && menuCover.index >= 0 && menuCover.index < lastPlateBoxes.length) {
    lastPlateBoxes.splice(menuCover.index, 1);
  }
  hideFlowerMenu();
  hoverCover = null;
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
    setHoverCover(null);
    return;
  }
  setHoverCover(coverHitAt(point.x, point.y));
}

function onResultPointerLeave() {
  if (flowerMenu.hidden) {
    setHoverCover(null);
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
  const hit = coverHitAt(point.x, point.y);
  if (!hit) {
    hideFlowerMenu();
    return;
  }
  openCoverMenu(hit, event.clientX, event.clientY);
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
  const hit = coverHitAt(point.x, point.y);
  if (!hit) {
    hideFlowerMenu();
    return;
  }
  event.preventDefault();
  openCoverMenu(hit, event.clientX, event.clientY);
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
  lastPlateBoxes = [];
  hoverCover = null;
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
      setConvertStatus("Photo ready. Press Convert to cover faces and plates.");
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
  hoverCover = null;
  hideFlowerMenu();
  refreshButtons();
  setConvertStatus("Finding faces and plates…");

  try {
    const covers = await convertSourceToCovers(
      sourceCanvas,
      resultCanvas,
      setEngineStatus,
      flowerScale
    );
    lastFaceBoxes = covers.faces;
    lastPlateBoxes = covers.plates;
    if (covers.faces.length === 0 && covers.plates.length === 0) {
      resultReady = false;
      resultCanvas.hidden = true;
      resultPlaceholder.hidden = false;
      resultPlaceholder.classList.remove("is-off");
      setConvertStatus("No faces or plates found. Try a clearer photo.");
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
  hoverCover = null;
  resultCanvas.classList.remove("is-over-flower");
  hideFlowerMenu();
  paintCoversOnResult(sourceCanvas, resultCanvas, lastFaceBoxes, lastPlateBoxes, flowerScale);
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
  removeCoverButton.addEventListener("click", (event) => {
    event.stopPropagation();
    removeCover();
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
