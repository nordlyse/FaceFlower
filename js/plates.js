const PLATE_MAX_EDGE = 480;
const PLATE_MAX_KEEP = 6;

function plateLabelRect(box, flowerScale) {
  const padX = box.width * ((flowerScale - 1) * 0.5 + 0.05);
  const padY = box.height * ((flowerScale - 1) * 0.5 + 0.16);
  return {
    x: box.x - padX,
    y: box.y - padY,
    width: box.width + padX * 2,
    height: box.height + padY * 2,
  };
}

function clampPlateBox(box, canvasWidth, canvasHeight, flowerScale) {
  const rect = plateLabelRect(box, flowerScale);
  let nextX = rect.x;
  let nextY = rect.y;
  if (rect.width <= canvasWidth) {
    nextX = Math.max(0, Math.min(canvasWidth - rect.width, rect.x));
  } else {
    nextX = (canvasWidth - rect.width) / 2;
  }
  if (rect.height <= canvasHeight) {
    nextY = Math.max(0, Math.min(canvasHeight - rect.height, rect.y));
  } else {
    nextY = (canvasHeight - rect.height) / 2;
  }
  box.x += nextX - rect.x;
  box.y += nextY - rect.y;
}

function pointInPlateLabel(x, y, box, flowerScale) {
  const rect = plateLabelRect(box, flowerScale);
  const slop = Math.max(4, Math.min(rect.width, rect.height) * 0.08);
  return (
    x >= rect.x - slop &&
    y >= rect.y - slop &&
    x <= rect.x + rect.width + slop &&
    y <= rect.y + rect.height + slop
  );
}

function boxIou(a, b) {
  const x1 = Math.max(a.x, b.x);
  const y1 = Math.max(a.y, b.y);
  const x2 = Math.min(a.x + a.width, b.x + b.width);
  const y2 = Math.min(a.y + a.height, b.y + b.height);
  const w = x2 - x1;
  const h = y2 - y1;
  if (w <= 0 || h <= 0) {
    return 0;
  }
  const overlap = w * h;
  return overlap / (a.width * a.height + b.width * b.height - overlap);
}

function nmsPlateBoxes(boxes, iouLimit) {
  const ranked = boxes.slice().sort((a, b) => b.score - a.score);
  const kept = [];
  for (let i = 0; i < ranked.length; i += 1) {
    const box = ranked[i];
    let ok = true;
    for (let j = 0; j < kept.length; j += 1) {
      if (boxIou(box, kept[j]) >= iouLimit) {
        ok = false;
        break;
      }
    }
    if (ok) {
      kept.push(box);
    }
  }
  return kept;
}

