export const TAU = Math.PI * 2;

export const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);

export function hash(n) {
  const x = Math.sin(n * 127.1 + 311.7) * 43758.5453;
  return x - Math.floor(x);
}

export function roundRect(ctx, x, y, w, h, r) {
  const rr = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + rr, y);
  ctx.arcTo(x + w, y, x + w, y + h, rr);
  ctx.arcTo(x + w, y + h, x, y + h, rr);
  ctx.arcTo(x, y + h, x, y, rr);
  ctx.arcTo(x, y, x + w, y, rr);
  ctx.closePath();
}

export function fillStroke(ctx, fill, stroke = null, lw = 2) {
  ctx.fillStyle = fill;
  ctx.fill();
  if (stroke) {
    ctx.lineWidth = lw;
    ctx.strokeStyle = stroke;
    ctx.stroke();
  }
}

export function ellipse(ctx, x, y, rx, ry, rot = 0) {
  ctx.beginPath();
  ctx.ellipse(x, y, rx, ry, rot, 0, TAU);
}

export function drawStar(ctx, x, y, r, points = 5, inner = 0.46) {
  ctx.beginPath();
  for (let i = 0; i < points * 2; i++) {
    const rad = i % 2 === 0 ? r : r * inner;
    const a = (i / (points * 2)) * TAU - Math.PI / 2;
    const px = x + Math.cos(a) * rad;
    const py = y + Math.sin(a) * rad;
    if (i === 0) ctx.moveTo(px, py);
    else ctx.lineTo(px, py);
  }
  ctx.closePath();
}

export function drawCoin(ctx, x, y, r, phase, t, alpha = 1) {
  const spin = Math.cos(t * 3.1 + phase);
  const rx = Math.max(2.8, Math.abs(spin) * r);
  ctx.save();
  ctx.translate(x, y);
  ctx.globalAlpha = alpha;

  // soft glow
  ctx.globalAlpha = alpha * 0.28;
  const glow = ctx.createRadialGradient(0, 0, 1, 0, 0, r * 2.1);
  glow.addColorStop(0, 'rgba(255, 226, 130, .85)');
  glow.addColorStop(1, 'rgba(255, 209, 92, 0)');
  ctx.fillStyle = glow;
  ctx.beginPath();
  ctx.arc(0, 0, r * 2.1, 0, TAU);
  ctx.fill();
  ctx.globalAlpha = alpha;

  // rim
  ctx.fillStyle = '#8f5310';
  ellipse(ctx, 0, 0, rx + 2.6, r + 2.6);
  ctx.fill();

  // body
  ctx.fillStyle = spin > 0 ? '#ffd15c' : '#f2b93e';
  ellipse(ctx, 0, 0, rx, r);
  ctx.fill();

  // shine
  ctx.globalAlpha = alpha * 0.85;
  ctx.fillStyle = '#fff3b0';
  ellipse(ctx, -rx * 0.28, -r * 0.32, rx * 0.42, r * 0.38, -0.2);
  ctx.fill();
  ctx.globalAlpha = alpha;

  // inner ring
  if (rx > 4) {
    ctx.strokeStyle = 'rgba(180, 111, 20, .72)';
    ctx.lineWidth = 1.6;
    ellipse(ctx, 0, 0, rx * 0.58, r * 0.58);
    ctx.stroke();
  }

  // embossed star when facing camera
  if (rx > r * 0.55) {
    ctx.fillStyle = 'rgba(255, 246, 190, .9)';
    drawStar(ctx, 0, 0, r * 0.34, 5, 0.44);
    ctx.fill();
  }

  // sparkle
  const tw = (Math.sin(t * 4.4 + phase) + 1) / 2;
  if (tw > 0.55) {
    ctx.globalAlpha = alpha * (tw - 0.55) * 2;
    ctx.strokeStyle = '#fffbd6';
    ctx.lineWidth = 1.6;
    const sx = rx * 0.75;
    const sy = -r * 0.72;
    ctx.beginPath();
    ctx.moveTo(sx - 4, sy);
    ctx.lineTo(sx + 4, sy);
    ctx.moveTo(sx, sy - 4);
    ctx.lineTo(sx, sy + 4);
    ctx.stroke();
  }
  ctx.restore();
}

export function drawPuff(ctx, x, y, scale, fill, shade, alpha = 1) {
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(scale, scale);
  ctx.globalAlpha = alpha;
  ctx.fillStyle = shade;
  ellipse(ctx, 0, 14, 46, 16);
  ctx.fill();
  ctx.fillStyle = fill;
  ellipse(ctx, -22, 2, 22, 17);
  ctx.fill();
  ellipse(ctx, 0, -6, 27, 22);
  ctx.fill();
  ellipse(ctx, 24, 3, 20, 16);
  ctx.fill();
  ellipse(ctx, 0, 10, 40, 15);
  ctx.fill();
  ctx.restore();
}
