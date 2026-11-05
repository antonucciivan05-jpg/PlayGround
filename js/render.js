import { TILE } from './levels.js';
import { TAU, roundRect, fillStroke, ellipse, drawCoin, drawStar, drawPuff, hash, clamp } from './draw.js';

/* ------------------------------------------------------------------ */
/*  Root render                                                        */
/* ------------------------------------------------------------------ */

export function renderGame(g) {
  const ctx = g.ctx;
  ctx.setTransform(g.dpr, 0, 0, g.dpr, 0, 0);
  drawBackground(g, ctx);

  let shx = 0;
  let shy = 0;
  if (g.shake > 0.25) {
    shx = (Math.random() * 2 - 1) * g.shake * 0.55;
    shy = (Math.random() * 2 - 1) * g.shake * 0.4;
  }
  const s = g.dpr * g.scale;
  ctx.setTransform(s, 0, 0, s, -(g.camera.x + shx) * s, -(g.camera.y + shy) * s);
  drawWorld(g, ctx, g.camera.x + shx, g.camera.y + shy);

  ctx.setTransform(g.dpr, 0, 0, g.dpr, 0, 0);
  if (g.vignette) {
    ctx.fillStyle = g.vignette;
    ctx.fillRect(0, 0, g.cssW, g.cssH);
  }
  if (g.flash > 0) {
    ctx.save();
    ctx.globalAlpha = Math.min(0.34, g.flash * 0.34);
    ctx.fillStyle = g.flashColor;
    ctx.fillRect(0, 0, g.cssW, g.cssH);
    ctx.restore();
  }
}

/* ------------------------------------------------------------------ */
/*  Background                                                         */
/* ------------------------------------------------------------------ */