function downscaleRgbaAndGray(width, height, rgba, workWidth, workHeight) {
  const gray = new Uint8Array(workWidth * workHeight);
  const smallRgba = new Uint8Array(workWidth * workHeight * 4);
  const scaleX = width / workWidth;
  const scaleY = height / workHeight;
  for (let y = 0; y < workHeight; y += 1) {
    const srcY = Math.min(height - 1, Math.floor(y * scaleY));
    for (let x = 0; x < workWidth; x += 1) {
      const srcX = Math.min(width - 1, Math.floor(x * scaleX));
      const si = (srcY * width + srcX) * 4;
      const di = (y * workWidth + x) * 4;
      const r = rgba[si];
      const g = rgba[si + 1];
      const b = rgba[si + 2];
      smallRgba[di] = r;
      smallRgba[di + 1] = g;
      smallRgba[di + 2] = b;
      smallRgba[di + 3] = 255;
      gray[y * workWidth + x] = (r * 77 + g * 150 + b * 29) >> 8;
    }
  }
  return { gray: gray, rgba: smallRgba };
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

function plateColorOk(rgba, width, x, y, rw, rh) {
  let sat = 0;
  let lum = 0;
  let bright = 0;
  let n = 0;
  const stepX = Math.max(1, Math.floor(rw / 6));
  const stepY = Math.max(1, Math.floor(rh / 3));
  const x2 = x + rw;
  const y2 = y + rh;
  for (let py = y; py < y2; py += stepY) {
    for (let px = x; px < x2; px += stepX) {
      const i = (py * width + px) * 4;
      const r = rgba[i];
      const g = rgba[i + 1];
      const b = rgba[i + 2];
      const mx = Math.max(r, g, b);
      const mn = Math.min(r, g, b);
      sat += mx - mn;
      lum += (r * 77 + g * 150 + b * 29) >> 8;
      if (mx > 88) {
        bright += 1;
      }
      n += 1;
    }
  }
  if (n === 0) {
    return false;
  }
  const meanLum = lum / n;
  const meanSat = sat / n;
  if (meanLum < 28 && bright / n < 0.12) {
    return false;
  }
  if (meanSat > 150 && meanLum < 70) {
    return false;
  }
  return true;
}

function dilateHorizontal(bin, width, height, radius) {
  const out = new Uint8Array(width * height);
  const rad = Math.max(2, radius);
  const span = 2 * rad + 1;
  for (let y = 0; y < height; y += 1) {
    const row = y * width;
    let run = 0;
    for (let x = 0; x < width + rad; x += 1) {
      if (x < width) {
        run += bin[row + x];
      }
      if (x >= span) {
        run -= bin[row + x - span];
      }
      const cx = x - rad;
      if (cx >= 0 && cx < width && run > 0) {
        out[row + cx] = 1;
      }
    }
  }
  return out;
}

function dilateVertical(bin, width, height, radius) {
  const out = new Uint8Array(width * height);
  const rad = Math.max(1, radius);
  const span = 2 * rad + 1;
  for (let x = 0; x < width; x += 1) {
    let run = 0;
    for (let y = 0; y < height + rad; y += 1) {
      if (y < height) {
        run += bin[y * width + x];
      }
      if (y >= span) {
        run -= bin[(y - span) * width + x];
      }
      const cy = y - rad;
      if (cy >= 0 && cy < height && run > 0) {
        out[cy * width + x] = 1;
      }
    }
  }
  return out;
}

function blobBoxes(bin, width, height) {
  const seen = new Uint8Array(width * height);
  const boxes = [];
  const stack = [];
  for (let start = 0; start < bin.length; start += 1) {
    if (!bin[start] || seen[start]) {
      continue;
    }
    let minX = width;
    let minY = height;
    let maxX = 0;
    let maxY = 0;
    let area = 0;
    stack.push(start);
    seen[start] = 1;
    while (stack.length > 0) {
      const p = stack.pop();
      const x = p % width;
      const y = (p / width) | 0;
      area += 1;
      if (x < minX) minX = x;
      if (y < minY) minY = y;
      if (x > maxX) maxX = x;
      if (y > maxY) maxY = y;
      if (x > 0 && bin[p - 1] && !seen[p - 1]) {
        seen[p - 1] = 1;
        stack.push(p - 1);
      }
      if (x + 1 < width && bin[p + 1] && !seen[p + 1]) {
        seen[p + 1] = 1;
        stack.push(p + 1);
      }
      if (y > 0 && bin[p - width] && !seen[p - width]) {
        seen[p - width] = 1;
        stack.push(p - width);
      }
      if (y + 1 < height && bin[p + width] && !seen[p + width]) {
        seen[p + width] = 1;
        stack.push(p + width);
      }
    }
    boxes.push({
      x: minX,
      y: minY,
      width: maxX - minX + 1,
      height: maxY - minY + 1,
      area: area,
    });
  }
  return boxes;
}

function mergeAlignedPlates(boxes) {
  const merged = boxes.slice();
  let changed = true;
  while (changed) {
    changed = false;
    for (let i = 0; i < merged.length; i += 1) {
      for (let j = i + 1; j < merged.length; j += 1) {
        const a = merged[i];
        const b = merged[j];
        const yGap = Math.abs(a.y + a.height / 2 - (b.y + b.height / 2));
        const hGap = Math.abs(a.height - b.height);
        const xGap = a.x < b.x ? b.x - (a.x + a.width) : a.x - (b.x + a.width);
        if (yGap > Math.min(a.height, b.height) * 0.35) {
          continue;
        }
        if (hGap > Math.min(a.height, b.height) * 0.4) {
          continue;
        }
        if (xGap > Math.min(a.height, b.height) * 1.4) {
          continue;
        }
        const x = Math.min(a.x, b.x);
        const y = Math.min(a.y, b.y);
        const x2 = Math.max(a.x + a.width, b.x + b.width);
        const y2 = Math.max(a.y + a.height, b.y + b.height);
        merged[i] = {
          x: x,
          y: y,
          width: x2 - x,
          height: y2 - y,
          score: Math.max(a.score || 0, b.score || 0) + 1,
        };
        merged.splice(j, 1);
        changed = true;
        break;
      }
      if (changed) {
        break;
      }
    }
  }
  return merged;
}

function dropNestedBoxes(boxes) {
  const ranked = boxes.slice().sort((a, b) => b.width * b.height - a.width * a.height);
  const kept = [];
  for (let i = 0; i < ranked.length; i += 1) {
    const box = ranked[i];
    let nested = false;
    for (let j = 0; j < kept.length; j += 1) {
      const parent = kept[j];
      const inter =
        Math.max(0, Math.min(box.x + box.width, parent.x + parent.width) - Math.max(box.x, parent.x)) *
        Math.max(0, Math.min(box.y + box.height, parent.y + parent.height) - Math.max(box.y, parent.y));
      if (inter > box.width * box.height * 0.62) {
        nested = true;
        break;
      }
    }
    if (!nested) {
      kept.push(box);
    }
  }
  return kept;
}

function findPlateBoxes(width, height, rgba, faceBoxes) {
  const scale = Math.min(1, PLATE_MAX_EDGE / Math.max(width, height));
  const workWidth = Math.max(1, Math.round(width * scale));
  const workHeight = Math.max(1, Math.round(height * scale));
  const scaled = downscaleRgbaAndGray(width, height, rgba, workWidth, workHeight);
  const gray = stretchGray(scaled.gray);
  const gx = new Uint16Array(workWidth * workHeight);

  let gxSum = 0;
  for (let y = 0; y < workHeight; y += 1) {
    for (let x = 0; x < workWidth; x += 1) {
      const x0 = x === 0 ? 0 : x - 1;
      const x1 = x === workWidth - 1 ? x : x + 1;
      const mag = Math.abs(gray[y * workWidth + x1] - gray[y * workWidth + x0]);
      gx[y * workWidth + x] = mag;
      gxSum += mag;
    }
  }
  const gxMean = gxSum / (workWidth * workHeight);
  const gxCut = Math.max(10, Math.min(22, gxMean * 1.18));

  const bin = new Uint8Array(workWidth * workHeight);
  for (let i = 0; i < gx.length; i += 1) {
    if (gx[i] >= gxCut) {
      bin[i] = 1;
    }
  }

  const closed = dilateVertical(
    dilateHorizontal(bin, workWidth, workHeight, Math.max(5, Math.round(workWidth * 0.02))),
    workWidth,
    workHeight,
    2
  );
  const blobs = blobBoxes(closed, workWidth, workHeight);
  const minW = Math.max(22, Math.round(workWidth * 0.045));
  const minH = Math.max(8, Math.round(workHeight * 0.018));
  const maxH = Math.round(workHeight * 0.38);
  const maxW = Math.round(workWidth * 0.92);
  const candidates = [];

  for (let i = 0; i < blobs.length; i += 1) {
    const box = blobs[i];
    const aspect = box.width / Math.max(1, box.height);
    const fill = box.area / Math.max(1, box.width * box.height);
    if (box.width < minW || box.width > maxW || box.height < minH || box.height > maxH) {
      continue;
    }
    if (aspect < 1.55 || aspect > 8.8) {
      continue;
    }
    if (fill < 0.16 || fill > 0.98) {
      continue;
    }
    if (!plateColorOk(scaled.rgba, workWidth, box.x, box.y, box.width, box.height)) {
      continue;
    }
    const aspectFit = 1 / (1 + Math.abs(aspect - 4.6) * 0.12);
    box.score = aspectFit * fill * box.width;
    candidates.push(box);
  }

  const merged = dropNestedBoxes(mergeAlignedPlates(candidates));
  const picked = nmsPlateBoxes(merged, 0.35).slice(0, PLATE_MAX_KEEP);
  const facesWork = (faceBoxes || []).map((box) => ({
    x: box.x * scale,
    y: box.y * scale,
    width: box.width * scale,
    height: box.height * scale,
  }));

  const plates = [];
  for (let i = 0; i < picked.length; i += 1) {
    const box = picked[i];
    let blocked = false;
    for (let f = 0; f < facesWork.length; f += 1) {
      if (boxIou(box, facesWork[f]) > 0.4) {
        blocked = true;
        break;
      }
    }
    if (blocked) {
      continue;
    }
    plates.push({
      x: box.x / scale,
      y: box.y / scale,
      width: box.width / scale,
      height: box.height / scale,
    });
  }
  return plates;
}

function fillRoundRect(ctx, x, y, w, h, radius) {
  const r = Math.max(2, Math.min(radius, w / 2, h / 2));
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + r);
  ctx.lineTo(x + w, y + h - r);
  ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  ctx.lineTo(x + r, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - r);
  ctx.lineTo(x, y + r);
  ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.closePath();
}

