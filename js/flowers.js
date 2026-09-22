const FLOWER_KINDS = ["daisy", "rose", "tulip", "sunflower", "blossom"];

function coverFaceWithFlower(ctx, box, index) {
  const cx = box.x + box.width / 2;
  const cy = box.y + box.height / 2;
  const size = Math.max(box.width, box.height) * 1.7;
  const kind = FLOWER_KINDS[index % FLOWER_KINDS.length];

  ctx.save();
  ctx.translate(cx, cy);
  ctx.rotate(((index % 7) - 3) * 0.08);
  drawCoverDisk(ctx, size, kind);
  if (kind === "daisy") insertDaisy(ctx, size);
  else if (kind === "rose") insertRose(ctx, size);
  else if (kind === "tulip") insertTulip(ctx, size);
  else if (kind === "sunflower") insertSunflower(ctx, size);
  else insertBlossom(ctx, size);
  ctx.restore();
}

function drawCoverDisk(ctx, size, kind) {
  const radius = size / 2;
  const fill =
    kind === "rose"
      ? "#7a1f33"
      : kind === "tulip"
        ? "#2f5d32"
        : kind === "sunflower"
          ? "#5b3b12"
          : kind === "blossom"
            ? "#7a3b58"
            : "#3d5a2b";
  ctx.beginPath();
  ctx.arc(0, 0, radius, 0, Math.PI * 2);
  ctx.fillStyle = fill;
  ctx.fill();
}

function insertDaisy(ctx, size) {
  const petalCount = 14;
  const petalLen = size * 0.46;
  const petalWid = size * 0.12;
  for (let i = 0; i < petalCount; i += 1) {
    ctx.save();
    ctx.rotate((Math.PI * 2 * i) / petalCount);
    ctx.beginPath();
    ctx.ellipse(0, -petalLen * 0.55, petalWid, petalLen * 0.5, 0, 0, Math.PI * 2);
    ctx.fillStyle = i % 2 === 0 ? "#fff7e0" : "#ffe9a8";
    ctx.fill();
    ctx.restore();
  }
  ctx.beginPath();
  ctx.arc(0, 0, size * 0.16, 0, Math.PI * 2);
  ctx.fillStyle = "#f4c430";
  ctx.fill();
  ctx.beginPath();
  ctx.arc(0, 0, size * 0.08, 0, Math.PI * 2);
  ctx.fillStyle = "#d99a11";
  ctx.fill();
}

function insertRose(ctx, size) {
  const layers = 7;
  for (let layer = layers; layer >= 1; layer -= 1) {
    const count = 6 + layer;
    const radius = (size * 0.08 * layer) / 1.15;
    for (let i = 0; i < count; i += 1) {
      ctx.save();
      ctx.rotate((Math.PI * 2 * i) / count + layer * 0.18);
      ctx.beginPath();
      ctx.ellipse(0, -radius, radius * 0.42, radius * 0.72, 0, 0, Math.PI * 2);
      ctx.fillStyle = layer % 2 === 0 ? "#ff4d6d" : "#c9184a";
      ctx.fill();
      ctx.restore();
    }
  }
  ctx.beginPath();
  ctx.arc(0, 0, size * 0.07, 0, Math.PI * 2);
  ctx.fillStyle = "#6a040f";
  ctx.fill();
}

function insertTulip(ctx, size) {
  ctx.beginPath();
  ctx.moveTo(0, size * 0.42);
  ctx.quadraticCurveTo(-size * 0.08, size * 0.1, 0, -size * 0.12);
  ctx.quadraticCurveTo(size * 0.08, size * 0.1, 0, size * 0.42);
  ctx.fillStyle = "#5a8f3d";
  ctx.fill();

  const petals = [-0.55, 0, 0.55];
  petals.forEach((tilt, i) => {
    ctx.save();
    ctx.rotate(tilt);
    ctx.beginPath();
    ctx.moveTo(0, size * 0.08);
    ctx.bezierCurveTo(-size * 0.22, -size * 0.05, -size * 0.16, -size * 0.42, 0, -size * 0.48);
    ctx.bezierCurveTo(size * 0.16, -size * 0.42, size * 0.22, -size * 0.05, 0, size * 0.08);
    ctx.fillStyle = i === 1 ? "#ff6b8f" : "#ff8fab";
    ctx.fill();
    ctx.restore();
  });
}

function insertSunflower(ctx, size) {
  const petalCount = 18;
  for (let i = 0; i < petalCount; i += 1) {
    ctx.save();
    ctx.rotate((Math.PI * 2 * i) / petalCount);
    ctx.beginPath();
    ctx.ellipse(0, -size * 0.28, size * 0.07, size * 0.22, 0, 0, Math.PI * 2);
    ctx.fillStyle = i % 2 === 0 ? "#ffc300" : "#ff9900";
    ctx.fill();
    ctx.restore();
  }
  ctx.beginPath();
  ctx.arc(0, 0, size * 0.18, 0, Math.PI * 2);
  ctx.fillStyle = "#5c330a";
  ctx.fill();
  ctx.fillStyle = "#d4a017";
  for (let i = 0; i < 18; i += 1) {
    const angle = (Math.PI * 2 * i) / 18;
    ctx.beginPath();
    ctx.arc(Math.cos(angle) * size * 0.08, Math.sin(angle) * size * 0.08, size * 0.018, 0, Math.PI * 2);
    ctx.fill();
  }
}

function insertBlossom(ctx, size) {
  for (let i = 0; i < 5; i += 1) {
    ctx.save();
    ctx.rotate((Math.PI * 2 * i) / 5);
    ctx.beginPath();
    ctx.ellipse(0, -size * 0.2, size * 0.13, size * 0.22, 0, 0, Math.PI * 2);
    ctx.fillStyle = "#ffb3c6";
    ctx.fill();
    ctx.beginPath();
    ctx.ellipse(0, -size * 0.18, size * 0.06, size * 0.14, 0, 0, Math.PI * 2);
    ctx.fillStyle = "#fff0f5";
    ctx.fill();
    ctx.restore();
  }
  ctx.beginPath();
  ctx.arc(0, 0, size * 0.08, 0, Math.PI * 2);
  ctx.fillStyle = "#f7e1a0";
  ctx.fill();
}