function drawBackground(g, ctx) {
  const t = g.theme;
  const w = g.cssW;
  const h = g.cssH;
  const cam = g.camera;
  const s = g.scale;

  const sky = ctx.createLinearGradient(0, 0, 0, h);
  sky.addColorStop(0, t.skyTop);
  sky.addColorStop(0.55, t.skyMid);
  sky.addColorStop(1, t.skyLow);
  ctx.fillStyle = sky;
  ctx.fillRect(0, 0, w, h);

  const groundScreen = (12 * TILE - cam.y) * s;

  // stars / moon
  if (t.stars > 0) {
    for (let i = 0; i < t.stars; i++) {
      const st = g.stars[i % g.stars.length];
      const a = 0.25 + 0.6 * Math.abs(Math.sin(g.animClock * 0.7 * st.s + st.p));
      ctx.globalAlpha = a;
      ctx.fillStyle = i % 7 === 0 ? '#bcd6ff' : '#f4f0ff';
      ctx.beginPath();
      ctx.arc(st.x * w, st.y * h, st.r, 0, TAU);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
  }

  if (t.moon) {
    const mx = w * 0.775;
    const my = h * 0.16;
    const glow = ctx.createRadialGradient(mx, my, 8, mx, my, 150);
    glow.addColorStop(0, 'rgba(200, 220, 255, .28)');
    glow.addColorStop(1, 'rgba(140, 170, 255, 0)');
    ctx.fillStyle = glow;
    ctx.beginPath();
    ctx.arc(mx, my, 150, 0, TAU);
    ctx.fill();
    ctx.fillStyle = '#e8eeff';
    ctx.beginPath();
    ctx.arc(mx, my, 38, 0, TAU);
    ctx.fill();
    ctx.fillStyle = 'rgba(170, 185, 220, .42)';
    [[-12, -8, 8], [10, 6, 6], [-4, 14, 4], [16, -14, 5]].forEach(([dx, dy, r]) => {
      ctx.beginPath();
      ctx.arc(mx + dx, my + dy, r, 0, TAU);
      ctx.fill();
    });
  } else {
    // sun
    const sunset = g.level.theme === 'sunset';
    const sx = w * (sunset ? 0.74 : 0.8);
    const sy = sunset ? Math.max(h * 0.36, groundScreen - 110) : h * 0.15;
    const r = sunset ? 72 : 46;
    const glow = ctx.createRadialGradient(sx, sy, 4, sx, sy, r * 3.2);
    glow.addColorStop(0, t.sunGlow);
    glow.addColorStop(1, 'rgba(255, 220, 140, 0)');
    ctx.fillStyle = glow;
    ctx.beginPath();
    ctx.arc(sx, sy, r * 3.2, 0, TAU);
    ctx.fill();
    ctx.fillStyle = t.sun;
    ctx.beginPath();
    ctx.arc(sx, sy, r, 0, TAU);
    ctx.fill();
    if (sunset) {
      ctx.fillStyle = 'rgba(232, 112, 138, .35)';
      for (let i = 0; i < 3; i++) ctx.fillRect(sx - r, sy - 8 + i * 16, r * 2, 4);
    }
  }

  // clouds / mist
  if (g.level.theme === 'castle') {
    ctx.globalAlpha = 0.5;
    for (let i = 0; i < 4; i++) {
      const y = h * (0.2 + i * 0.11) - cam.y * s * 0.02;
      const grad = ctx.createLinearGradient(0, y, 0, y + 26);
      grad.addColorStop(0, 'rgba(130, 120, 190, 0)');
      grad.addColorStop(0.5, 'rgba(130, 120, 190, .10)');
      grad.addColorStop(1, 'rgba(130, 120, 190, 0)');
      ctx.fillStyle = grad;
      ctx.fillRect(0, y - 13, w, 26 + i * 2);
    }
    ctx.globalAlpha = 1;
  } else {
    const span = w + 460;
    for (let i = 0; i < 7; i++) {
      let x = (hash(i * 5.7 + 1) * span * 1.4 - cam.x * s * 0.16) % span;
      if (x < 0) x += span;
      x -= 210;
      const y = h * (0.1 + hash(i * 2.2 + 3) * 0.3) - cam.y * s * 0.04 + Math.sin(g.animClock * 0.3 + i) * 4;
      const sc = 0.55 + hash(i * 9.1 + 2) * 0.85;
      drawPuff(ctx, x, y, sc, t.cloud, t.cloudShade, 0.9);
    }
  }

  // distant castle towers
  if (g.level.theme === 'castle') {
    const horizon = groundScreen + 26;
    for (let i = 0; i < 8; i++) {
      const spacing = w * 0.42 + 140;
      let x = (i * spacing + 80 - cam.x * s * 0.17) % (w + 700);
      if (x < 0) x += w + 700;
      x -= 320;
      const tw = 54 + hash(i * 2.1) * 64;
      const th = 100 + hash(i * 3.7 + 1) * 200;
      const ty = horizon - th;
      ctx.fillStyle = i % 2 === 0 ? t.farHill : t.midHill;
      ctx.fillRect(x, ty, tw, th);
      for (let b = 0; b < 3; b++) {
        ctx.fillRect(x + b * (tw / 3) + 3, ty - 12, tw / 4.5, 12);
      }
      ctx.fillStyle = 'rgba(255, 209, 92, .5)';
      for (let wy = 0; wy < 3; wy++) {
        for (let wx = 0; wx < 2; wx++) {
          const flicker = 0.45 + 0.4 * Math.abs(Math.sin(g.animClock * 0.8 + i + wx * 2 + wy));
          ctx.globalAlpha = flicker;
          ctx.fillRect(x + tw * (0.27 + wx * 0.36), ty + 22 + wy * 36, 8, 12);
        }
      }
      ctx.globalAlpha = 1;
    }
  }

  // hill layers
  const farOff = cam.x * s * 0.12;
  const midOff = cam.x * s * 0.26;
  const nearOff = cam.x * s * 0.45;
  if (g.level.theme === 'castle') {
    drawHillLayer(ctx, w, h, groundScreen + 22, h * 0.11, 260, farOff, t.farHill, 1);
    drawHillLayer(ctx, w, h, groundScreen + 40, h * 0.08, 200, midOff, t.midHill, 1);
  } else {
    drawHillLayer(ctx, w, h, groundScreen + 18, h * 0.16, 250, farOff, t.farHill, 1);
    drawHillLayer(ctx, w, h, groundScreen + 34, h * 0.12, 190, midOff, t.midHill, 1);
    drawHillLayer(ctx, w, h, groundScreen + 54, h * 0.08, 150, nearOff, t.nearHill, 1);
  }

  // birds
  if (g.level.theme !== 'castle') {
    ctx.strokeStyle = g.level.theme === 'sunset' ? 'rgba(70, 30, 60, .55)' : 'rgba(40, 80, 110, .45)';
    ctx.lineWidth = 2.4;
    ctx.lineCap = 'round';
    for (let i = 0; i < 3; i++) {
      const span = w + 300;
      let x = (hash(i * 8.3) * span - cam.x * s * 0.08) % span;
      if (x < 0) x += span;
      x -= 150;
      const y = h * (0.18 + hash(i * 4.1) * 0.16) + Math.sin(g.animClock * 1.2 + i * 2) * 4;
      const wing = 6 + Math.sin(g.animClock * 6 + i) * 2;
      ctx.beginPath();
      ctx.moveTo(x - 10, y);
      ctx.quadraticCurveTo(x - 4, y - wing, x, y);
      ctx.quadraticCurveTo(x + 4, y - wing, x + 10, y);
      ctx.stroke();
    }
  }

  // atmospheric haze above the horizon
  const haze = ctx.createLinearGradient(0, groundScreen - 120, 0, groundScreen + 30);
  haze.addColorStop(0, 'rgba(255,255,255,0)');
  haze.addColorStop(0.6, t.ambient);
  haze.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = haze;
  ctx.fillRect(0, groundScreen - 120, w, 150);
}

function drawHillLayer(ctx, w, h, base, amp, wave, off, color, alpha) {
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.moveTo(-60, h + 30);
  for (let x = -60; x <= w + 60; x += 16) {
    const y = base
      - amp * (0.55 + 0.45 * Math.sin((x + off) / wave))
      - amp * 0.18 * Math.sin((x + off * 1.3) / (wave * 0.42));
    ctx.lineTo(x, y);
  }
  ctx.lineTo(w + 60, h + 30);
  ctx.closePath();
  ctx.fill();
  ctx.restore();
}

/* ------------------------------------------------------------------ */
/*  World                                                              */
/* ------------------------------------------------------------------ */

function drawWorld(g, ctx, camX, camY) {
  const left = camX - 120;
  const right = camX + g.viewW + 120;
  drawPits(g, ctx, left, right);
  drawGrounds(g, ctx, left, right);
  drawDecor(g, ctx, left, right);
  drawPlatforms(g, ctx, left, right);
  drawPipes(g, ctx, left, right);
  drawBlocks(g, ctx, left, right);
  drawMovers(g, ctx);
  drawSprings(g, ctx);
  drawCheckpoints(g, ctx);
  drawGoal(g, ctx);
  drawCoins(g, ctx, left, right);
  drawEnemies(g, ctx, left, right);
  if (g.player) drawPlayer(g, ctx);
  drawParticleField(g, ctx);
  drawFloatingTexts(g, ctx);
}

function drawPits(g, ctx, left, right) {
  const l = g.level;
  const t = g.theme;
  const top = 12 * TILE;
  for (const gap of l.gaps) {
    const x0 = gap.x0 * TILE;
    const x1 = gap.x1 * TILE;
    if (x1 < left || x0 > right) continue;

    const dark = l.theme === 'meadow' ? ['#1b3040', '#070b16']
      : l.theme === 'sunset' ? ['#2c1731', '#0a0614']
        : ['#150e24', '#04030b'];
    const grad = ctx.createLinearGradient(0, top, 0, l.worldH);
    grad.addColorStop(0, dark[0]);
    grad.addColorStop(1, dark[1]);
    ctx.fillStyle = grad;
    ctx.fillRect(x0, top, x1 - x0, l.worldH - top);

    // depth bands
    ctx.globalAlpha = 0.18;
    ctx.strokeStyle = l.theme === 'castle' ? '#5b4a83' : '#7fb2c9';
    ctx.lineWidth = 2;
    for (let y = top + 60; y < l.worldH - 20; y += 70) {
      ctx.beginPath();
      ctx.moveTo(x0 + 8, y);
      ctx.lineTo(x1 - 8, y);
      ctx.stroke();
    }
    ctx.globalAlpha = 1;

    if (t.lava) {
      const lavaTop = l.worldH - 50;
      const lg = ctx.createLinearGradient(0, lavaTop, 0, l.worldH);
      lg.addColorStop(0, '#ffcf5c');
      lg.addColorStop(0.35, '#ff8a2b');
      lg.addColorStop(1, '#b8241c');
      ctx.fillStyle = lg;
      ctx.fillRect(x0, lavaTop, x1 - x0, l.worldH - lavaTop);

      ctx.globalAlpha = 0.5;
      const glow = ctx.createRadialGradient((x0 + x1) / 2, lavaTop, 4, (x0 + x1) / 2, lavaTop, 100);
      glow.addColorStop(0, 'rgba(255, 140, 46, .55)');
      glow.addColorStop(1, 'rgba(255, 100, 20, 0)');
      ctx.fillStyle = glow;
      ctx.fillRect(x0 - 40, lavaTop - 120, x1 - x0 + 80, 160);
      ctx.globalAlpha = 1;

      ctx.fillStyle = '#ffb347';
      ctx.beginPath();
      ctx.moveTo(x0, lavaTop + 3);
      for (let x = x0; x <= x1; x += 14) {
        const y = lavaTop + 3 + Math.sin(g.animClock * 2.4 + x * 0.05) * 3;
        ctx.lineTo(x, y);
      }
      ctx.lineTo(x1, lavaTop + 18);
      ctx.lineTo(x0, lavaTop + 18);
      ctx.closePath();
      ctx.fill();

      for (let i = 0; i < 4; i++) {
        const bx = x0 + ((hash(i * 3.3 + gap.x0) * (x1 - x0)) | 0);
        const by = l.worldH - 20 - ((Math.sin(g.animClock * 1.7 + i * 2) + 1) / 2) * 24;
        ctx.globalAlpha = 0.65;
        ctx.fillStyle = '#ffe28a';
        ctx.beginPath();
        ctx.arc(bx, by, 2 + hash(i + gap.x0) * 3, 0, TAU);
        ctx.fill();
      }
      ctx.globalAlpha = 1;
    }
  }
}

function drawGrounds(g, ctx, left, right) {
  const t = g.theme;
  const l = g.level;
  for (const seg of l.groundSegs) {
    const sx = seg.x0 * TILE;
    const ex = seg.x1 * TILE;
    if (ex < left || sx > right) continue;
    const x0 = Math.max(sx, left - 60);
    const x1 = Math.min(ex, right + 60);
    const top = seg.top * TILE;
    const w = x1 - x0;

    const body = ctx.createLinearGradient(0, top, 0, l.worldH);
    body.addColorStop(0, t.groundBody);
    body.addColorStop(1, t.groundBodyDark);
    ctx.fillStyle = body;
    ctx.fillRect(x0, top + 12, w, l.worldH - top - 12);

    // subtle strata
    ctx.globalAlpha = 0.22;
    ctx.fillStyle = t.groundLine;
    for (let y = top + 58; y < l.worldH; y += 58) {
      ctx.fillRect(x0, y, w, 2);
    }
    ctx.globalAlpha = 1;

    // pebbles
    const seed = Math.floor(x0 / 68) * 68;
    for (let x = seed; x < x1; x += 68) {
      const h1 = hash(x * 0.031 + seg.x0);
      const h2 = hash(x * 0.077 + seg.x1);
      ctx.globalAlpha = 0.26;
      ctx.fillStyle = h1 > 0.5 ? t.groundLine : 'rgba(255,255,255,.35)';
      ellipse(ctx, x + h1 * 50, top + 55 + h2 * 120, 3 + h1 * 3, 2, 0);
      ctx.fill();
      ctx.globalAlpha = 1;
    }

    if (l.theme === 'castle') {
      ctx.fillStyle = t.groundTop;
      ctx.fillRect(x0, top, w, 20);
      ctx.fillStyle = t.groundTopDark;
      ctx.fillRect(x0, top + 16, w, 5);
      ctx.strokeStyle = 'rgba(12, 9, 24, .45)';
      ctx.lineWidth = 2;
      for (let x = Math.floor(x0 / 76) * 76; x < x1; x += 76) {
        ctx.beginPath();
        ctx.moveTo(x, top + 20);
        ctx.lineTo(x, top + 74);
        ctx.stroke();
      }
      ctx.globalAlpha = 0.55;
      ctx.fillStyle = t.stoneLight;
      ctx.fillRect(x0, top + 1, w, 2);
      ctx.globalAlpha = 1;
    } else {
      // grass cap with a slightly uneven lip
      ctx.fillStyle = t.groundTop;
      ctx.fillRect(x0, top + 4, w, 14);
      ctx.fillStyle = t.groundTopDark;
      ctx.fillRect(x0, top + 14, w, 4);
      const bladeSeed = Math.floor(x0 / 9) * 9;
      for (let x = bladeSeed; x < x1; x += 9) {
        const hh = 2 + hash(x * 0.19) * 7;
        ctx.fillStyle = hash(x * 0.41) > 0.5 ? t.groundTop : t.groundTopDark;
        ctx.beginPath();
        ctx.moveTo(x, top + 6);
        ctx.lineTo(x + 3, top + 6 - hh);
        ctx.lineTo(x + 5, top + 6);
        ctx.closePath();
        ctx.fill();
      }
      ctx.globalAlpha = 0.5;
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(x0, top + 4, w, 2);
      ctx.globalAlpha = 1;
    }

    // shaded edges above pits
    ctx.globalAlpha = 0.28;
    ctx.fillStyle = t.groundLine;
    ctx.fillRect(x0, top, 5, l.worldH - top);
    ctx.fillRect(x1 - 5, top, 5, l.worldH - top);
    ctx.globalAlpha = 1;
  }
}

function drawDecor(g, ctx, left, right) {
  const t = g.theme;
  const l = g.level;
  const groundTop = 12 * TILE;
  for (const seg of l.groundSegs) {
    const sx = seg.x0 * TILE;
    const ex = seg.x1 * TILE;
    for (let x = sx + 110; x < ex - 70; x += 360) {
      const px = x + hash(x * 0.012 + seg.x0) * 210;
      if (px < left - 60 || px > right + 60) continue;
      const r = hash(px * 0.017);
      if (r < 0.16) continue;
      if (l.theme === 'meadow') {
        if (r > 0.58) drawBush(ctx, px, groundTop, t, 0.8 + hash(px) * 0.5);
        else drawFlowers(ctx, px, groundTop, t, r);
      } else if (l.theme === 'sunset') {
        if (r > 0.55) drawCactus(ctx, px, groundTop, t, 0.8 + hash(px) * 0.4);
        else drawDryBush(ctx, px, groundTop, t);
      } else {
        if (r > 0.6) drawTorch(ctx, px, groundTop, g.animClock);
        else drawCrystal(ctx, px, groundTop, g.animClock);
      }
    }
  }
}

function drawBush(ctx, x, groundY, t, scale) {
  ctx.save();
  ctx.translate(x, groundY + 2);
  ctx.scale(scale, scale * 0.9);
  ctx.fillStyle = 'rgba(10, 24, 30, .18)';
  ellipse(ctx, 0, 1, 38, 7);
  ctx.fill();
  ctx.fillStyle = t.bush;
  ctx.strokeStyle = t.bushDark;
  ctx.lineWidth = 2.5;
  ctx.beginPath();
  ctx.arc(-22, -14, 17, Math.PI, 0);
  ctx.arc(0, -24, 22, Math.PI, 0);
  ctx.arc(23, -14, 16, Math.PI, 0);
  ctx.lineTo(39, 0);
  ctx.lineTo(-39, 0);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = 'rgba(255,255,255,.18)';
  ellipse(ctx, -6, -28, 10, 5, -0.4);
  ctx.fill();
  ctx.restore();
}

function drawFlowers(ctx, x, groundY, t, seed) {
  for (let i = 0; i < 3; i++) {
    const fx = x + (i - 1) * 12 + hash(seed * 31 + i) * 8;
    const hh = 10 + hash(seed * 17 + i) * 8;
    ctx.strokeStyle = t.groundTopDark;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(fx, groundY);
    ctx.quadraticCurveTo(fx + 2, groundY - hh / 2, fx, groundY - hh);
    ctx.stroke();
    const col = i === 1 ? '#ffe28a' : '#fff7ec';
    ctx.fillStyle = col;
    for (let p = 0; p < 5; p++) {
      const a = (p / 5) * TAU;
      ctx.beginPath();
      ctx.arc(fx + Math.cos(a) * 3.5, groundY - hh + Math.sin(a) * 3.5, 2.6, 0, TAU);
      ctx.fill();
    }
    ctx.fillStyle = '#f0a12c';
    ctx.beginPath();
    ctx.arc(fx, groundY - hh, 2, 0, TAU);
    ctx.fill();
  }
}

function drawCactus(ctx, x, groundY, t, scale) {
  ctx.save();
  ctx.translate(x, groundY);
  ctx.scale(scale, scale);
  ctx.fillStyle = 'rgba(10, 8, 20, .2)';
  ellipse(ctx, 0, 0, 26, 5);
  ctx.fill();
  ctx.fillStyle = '#7f9d6b';
  ctx.strokeStyle = '#526b46';
  ctx.lineWidth = 2.5;
  roundRect(ctx, -9, -58, 18, 58, 9);
  ctx.fill();
  ctx.stroke();
  roundRect(ctx, -26, -40, 17, 10, 5);
  ctx.fill();
  ctx.stroke();
  roundRect(ctx, -26, -48, 9, 18, 4);
  ctx.fill();
  ctx.stroke();
  roundRect(ctx, 9, -34, 18, 10, 5);
  ctx.fill();
  ctx.stroke();
  roundRect(ctx, 18, -46, 9, 20, 4);
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = '#ffe28a';
  ctx.beginPath();
  ctx.arc(0, -58, 4, 0, TAU);
  ctx.fill();
  ctx.restore();
}

function drawDryBush(ctx, x, groundY, t) {
  ctx.strokeStyle = t.bushDark;
  ctx.lineWidth = 2.5;
  ctx.lineCap = 'round';
  for (let i = 0; i < 5; i++) {
    const a = -Math.PI / 2 + (i - 2) * 0.36;
    ctx.beginPath();
    ctx.moveTo(x, groundY);
    ctx.quadraticCurveTo(x + Math.cos(a) * 15, groundY - 18, x + Math.cos(a) * 24, groundY - 30 - hash(i + x) * 8);
    ctx.stroke();
  }
}

function drawTorch(ctx, x, groundY, time) {
  ctx.fillStyle = '#2b2438';
  roundRect(ctx, x - 3, groundY - 46, 6, 46, 3);
  ctx.fill();
  ctx.fillStyle = '#4a3c5e';
  roundRect(ctx, x - 9, groundY - 52, 18, 9, 4);
  ctx.fill();
  const flick = Math.sin(time * 9 + x) * 3;
  const glow = ctx.createRadialGradient(x, groundY - 58, 2, x, groundY - 58, 44);
  glow.addColorStop(0, 'rgba(120, 225, 255, .34)');
  glow.addColorStop(1, 'rgba(90, 180, 255, 0)');
  ctx.fillStyle = glow;
  ctx.beginPath();
  ctx.arc(x, groundY - 58, 44, 0, TAU);
  ctx.fill();
  ctx.fillStyle = 'rgba(90, 210, 255, .9)';
  ctx.beginPath();
  ctx.moveTo(x - 6, groundY - 52);
  ctx.quadraticCurveTo(x - 2 + flick, groundY - 70, x, groundY - 78);
  ctx.quadraticCurveTo(x + 4 + flick, groundY - 64, x + 6, groundY - 52);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = '#e9feff';
  ctx.beginPath();
  ctx.ellipse(x + flick * 0.4, groundY - 60, 2.6, 5, 0, 0, TAU);
  ctx.fill();
}

function drawCrystal(ctx, x, groundY, time) {
  const pulse = 0.55 + 0.25 * Math.sin(time * 2 + x);
  const glow = ctx.createRadialGradient(x, groundY - 14, 2, x, groundY - 14, 36);
  glow.addColorStop(0, `rgba(139, 233, 255, ${0.25 * pulse})`);
  glow.addColorStop(1, 'rgba(139, 233, 255, 0)');
  ctx.fillStyle = glow;
  ctx.beginPath();
  ctx.arc(x, groundY - 14, 36, 0, TAU);
  ctx.fill();
  ctx.fillStyle = `rgba(116, 208, 255, ${0.65 + pulse * 0.3})`;
  ctx.strokeStyle = 'rgba(200, 250, 255, .7)';
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(x, groundY - 38);
  ctx.lineTo(x + 10, groundY - 16);
  ctx.lineTo(x + 4, groundY);
  ctx.lineTo(x - 9, groundY - 2);
  ctx.lineTo(x - 11, groundY - 20);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = 'rgba(255,255,255,.75)';
  ctx.beginPath();
  ctx.moveTo(x, groundY - 34);
  ctx.lineTo(x + 3, groundY - 20);
  ctx.lineTo(x - 1, groundY - 20);
  ctx.closePath();
  ctx.fill();
}

/* ------------------------------------------------------------------ */
/*  Blocks and platforms                                               */
/* ------------------------------------------------------------------ */

function drawPlatforms(g, ctx, left, right) {
  const t = g.theme;
  for (const p of g.level.platforms) {
    const x = p.x * TILE;
    const y = p.y * TILE;
    const w = p.w * TILE;
    const h = p.h * TILE;
    if (x + w < left || x > right) continue;
    if (p.type === 'brick') drawBrickBody(ctx, x, y, w, h, t);
    else if (p.type === 'wood') drawWoodBody(ctx, x, y, w, h, t);
    else if (p.type === 'cloud') drawCloudBody(ctx, x, y, w, h, t);
    else drawStoneBody(ctx, x, y, w, h, t);
  }
}

function drawBrickBody(ctx, x, y, w, h, t) {
  ctx.save();
  ctx.beginPath();
  ctx.rect(x, y, w, h);
  ctx.clip();
  ctx.fillStyle = t.brick;
  ctx.fillRect(x, y, w, h);

  const row = 24;
  for (let ry = 0; ry <= h; ry += row) {
    const yy = y + ry;
    ctx.fillStyle = t.brickDark;
    ctx.fillRect(x, yy, w, 2.5);
    const offset = ((ry / row) % 2) * 24;
    for (let bx = x - offset; bx <= x + w; bx += 48) {
      ctx.fillRect(bx, yy, 2.5, row);
    }
  }
  ctx.fillStyle = t.brickLight;
  ctx.fillRect(x, y, w, 4);
  ctx.fillStyle = 'rgba(255,255,255,.15)';
  ctx.fillRect(x, y + 4, w, 2);
  ctx.fillStyle = 'rgba(60, 20, 12, .32)';
  ctx.fillRect(x, y + h - 4, w, 4);
  ctx.restore();

  ctx.strokeStyle = 'rgba(40, 14, 10, .55)';
  ctx.lineWidth = 2;
  ctx.strokeRect(x + 1, y + 1, w - 2, h - 2);
}

function drawStoneBody(ctx, x, y, w, h, t) {
  const grd = ctx.createLinearGradient(0, y, 0, y + h);
  grd.addColorStop(0, t.stone);
  grd.addColorStop(1, t.stoneDark);
  ctx.fillStyle = grd;
  ctx.fillRect(x, y, w, h);

  ctx.fillStyle = t.stoneLight;
  ctx.fillRect(x, y, w, 3.5);
  ctx.fillRect(x, y, 3, h);
  ctx.fillStyle = 'rgba(18, 15, 30, .4)';
  ctx.fillRect(x, y + h - 4, w, 4);
  ctx.fillRect(x + w - 4, y, 4, h);

  ctx.globalAlpha = 0.28;
  ctx.strokeStyle = t.stoneDark;
  ctx.lineWidth = 2;
  for (let sx = x + 46; sx < x + w; sx += 58) {
    ctx.beginPath();
    ctx.moveTo(sx, y + 6);
    ctx.lineTo(sx, y + h - 4);
    ctx.stroke();
  }
  for (let i = 0; i < Math.max(1, w / 90); i++) {
    const cx = x + 18 + hash(x + i * 31) * (w - 30);
    const cy = y + 12 + hash(y + i * 17) * Math.max(1, h - 24);
    ctx.beginPath();
    ctx.moveTo(cx, cy);
    ctx.lineTo(cx + 7, cy + 5);
    ctx.lineTo(cx + 3, cy + 11);
    ctx.stroke();
  }
  ctx.globalAlpha = 1;

  ctx.strokeStyle = 'rgba(30, 25, 45, .5)';
  ctx.lineWidth = 2;
  ctx.strokeRect(x + 1, y + 1, w - 2, h - 2);
}

function drawWoodBody(ctx, x, y, w, h, t) {
  ctx.save();
  ctx.beginPath();
  ctx.rect(x, y, w, h);
  ctx.clip();
  ctx.fillStyle = t.wood;
  ctx.fillRect(x, y, w, h);
  for (let ry = 0; ry < h; ry += 16) {
    ctx.fillStyle = t.woodDark;
    ctx.fillRect(x, y + ry, w, 2);
    ctx.globalAlpha = 0.24;
    ctx.strokeStyle = '#fff1d0';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(x, y + ry + 7);
    ctx.bezierCurveTo(x + w * 0.3, y + ry + 3, x + w * 0.7, y + ry + 11, x + w, y + ry + 7);
    ctx.stroke();
    ctx.globalAlpha = 1;
  }
  ctx.fillStyle = 'rgba(255,255,255,.18)';
  ctx.fillRect(x, y, w, 3);
  ctx.fillStyle = 'rgba(35, 18, 8, .35)';
  ctx.fillRect(x, y + h - 4, w, 4);
  ctx.fillStyle = '#e5c48d';
  for (let nx = x + 8; nx < x + w; nx += 44) {
    ctx.beginPath();
    ctx.arc(nx, y + 8, 1.8, 0, TAU);
    ctx.fill();
    ctx.beginPath();
    ctx.arc(nx, y + h - 8, 1.8, 0, TAU);
    ctx.fill();
  }
  ctx.restore();
  ctx.strokeStyle = 'rgba(45, 24, 10, .55)';
  ctx.lineWidth = 2;
  ctx.strokeRect(x + 1, y + 1, w - 2, h - 2);
}

function drawCloudBody(ctx, x, y, w, h, t) {
  ctx.save();
  ctx.fillStyle = 'rgba(20, 40, 80, .16)';
  ellipse(ctx, x + w / 2, y + h - 2, w * 0.48, 9);
  ctx.fill();

  const grd = ctx.createLinearGradient(0, y, 0, y + h);
  grd.addColorStop(0, '#ffffff');
  grd.addColorStop(0.7, '#eaf7ff');
  grd.addColorStop(1, '#c3dfef');
  ctx.fillStyle = grd;
  roundRect(ctx, x + 2, y + 10, w - 4, h - 12, 12);
  ctx.fill();

  const puffs = Math.max(2, Math.round(w / 34));
  for (let i = 0; i < puffs; i++) {
    const px = x + 16 + (i / (puffs - 1 || 1)) * (w - 32);
    const pr = 14 + hash(i + x * 0.01) * 8;
    ctx.beginPath();
    ctx.arc(px, y + 12 + Math.sin(i * 1.7) * 3, pr, 0, TAU);
    ctx.fill();
  }
  ctx.fillStyle = 'rgba(255,255,255,.9)';
  for (let i = 0; i < puffs; i++) {
    const px = x + 16 + (i / (puffs - 1 || 1)) * (w - 32);
    ctx.beginPath();
    ctx.arc(px - 2, y + 9, 9, 0, TAU);
    ctx.fill();
  }
  ctx.fillStyle = 'rgba(160, 198, 220, .6)';
  ctx.fillRect(x + 6, y + h - 6, w - 12, 3);
  ctx.restore();
}

function drawBlocks(g, ctx, left, right) {
  const t = g.theme;
  for (const b of g.level.blocks) {
    const x = b.x * TILE;
    let y = b.y * TILE;
    if (x + TILE < left || x > right) continue;
    if (b.bump > 0) {
      const p = 1 - b.bump / 0.3;
      y -= Math.sin(p * Math.PI) * 8;
    }
    if (b.type === 'B') {
      drawBrickBody(ctx, x, y, TILE, TILE, t);
      continue;
    }
    if (b.used) {
      const grd = ctx.createLinearGradient(0, y, 0, y + TILE);
      grd.addColorStop(0, '#9c7a62');
      grd.addColorStop(1, '#6d4f42');
      ctx.fillStyle = grd;
      roundRect(ctx, x + 1, y + 1, TILE - 2, TILE - 2, 5);
      ctx.fill();
      ctx.strokeStyle = 'rgba(45, 28, 22, .65)';
      ctx.lineWidth = 2.5;
      ctx.stroke();
      ctx.fillStyle = 'rgba(255,255,255,.12)';
      roundRect(ctx, x + 8, y + 8, TILE - 16, 8, 3);
      ctx.fill();
      ctx.fillStyle = 'rgba(45, 28, 22, .5)';
      for (const [dx, dy] of [[8, 8], [TILE - 8, 8], [8, TILE - 8], [TILE - 8, TILE - 8]]) {
        ctx.beginPath();
        ctx.arc(x + dx, y + dy, 2, 0, TAU);
        ctx.fill();
      }
      continue;
    }

    // gold question block
    const shine = (Math.sin(g.animClock * 2 + b.x * 0.7) + 1) / 2;
    const grd = ctx.createLinearGradient(0, y, 0, y + TILE);
    grd.addColorStop(0, '#ffe58c');
    grd.addColorStop(0.45, '#ffc93e');
    grd.addColorStop(1, '#e39a1a');
    ctx.fillStyle = grd;
    roundRect(ctx, x + 1, y + 1, TILE - 2, TILE - 2, 5);
    ctx.fill();
    ctx.strokeStyle = '#9a5a0e';
    ctx.lineWidth = 3;
    ctx.stroke();
    ctx.strokeStyle = 'rgba(255, 250, 210, .8)';
    ctx.lineWidth = 2;
    roundRect(ctx, x + 5, y + 5, TILE - 10, TILE - 10, 3);
    ctx.stroke();

    ctx.save();
    roundRect(ctx, x + 4, y + 4, TILE - 8, TILE - 8, 3);
    ctx.clip();
    ctx.globalAlpha = 0.28;
    ctx.fillStyle = '#fffbe0';
    ctx.beginPath();
    ctx.moveTo(x - 12 + shine * 70, y);
    ctx.lineTo(x + 2 + shine * 70, y);
    ctx.lineTo(x + 16 + shine * 70, y + TILE);
    ctx.lineTo(x + 2 + shine * 70, y + TILE);
    ctx.closePath();
    ctx.fill();
    ctx.restore();

    ctx.fillStyle = '#8a4e0c';
    ctx.font = '900 27px "Trebuchet MS", sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('?', x + TILE / 2, y + TILE / 2 + 2);
    ctx.fillStyle = 'rgba(255, 248, 190, .6)';
    ctx.fillText('?', x + TILE / 2 - 1, y + TILE / 2);
    ctx.textAlign = 'left';
    ctx.textBaseline = 'alphabetic';

    ctx.fillStyle = 'rgba(255,255,255,.45)';
    for (const [dx, dy] of [[7, 7], [TILE - 7, 7], [7, TILE - 7], [TILE - 7, TILE - 7]]) {
      ctx.beginPath();
      ctx.arc(x + dx, y + dy, 1.8, 0, TAU);
      ctx.fill();
    }
  }
}

function drawPipes(g, ctx, left, right) {
  const t = g.theme;
  for (const p of g.level.pipes) {
    const x = p.x * TILE;
    const y = p.top * TILE;
    const w = 2 * TILE;
    const h = p.h * TILE;
    if (x + w < left || x > right) continue;

    const body = ctx.createLinearGradient(x, 0, x + w, 0);
    body.addColorStop(0, t.pipeDark);
    body.addColorStop(0.25, t.pipeLight);
    body.addColorStop(0.55, t.pipe);
    body.addColorStop(1, t.pipeDark);
    ctx.fillStyle = body;
    ctx.fillRect(x + 8, y + 20, w - 16, h - 20);
    ctx.fillStyle = 'rgba(255,255,255,.24)';
    ctx.fillRect(x + 16, y + 22, 7, h - 24);
    ctx.fillStyle = 'rgba(0,0,0,.22)';
    ctx.fillRect(x + w - 22, y + 22, 9, h - 22);

    const cap = ctx.createLinearGradient(x, 0, x + w, 0);
    cap.addColorStop(0, t.pipeDark);
    cap.addColorStop(0.3, t.pipeLight);
    cap.addColorStop(0.6, t.pipe);
    cap.addColorStop(1, t.pipeDark);
    ctx.fillStyle = cap;
    roundRect(ctx, x - 5, y, w + 10, 26, 6);
    ctx.fill();
    ctx.strokeStyle = 'rgba(10, 20, 14, .4)';
    ctx.lineWidth = 2.5;
    ctx.strokeRect(x + 8, y + 24, w - 16, Math.max(0, h - 24));
    ctx.strokeStyle = 'rgba(255,255,255,.35)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(x + 2, y + 6);
    ctx.lineTo(x + w - 2, y + 6);
    ctx.stroke();
    ctx.fillStyle = 'rgba(8, 18, 12, .32)';
    ellipse(ctx, x + w / 2, y + 1, w / 2 - 6, 3);
    ctx.fill();
  }
}

function drawMovers(g, ctx) {
  const t = g.theme;
  for (const m of g.level.movers) {
    if (m.x + m.w < g.camera.x - 100 || m.x > g.camera.x + g.viewW + 100) continue;
    ctx.fillStyle = 'rgba(0,0,0,.18)';
    ellipse(ctx, m.x + m.w / 2, m.y + m.h + 14, m.w * 0.44, 6);
    ctx.fill();

    const grd = ctx.createLinearGradient(0, m.y, 0, m.y + m.h);
    grd.addColorStop(0, t.stoneLight);
    grd.addColorStop(0.5, t.stone);
    grd.addColorStop(1, t.stoneDark);
    ctx.fillStyle = grd;
    roundRect(ctx, m.x, m.y, m.w, m.h, 6);
    ctx.fill();
    ctx.strokeStyle = 'rgba(25, 20, 40, .65)';
    ctx.lineWidth = 2.5;
    ctx.stroke();
    ctx.fillStyle = t.accent;
    ctx.globalAlpha = 0.4 + 0.3 * Math.sin(g.animClock * 3 + m.phase);
    ctx.fillRect(m.x + 4, m.y + 3, m.w - 8, 3);
    ctx.globalAlpha = 1;

    const cx = m.x + m.w / 2;
    const cy = m.y + m.h / 2 + 3;
    ctx.strokeStyle = 'rgba(255, 248, 231, .65)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    if (m.axis === 'x') {
      ctx.moveTo(cx - 16, cy);
      ctx.lineTo(cx + 16, cy);
      ctx.moveTo(cx - 16, cy);
      ctx.lineTo(cx - 10, cy - 5);
      ctx.moveTo(cx - 16, cy);
      ctx.lineTo(cx - 10, cy + 5);
      ctx.moveTo(cx + 16, cy);
      ctx.lineTo(cx + 10, cy - 5);
      ctx.moveTo(cx + 16, cy);
      ctx.lineTo(cx + 10, cy + 5);
    } else {
      ctx.moveTo(cx, cy - 13);
      ctx.lineTo(cx, cy + 13);
      ctx.moveTo(cx, cy - 13);
      ctx.lineTo(cx - 5, cy - 7);
      ctx.moveTo(cx, cy - 13);
      ctx.lineTo(cx + 5, cy - 7);
      ctx.moveTo(cx, cy + 13);
      ctx.lineTo(cx - 5, cy + 7);
      ctx.moveTo(cx, cy + 13);
      ctx.lineTo(cx + 5, cy + 7);
    }
    ctx.stroke();
  }
}