function insertNoNumberMark(ctx, size) {
  ctx.beginPath();
  ctx.arc(0, 0, size, 0, Math.PI * 2);
  ctx.fillStyle = "#e23b4a";
  ctx.fill();
  ctx.beginPath();
  ctx.arc(0, 0, size * 0.62, 0, Math.PI * 2);
  ctx.fillStyle = "#fff6e8";
  ctx.fill();
  ctx.save();
  ctx.rotate(-0.72);
  ctx.fillStyle = "#e23b4a";
  ctx.fillRect(-size * 0.92, -size * 0.14, size * 1.84, size * 0.28);
  ctx.restore();
}

function coverPlateWithLabel(ctx, box, flowerScale) {
  const rect = plateLabelRect(box, flowerScale);
  const radius = Math.min(rect.height * 0.3, rect.width * 0.1);
  ctx.save();
  ctx.shadowColor = "rgba(27, 36, 51, 0.28)";
  ctx.shadowBlur = Math.max(8, rect.height * 0.18);
  ctx.shadowOffsetY = Math.max(2, rect.height * 0.06);
  fillRoundRect(ctx, rect.x, rect.y, rect.width, rect.height, radius);
  ctx.fillStyle = "#fff3d6";
  ctx.fill();
  ctx.shadowColor = "transparent";
  ctx.lineWidth = Math.max(2, rect.height * 0.07);
  ctx.strokeStyle = "#2a1c14";
  ctx.stroke();

  const inner = Math.max(2, rect.height * 0.1);
  fillRoundRect(
    ctx,
    rect.x + inner,
    rect.y + inner,
    rect.width - inner * 2,
    rect.height - inner * 2,
    Math.max(2, radius - inner)
  );
  ctx.strokeStyle = "#c4454d";
  ctx.lineWidth = Math.max(1.2, rect.height * 0.035);
  ctx.stroke();

  const bolt = Math.max(2.2, rect.height * 0.12);
  ctx.fillStyle = "#d9c4a0";
  ctx.beginPath();
  ctx.arc(rect.x + bolt * 1.8, rect.y + rect.height / 2, bolt, 0, Math.PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.arc(rect.x + rect.width - bolt * 1.8, rect.y + rect.height / 2, bolt, 0, Math.PI * 2);
  ctx.fill();

  const markSize = Math.max(5, rect.height * 0.22);
  ctx.save();
  ctx.translate(rect.x + rect.width * 0.16, rect.y + rect.height / 2);
  insertNoNumberMark(ctx, markSize);
  ctx.restore();

  const fontSize = Math.max(8, Math.min(rect.height * 0.42, rect.width * 0.13));
  ctx.fillStyle = "#2a1c14";
  ctx.font = `700 ${fontSize}px ui-sans-serif, "Segoe UI", system-ui, sans-serif`;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText("NO NUMBER", rect.x + rect.width * 0.58, rect.y + rect.height / 2 + 0.5);
  ctx.restore();
}

function markPlateHover(ctx, box, flowerScale) {
  const rect = plateLabelRect(box, flowerScale);
  ctx.save();
  fillRoundRect(ctx, rect.x - 2, rect.y - 2, rect.width + 4, rect.height + 4, Math.min(rect.height * 0.3, 16));
  ctx.strokeStyle = "rgba(27, 36, 51, 0.5)";
  ctx.lineWidth = 3;
  ctx.stroke();
  ctx.restore();
}