function drawSprings(g, ctx) {
  for (const s of g.level.springs) {
    if (s.x + s.w < g.camera.x - 100 || s.x > g.camera.x + g.viewW + 100) continue;
    const base = s.baseY;
    const compress = s.anim * 7;
    const top = s.y + compress;
    ctx.fillStyle = 'rgba(0,0,0,.2)';
    ellipse(ctx, s.x + s.w / 2, base - 1, 27, 5);
    ctx.fill();
    ctx.strokeStyle = '#c98a22';
    ctx.lineWidth = 3;
    ctx.beginPath();
    const coils = 3;
    for (let i = 0; i <= coils * 2; i++) {
      const yy = base - 6 - (i / (coils * 2)) * (base - 8 - (top + 10));
      const xx = s.x + s.w / 2 + (i % 2 === 0 ? -13 : 13);
      if (i === 0) ctx.moveTo(xx, yy);
      else ctx.lineTo(xx, yy);
    }
    ctx.stroke();

    const grd = ctx.createLinearGradient(0, top, 0, top + 14);
    grd.addColorStop(0, '#ffe89a');
    grd.addColorStop(0.5, '#ffd15c');
    grd.addColorStop(1, '#d9901f');
    ctx.fillStyle = grd;
    roundRect(ctx, s.x, top, s.w, 14, 7);
    ctx.fill();
    ctx.strokeStyle = '#9a5a0e';
    ctx.lineWidth = 2.5;
    ctx.stroke();
    ctx.fillStyle = '#7a430a';
    ctx.beginPath();
    ctx.moveTo(s.x + s.w / 2, top + 3);
    ctx.lineTo(s.x + s.w / 2 - 7, top + 10);
    ctx.lineTo(s.x + s.w / 2 + 7, top + 10);
    ctx.closePath();
    ctx.fill();
  }
}

function drawCheckpoints(g, ctx) {
  for (const cp of g.level.checkpoints) {
    if (cp.x < g.camera.x - 160 || cp.x > g.camera.x + g.viewW + 160) continue;
    const active = cp.active;
    const baseY = cp.y;
    const top = baseY - 104;
    ctx.fillStyle = 'rgba(0,0,0,.18)';
    ellipse(ctx, cp.x, baseY + 1, 20, 5);
    ctx.fill();

    ctx.fillStyle = g.theme.stoneDark;
    roundRect(ctx, cp.x - 15, baseY - 10, 30, 10, 3);
    ctx.fill();
    ctx.strokeStyle = 'rgba(20, 15, 30, .5)';
    ctx.lineWidth = 2;
    ctx.stroke();

    ctx.strokeStyle = active ? '#52e0c4' : 'rgba(200, 205, 220, .55)';
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.moveTo(cp.x, baseY - 8);
    ctx.lineTo(cp.x, top);
    ctx.stroke();

    if (active) {
      const glow = ctx.createRadialGradient(cp.x, top + 20, 2, cp.x, top + 20, 70);
      glow.addColorStop(0, 'rgba(82, 224, 196, .28)');
      glow.addColorStop(1, 'rgba(82, 224, 196, 0)');
      ctx.fillStyle = glow;
      ctx.beginPath();
      ctx.arc(cp.x, top + 20, 70, 0, TAU);
      ctx.fill();
    }

    ctx.fillStyle = active ? '#ffd15c' : '#b8becd';
    drawStar(ctx, cp.x, top - 4, 6, 5, 0.45);
    ctx.fill();

    const wave = Math.sin(cp.t * 4 + cp.x * 0.02) * 3;
    ctx.fillStyle = active ? '#52e0c4' : 'rgba(190, 196, 210, .65)';
    ctx.beginPath();
    ctx.moveTo(cp.x + 2, top + 2);
    ctx.quadraticCurveTo(cp.x + 22, top + 2 + wave, cp.x + 34, top + 8 + wave);
    ctx.quadraticCurveTo(cp.x + 22, top + 12 + wave, cp.x + 2, top + 30);
    ctx.closePath();
    ctx.fill();
    if (active) {
      ctx.fillStyle = 'rgba(8, 40, 40, .4)';
      drawStar(ctx, cp.x + 12, top + 13 + wave * 0.4, 6, 5, 0.44);
      ctx.fill();
    }
  }
}

function drawGoal(g, ctx) {
  const goal = g.level.goal;
  if (!goal) return;
  if (goal.x < g.camera.x - 320 || goal.x > g.camera.x + g.viewW + 320) return;
  const baseY = goal.y;
  const top = baseY - 286;

  const glow = ctx.createRadialGradient(goal.x, top + 16, 4, goal.x, top + 16, 110);
  glow.addColorStop(0, 'rgba(255, 209, 92, .3)');
  glow.addColorStop(1, 'rgba(255, 209, 92, 0)');
  ctx.fillStyle = glow;
  ctx.beginPath();
  ctx.arc(goal.x, top + 16, 110, 0, TAU);
  ctx.fill();

  ctx.fillStyle = g.theme.stoneDark;
  roundRect(ctx, goal.x - 26, baseY - 12, 52, 12, 4);
  ctx.fill();
  ctx.fillStyle = g.theme.stone;
  roundRect(ctx, goal.x - 19, baseY - 20, 38, 10, 3);
  ctx.fill();

  const pole = ctx.createLinearGradient(goal.x - 4, 0, goal.x + 4, 0);
  pole.addColorStop(0, '#8b91a5');
  pole.addColorStop(0.4, '#f6f7fb');
  pole.addColorStop(1, '#7b8398');
  ctx.fillStyle = pole;
  ctx.fillRect(goal.x - 3, top, 6, baseY - 16);

  ctx.fillStyle = '#ffd15c';
  ctx.strokeStyle = '#9a5a0e';
  ctx.lineWidth = 2;
  drawStar(ctx, goal.x, top - 6, 16, 5, 0.45);
  ctx.fill();
  ctx.stroke();

  const wave = Math.sin(g.animClock * 2.4) * 4;
  ctx.fillStyle = g.theme.accent;
  ctx.beginPath();
  ctx.moveTo(goal.x + 4, top + 18);
  ctx.quadraticCurveTo(goal.x + 54, top + 12 + wave, goal.x + 86, top + 28 + wave);
  ctx.quadraticCurveTo(goal.x + 54, top + 46 + wave, goal.x + 4, top + 66);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = g.theme.stoneDark;
  ctx.beginPath();
  ctx.arc(goal.x + 40, top + 38 + wave * 0.5, 12, 0, TAU);
  ctx.fill();
  ctx.fillStyle = '#ffd15c';
  drawStar(ctx, goal.x + 40, top + 38 + wave * 0.5, 9, 5, 0.45);
  ctx.fill();

  const tw = (Math.sin(g.animClock * 3.7) + 1) / 2;
  ctx.globalAlpha = 0.4 + tw * 0.6;
  ctx.fillStyle = '#fff6c8';
  drawStar(ctx, goal.x - 10, top - 20, 4 + tw * 2, 4, 0.4);
  ctx.fill();
  ctx.globalAlpha = 1;
}

function drawCoins(g, ctx, left, right) {
  for (const c of g.level.coins) {
    if (c.collected) continue;
    if (c.x < left - 30 || c.x > right + 30) continue;
    const bob = Math.sin(g.animClock * 2.4 + c.phase) * 3;
    drawCoin(ctx, c.x, c.y + bob, c.r, c.phase, g.animClock);
  }
}

/* ------------------------------------------------------------------ */
/*  Enemies                                                            */
/* ------------------------------------------------------------------ */

function drawEnemies(g, ctx, left, right) {
  for (const e of g.level.enemies) {
    if (!e.alive) continue;
    if (e.x + e.w < left - 60 || e.x > right + 60) continue;
    if (e.dead && e.deadT > 0.75) continue;
    if (!e.dead) drawEnemy(g, ctx, e);
    else drawSquashedEnemy(g, ctx, e);
  }
}

function drawEnemy(g, ctx, e) {
  const cx = e.x + e.w / 2;
  const base = e.y + e.h;
  if (e.type === 'flyer') {
    drawFlyer(g, ctx, e, cx, base);
    return;
  }
  ctx.fillStyle = 'rgba(6, 10, 24, .22)';
  ellipse(ctx, cx, base + 2, e.w * 0.44, 5);
  ctx.fill();

  ctx.save();
  ctx.translate(cx, base);
  const waddle = Math.sin(e.t * 9) * 2;
  ctx.fillStyle = '#41251a';
  roundRect(ctx, -15 + waddle, -7, 12, 7, 3);
  ctx.fill();
  roundRect(ctx, 3 - waddle, -7, 12, 7, 3);
  ctx.fill();

  if (e.type === 'spiky') {
    ctx.fillStyle = '#8d5fe0';
    ctx.strokeStyle = '#3a2465';
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.moveTo(-19, -5);
    ctx.quadraticCurveTo(-19, -31, 0, -33);
    ctx.quadraticCurveTo(19, -31, 19, -5);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = '#d7c2ff';
    for (let i = 0; i < 5; i++) {
      const a = -Math.PI + (i + 0.5) * (Math.PI / 5);
      const sx = Math.cos(a) * 18;
      const sy = Math.sin(a) * 18 - 5;
      ctx.beginPath();
      ctx.moveTo(sx - 5, sy + 6);
      ctx.lineTo(sx + Math.cos(a) * 10, sy + Math.sin(a) * 10 - 2);
      ctx.lineTo(sx + 5, sy + 8);
      ctx.closePath();
      ctx.fill();
      ctx.strokeStyle = '#4a2f7a';
      ctx.lineWidth = 1.5;
      ctx.stroke();
    }

    ctx.fillStyle = '#f3e6ff';
    ellipse(ctx, -6, -16, 4.2, 4.4);
    ctx.fill();
    ellipse(ctx, 6, -16, 4.2, 4.4);
    ctx.fill();
    ctx.fillStyle = '#ff3d55';
    ellipse(ctx, -6 + Math.sign(e.vx) * 1.2, -16, 2, 2.3);
    ctx.fill();
    ellipse(ctx, 6 + Math.sign(e.vx) * 1.2, -16, 2, 2.3);
    ctx.fill();
    ctx.strokeStyle = '#2a173f';
    ctx.lineWidth = 1.8;
    ctx.beginPath();
    ctx.moveTo(-10, -22);
    ctx.lineTo(-3, -20);
    ctx.moveTo(10, -22);
    ctx.lineTo(3, -20);
    ctx.stroke();
    ctx.fillStyle = '#fff';
    ctx.beginPath();
    ctx.moveTo(-3, -9);
    ctx.lineTo(3, -9);
    ctx.lineTo(0, -5);
    ctx.closePath();
    ctx.fill();
  } else {
    const bodyGrad = ctx.createLinearGradient(0, -33, 0, -3);
    bodyGrad.addColorStop(0, '#c47c4c');
    bodyGrad.addColorStop(1, '#93552f');
    ctx.fillStyle = bodyGrad;
    ctx.strokeStyle = '#4a2517';
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.moveTo(-19, -5);
    ctx.quadraticCurveTo(-19, -31, 0, -33);
    ctx.quadraticCurveTo(19, -31, 19, -5);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = '#f0c79b';
    ellipse(ctx, 0, -15, 12, 8);
    ctx.fill();

    const look = Math.sign(e.vx) * 1.5;
    ctx.fillStyle = '#fffdf4';
    ellipse(ctx, -5, -20, 4, 4.4);
    ctx.fill();
    ellipse(ctx, 5, -20, 4, 4.4);
    ctx.fill();
    ctx.fillStyle = '#241a24';
    ellipse(ctx, -5 + look, -20, 1.8, 2.4);
    ctx.fill();
    ellipse(ctx, 5 + look, -20, 1.8, 2.4);
    ctx.fill();

    ctx.strokeStyle = '#4a2517';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(-9, -26);
    ctx.lineTo(-2, -24);
    ctx.moveTo(9, -26);
    ctx.lineTo(2, -24);
    ctx.stroke();

    ctx.fillStyle = '#4a2517';
    ctx.beginPath();
    ctx.ellipse(0, -11, 4.5, 2.6, 0, 0, Math.PI);
    ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,.22)';
    ellipse(ctx, -7, -27, 5, 3, -0.4);
    ctx.fill();
  }
  ctx.restore();
}

function drawSquashedEnemy(g, ctx, e) {
  const cx = e.x + e.w / 2;
  const base = e.y + e.h;
  const fade = 1 - e.deadT / 0.75;
  ctx.save();
  ctx.globalAlpha = Math.max(0, fade);
  ctx.translate(cx, base);
  ctx.scale(1.15, 0.28);
  ctx.fillStyle = e.type === 'spiky' ? '#8d5fe0' : '#b06a3f';
  ctx.strokeStyle = '#3a2465';
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.ellipse(0, -14, 19, 17, 0, 0, TAU);
  ctx.fill();
  ctx.stroke();
  ctx.restore();
}

function drawFlyer(g, ctx, e, cx, base) {
  const cy = e.y + e.h / 2;
  const flap = Math.sin(e.t * 12);
  ctx.save();
  ctx.translate(cx, cy);
  ctx.fillStyle = 'rgba(150, 110, 255, .16)';
  ellipse(ctx, 0, base - cy + 16, 20, 5);
  ctx.fill();

  ctx.fillStyle = '#4a3172';
  ctx.strokeStyle = '#241638';
  ctx.lineWidth = 2;
  // wings
  for (const side of [-1, 1]) {
    ctx.beginPath();
    ctx.moveTo(side * 6, -2);
    ctx.quadraticCurveTo(side * 28, -14 - flap * 9, side * 33, 2 - flap * 7);
    ctx.quadraticCurveTo(side * 24, 6, side * 8, 7);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
  }
  ctx.fillStyle = '#6b4a9e';
  ellipse(ctx, 0, 1, 12, 11);
  ctx.fill();
  ctx.stroke();
  // ears
  ctx.fillStyle = '#6b4a9e';
  for (const side of [-1, 1]) {
    ctx.beginPath();
    ctx.moveTo(side * 5, -8);
    ctx.lineTo(side * 11, -19);
    ctx.lineTo(side * 12, -5);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
  }
  ctx.fillStyle = '#ff4d67';
  ellipse(ctx, -4, -1, 2.8, 3.4);
  ctx.fill();
  ellipse(ctx, 4, -1, 2.8, 3.4);
  ctx.fill();
  ctx.fillStyle = '#fff';
  ctx.beginPath();
  ctx.moveTo(-3, 5);
  ctx.lineTo(0, 9);
  ctx.lineTo(3, 5);
  ctx.closePath();
  ctx.fill();
  ctx.restore();
}

/* ------------------------------------------------------------------ */
/*  Player                                                             */
/* ------------------------------------------------------------------ */

function drawPlayer(g, ctx) {
  const p = g.player;
  if (!p) return;
  const cx = p.x + p.w / 2;
  const feet = p.y + p.h;
  const mult = g.jumpMult();

  if (p.onGround || p.celebrate) {
    ctx.globalAlpha = 0.24;
    ctx.fillStyle = '#071021';
    ellipse(ctx, cx, feet + 2, 17, 5.5);
    ctx.fill();
    ctx.globalAlpha = 1;
  }

  if (mult > 1.32) {
    const a = Math.min(0.42, (mult - 1.32) * 0.42);
    const aura = ctx.createRadialGradient(cx, feet - 24, 3, cx, feet - 24, 48);
    aura.addColorStop(0, `rgba(255, 222, 120, ${a})`);
    aura.addColorStop(0.55, `rgba(255, 190, 70, ${a * 0.45})`);
    aura.addColorStop(1, 'rgba(255, 170, 60, 0)');
    ctx.fillStyle = aura;
    ctx.beginPath();
    ctx.arc(cx, feet - 24, 48, 0, TAU);
    ctx.fill();
  }

  if (p.invuln > 0 && !p.celebrate && Math.floor(g.animClock * 18) % 2 === 0) return;

  ctx.save();
  ctx.translate(cx, feet);
  const face = p.facing >= 0 ? 1 : -1;
  const air = !p.onGround;
  const rise = air && p.vy < -120;
  const squash = p.squash;
  const sy = 1 - squash * 0.2 + (rise ? 0.05 : 0);
  const sx = 1 + squash * 0.16 - (rise ? 0.04 : 0);
  ctx.scale(face * sx, sy);

  const moving = p.onGround && Math.abs(p.vx) > 25;
  const phase = p.anim * 13;
  const swing = moving ? Math.sin(phase) : 0;
  const liftL = moving ? Math.max(0, Math.sin(phase)) * 3 : 0;
  const liftR = moving ? Math.max(0, -Math.sin(phase)) * 3 : 0;
  const armUp = p.celebrate || (air && p.vy < -100);

  const skin = '#ffc99b';
  const skinDark = '#e8a26e';
  const outline = '#3b1d16';
  const blue = '#3d64d8';
  const blueDark = '#243a8a';
  const red = '#ef4444';
  const redDark = '#8f1c25';

  // back arm
  drawArm(ctx, -11, -30, armUp ? -15 : -14 + swing * 2, armUp ? -43 : -17, red, redDark, skin, outline);

  // back leg
  const backAnkleX = air ? -10 : -5 + swing * 5;
  const backAnkleY = air ? -9 : -4 - liftL;
  drawLeg(ctx, -5, -17, backAnkleX, backAnkleY, blueDark, skinDark, outline);
  drawShoe(ctx, backAnkleX, backAnkleY, air ? -0.25 : -0.05, '#4a281a');

  // front leg
  const frontAnkleX = air ? 8 : 5 - swing * 5;
  const frontAnkleY = air ? -7 : -4 - liftR;
  drawLeg(ctx, 5, -17, frontAnkleX, frontAnkleY, blue, skinDark, outline);
  drawShoe(ctx, frontAnkleX, frontAnkleY, air ? 0.18 : 0.02, '#5a301f');

  // torso
  ctx.fillStyle = red;
  ctx.strokeStyle = redDark;
  ctx.lineWidth = 2;
  roundRect(ctx, -12, -34, 24, 16, 6);
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = 'rgba(255,255,255,.16)';
  roundRect(ctx, -10, -32, 8, 10, 4);
  ctx.fill();

  // overalls
  ctx.fillStyle = blue;
  ctx.strokeStyle = blueDark;
  ctx.lineWidth = 2;
  roundRect(ctx, -11, -27, 22, 20, 5);
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = blue;
  roundRect(ctx, -7, -34, 14, 11, 3);
  ctx.fill();
  ctx.stroke();
  roundRect(ctx, -9, -38, 4, 12, 2);
  ctx.fill();
  ctx.stroke();
  roundRect(ctx, 5, -38, 4, 12, 2);
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = '#ffd15c';
  for (const bx of [-5, 5]) {
    ctx.beginPath();
    ctx.arc(bx, -26, 1.8, 0, TAU);
    ctx.fill();
  }
  ctx.strokeStyle = 'rgba(20, 30, 80, .5)';
  ctx.lineWidth = 1.4;
  ctx.beginPath();
  ctx.moveTo(-4, -22);
  ctx.lineTo(4, -22);
  ctx.stroke();

  // front arm
  drawArm(ctx, 11, -30, armUp ? 16 : 14 - swing * 2, armUp ? -43 : -17, red, redDark, skin, outline);

  // head
  ctx.fillStyle = skin;
  ctx.strokeStyle = outline;
  ctx.lineWidth = 2;
  roundRect(ctx, -10, -45, 20, 16, 7);
  ctx.fill();
  ctx.stroke();

  // hair sideburn
  ctx.fillStyle = '#4a2a1d';
  roundRect(ctx, -11, -41, 5, 9, 2);
  ctx.fill();
  ctx.strokeStyle = 'rgba(59,29,22,.5)';
  ctx.lineWidth = 1;
  ctx.stroke();

  // ear
  ctx.fillStyle = skinDark;
  ctx.beginPath();
  ctx.arc(-8, -37, 3, 0, TAU);
  ctx.fill();
  ctx.strokeStyle = outline;
  ctx.stroke();

  // eye
  ctx.fillStyle = '#fffdf5';
  ellipse(ctx, 4.5, -40, 3.4, 4);
  ctx.fill();
  ctx.strokeStyle = 'rgba(59,29,22,.65)';
  ctx.lineWidth = 1;
  ctx.stroke();
  ctx.fillStyle = '#1c2238';
  ellipse(ctx, 5.5, -40, 1.6, 2.4);
  ctx.fill();
  ctx.fillStyle = '#fff';
  ctx.beginPath();
  ctx.arc(6.4, -41.2, 0.7, 0, TAU);
  ctx.fill();

  // eyebrow
  ctx.strokeStyle = '#4a2a1d';
  ctx.lineWidth = 1.8;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(2.5, -45);
  ctx.lineTo(7.5, -44.4);
  ctx.stroke();

  // nose
  ctx.fillStyle = skinDark;
  ctx.beginPath();
  ctx.arc(10.5, -36.5, 3.2, 0, TAU);
  ctx.fill();
  ctx.strokeStyle = outline;
  ctx.lineWidth = 1.4;
  ctx.stroke();

  // moustache
  ctx.fillStyle = '#4a2a1d';
  ctx.beginPath();
  ctx.ellipse(6, -33.5, 4.2, 2.6, -0.1, 0, TAU);
  ctx.fill();
  ctx.beginPath();
  ctx.ellipse(11, -33, 3.2, 2.2, 0.15, 0, TAU);
  ctx.fill();

  // cap
  ctx.fillStyle = red;
  ctx.strokeStyle = redDark;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(-11, -45);
  ctx.quadraticCurveTo(-11, -54, 0, -54);
  ctx.quadraticCurveTo(11, -54, 11, -45);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = redDark;
  ctx.beginPath();
  ctx.moveTo(2, -46);
  ctx.quadraticCurveTo(14, -47, 16, -43.5);
  ctx.quadraticCurveTo(12, -42.5, 3, -43);
  ctx.closePath();
  ctx.fill();

  // cap coin
  ctx.fillStyle = '#ffd15c';
  ctx.strokeStyle = '#8a5010';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.arc(-1, -48.5, 3.4, 0, TAU);
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = '#8a5010';
  drawStar(ctx, -1, -48.5, 1.7, 5, 0.45);
  ctx.fill();

  if (p.celebrate) {
    ctx.fillStyle = '#ffd15c';
    drawStar(ctx, -20, -50, 4, 4, 0.4);
    ctx.fill();
    drawStar(ctx, 21, -55, 3, 4, 0.4);
    ctx.fill();
  }

  ctx.restore();

  if (mult > 1.7 && !p.celebrate) {
    for (let i = 0; i < 3; i++) {
      const a = g.animClock * 2.4 + (i / 3) * TAU;
      const sx = cx + Math.cos(a) * 24;
      const sy = feet - 24 + Math.sin(a * 1.3) * 30;
      ctx.globalAlpha = 0.35 + 0.35 * Math.sin(g.animClock * 4 + i);
      ctx.fillStyle = '#ffe89a';
      ctx.beginPath();
      ctx.arc(sx, sy, 2.2, 0, TAU);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
  }
}

function drawArm(ctx, sx, sy, hx, hy, color, dark, skin, outline) {
  ctx.lineCap = 'round';
  ctx.strokeStyle = outline;
  ctx.lineWidth = 8.5;
  ctx.beginPath();
  ctx.moveTo(sx, sy);
  ctx.quadraticCurveTo((sx + hx) / 2 + 2, (sy + hy) / 2, hx, hy);
  ctx.stroke();
  ctx.strokeStyle = color;
  ctx.lineWidth = 5.5;
  ctx.stroke();
  ctx.fillStyle = skin;
  ctx.strokeStyle = outline;
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.arc(hx, hy, 3.2, 0, TAU);
  ctx.fill();
  ctx.stroke();
}

function drawLeg(ctx, hx, hy, ax, ay, color, skin, outline) {
  ctx.lineCap = 'round';
  ctx.strokeStyle = outline;
  ctx.lineWidth = 10;
  ctx.beginPath();
  ctx.moveTo(hx, hy);
  ctx.lineTo(ax, ay);
  ctx.stroke();
  ctx.strokeStyle = color;
  ctx.lineWidth = 7;
  ctx.stroke();
}

function drawShoe(ctx, x, y, rot, color) {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(rot);
  ctx.fillStyle = color;
  ctx.strokeStyle = '#2a140c';
  ctx.lineWidth = 1.6;
  roundRect(ctx, -2, -5, 14, 7, 3);
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = 'rgba(0,0,0,.32)';
  roundRect(ctx, -2, 0, 14, 2.5, 1);
  ctx.fill();
  ctx.restore();
}

/* ------------------------------------------------------------------ */
/*  Particles + text                                                   */
/* ------------------------------------------------------------------ */

function drawParticleField(g, ctx) {
  for (const p of g.particles) {
    const a = clamp(p.life / p.maxLife, 0, 1);
    ctx.globalAlpha = a;
    if (p.kind === 'confetti') {
      ctx.save();
      ctx.translate(p.x, p.y);
      ctx.rotate(p.rot);
      ctx.fillStyle = p.color;
      ctx.fillRect(-p.size / 2, -p.size / 4, p.size, p.size / 2);
      ctx.restore();
    } else if (p.kind === 'dust') {
      ctx.fillStyle = p.color;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.size * (0.5 + (1 - a) * 0.7), 0, TAU);
      ctx.fill();
    } else {
      ctx.fillStyle = p.color;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.size * (0.6 + a * 0.5), 0, TAU);
      ctx.fill();
      if (p.size > 3.5) {
        ctx.globalAlpha = a * 0.65;
        ctx.fillStyle = '#fffbe0';
        ctx.beginPath();
        ctx.arc(p.x - p.size * 0.2, p.y - p.size * 0.2, p.size * 0.3, 0, TAU);
        ctx.fill();
      }
    }
  }
  ctx.globalAlpha = 1;
}

function drawFloatingTexts(g, ctx) {
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  for (const t of g.texts) {
    const a = clamp(t.life / t.maxLife, 0, 1);
    const pop = 1 + (1 - a) * 0.15;
    ctx.save();
    ctx.translate(t.x, t.y);
    ctx.scale(pop, pop);
    ctx.globalAlpha = Math.min(1, a * 2.2);
    ctx.font = `900 ${t.size}px "Trebuchet MS", sans-serif`;
    ctx.lineWidth = Math.max(3, t.size * 0.22);
    ctx.strokeStyle = 'rgba(12, 14, 32, .8)';
    ctx.strokeText(t.text, 0, 0);
    ctx.fillStyle = t.color;
    ctx.fillText(t.text, 0, 0);
    ctx.restore();
  }
  ctx.globalAlpha = 1;
  ctx.textAlign = 'left';
  ctx.textBaseline = 'alphabetic';
}
