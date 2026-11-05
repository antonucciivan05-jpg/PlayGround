import { makeLevel, TILE, THEMES } from './levels.js';
import { fmtTime } from './ui.js';
import { renderGame } from './render.js';

const PLAYER_W = 30;
const PLAYER_H = 42;

const BASE_JUMP = 730;
const JUMP_RANGE = 790;
const JUMP_CURVE = 32;
const GRAVITY = 2200;
const MAX_FALL = 1250;
const RUN_MAX = 300;
const ACCEL = 2500;
const AIR_ACCEL = 1750;
const FRICTION = 2900;
const COYOTE = 0.1;
const JUMP_BUFFER = 0.13;
const MAX_HEARTS = 3;
const BEST_KEY = 'coinjump.best.v1';
const TAU = Math.PI * 2;

const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
const approach = (v, target, step) => (v < target ? Math.min(v + step, target) : Math.max(v - step, target));

function hash(n) {
  const x = Math.sin(n * 127.1 + 311.7) * 43758.5453;
  return x - Math.floor(x);
}

export class Game {
  constructor(canvas, ui, sound) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d', { alpha: false });
    this.ui = ui;
    this.sound = sound;

    this.dpr = 1;
    this.cssW = 1;
    this.cssH = 1;
    this.viewW = 960;
    this.viewH = 540;
    this.scale = 1;
    this.vignette = null;

    this.input = { left: false, right: false, jump: false };
    this.levelIndex = 0;
    this.level = null;
    this.theme = THEMES.meadow;
    this.player = null;
    this.results = [null, null, null];
    this.activeCheckpoint = null;
    this.hearts = MAX_HEARTS;
    this.coinsThisLevel = 0;
    this.stompsThisLevel = 0;
    this.jumpsThisLevel = 0;
    this.levelTime = 0;
    this.maxRunMult = 1;
    this.best = this.loadBest();
    this.state = 'title';
    this.attract = 0;
    this.animClock = 0;
    this.shake = 0;
    this.flash = 0;
    this.flashColor = '#ff4d5d';
    this.clearT = 0;
    this.particles = [];
    this.texts = [];
    this.accumulator = 0;
    this.lastTs = 0;
    this.raf = 0;

    this.stars = [];
    for (let i = 0; i < 70; i++) {
      this.stars.push({
        x: hash(i * 3.17 + 1),
        y: hash(i * 7.71 + 2) * 0.52,
        r: 0.7 + hash(i * 5.3 + 4) * 1.7,
        p: hash(i * 2.9 + 6) * TAU,
        s: 0.6 + hash(i * 9.1 + 3) * 1.4,
      });
    }

    this.prepareLevel(0);
    this.ui.setBestLine(this.best);
    this.ui.setSoundMuted(this.sound.muted);
    this.ui.showScreen('titleScreen');
    this.ui.setPlaying(false);

    this.resize();
    this.snapTitleCamera();
    this.bindEvents();

    this.lastTs = performance.now();
    this.raf = requestAnimationFrame((t) => this.loop(t));
  }

  /* ------------------------------------------------------------------ */
  /*  Setup                                                              */
  /* ------------------------------------------------------------------ */

  loadBest() {
    try {
      const raw = localStorage.getItem(BEST_KEY);
      if (!raw) return null;
      const v = JSON.parse(raw);
      if (typeof v.coins === 'number' && typeof v.time === 'number') return v;
    } catch {}
    return null;
  }

  saveBest(coins, time) {
    const prev = this.best;
    const better = !prev || coins > prev.coins || (coins === prev.coins && time < prev.time);
    if (better) {
      this.best = { coins, time };
      try { localStorage.setItem(BEST_KEY, JSON.stringify(this.best)); } catch {}
    }
    return better;
  }

  prepareLevel(index) {
    this.levelIndex = index;
    this.level = makeLevel(index);
    this.theme = THEMES[this.level.theme] || THEMES.meadow;
    this.collisionSolids = [...this.level.solids, ...this.level.movers, ...this.level.springs];
    this.player = this.makePlayer();
    this.camera = { x: 0, y: 0 };
    this.snapCamera();
  }

  getSpawn() {
    if (this.activeCheckpoint) {
      return { x: this.activeCheckpoint.x - 24, y: this.activeCheckpoint.y };
    }
    return { x: this.level.spawn.x, y: this.level.spawn.y };
  }

  makePlayer() {
    const sp = this.getSpawn();
    return {
      x: sp.x - PLAYER_W / 2,
      y: sp.y - PLAYER_H,
      w: PLAYER_W,
      h: PLAYER_H,
      vx: 0,
      vy: 0,
      facing: 1,
      onGround: false,
      coyote: 0,
      jumpBuffer: 0,
      invuln: 0,
      anim: 0,
      squash: 0,
      dustT: 0,
      springT: 0,
      carrier: null,
      prevY: sp.y - PLAYER_H,
      celebrate: false,
      dead: false,
    };
  }

  resize() {
    const rect = this.canvas.getBoundingClientRect();
    const cssW = Math.max(1, rect.width || window.innerWidth);
    const cssH = Math.max(1, rect.height || window.innerHeight);
    const dpr = Math.min(window.devicePixelRatio || 1, 2);

    this.cssW = cssW;
    this.cssH = cssH;
    this.dpr = dpr;
    this.canvas.width = Math.round(cssW * dpr);
    this.canvas.height = Math.round(cssH * dpr);

    const aspect = cssW / cssH;
    let viewW;
    let viewH;
    if (aspect >= 1.08) {
      viewH = 560;
      viewW = viewH * aspect;
      if (viewW > 1060) {
        viewW = 1060;
        viewH = viewW / aspect;
      }
    } else {
      viewW = 420;
      viewH = viewW / aspect;
      if (viewH > 900) {
        viewH = 900;
        viewW = viewH * aspect;
      }
    }
    this.viewW = viewW;
    this.viewH = viewH;
    this.scale = cssW / viewW;

    const ctx = this.ctx;
    const v = ctx.createRadialGradient(
      cssW / 2, cssH * 0.46, Math.min(cssW, cssH) * 0.22,
      cssW / 2, cssH * 0.52, Math.max(cssW, cssH) * 0.74,
    );
    v.addColorStop(0, 'rgba(0,0,0,0)');
    v.addColorStop(0.72, 'rgba(3,6,18,.08)');
    v.addColorStop(1, 'rgba(3,5,15,.46)');
    this.vignette = v;
  }

  cameraTarget() {
    const l = this.level;
    const p = this.player;
    let tx = p ? p.x + p.w / 2 - this.viewW * 0.44 + p.facing * this.viewW * 0.045 : 0;
    let ty = p ? p.y + p.h * 0.55 - this.viewH * 0.56 - Math.min(0, p.vy) * 0.045 : 0;
    if (this.viewW >= l.worldW) tx = (l.worldW - this.viewW) / 2;
    else tx = clamp(tx, 0, l.worldW - this.viewW);
    if (this.viewH >= l.worldH) ty = l.worldH - this.viewH;
    else ty = clamp(ty, 0, l.worldH - this.viewH);
    return { tx, ty };
  }

  snapCamera() {
    const { tx, ty } = this.cameraTarget();
    this.camera.x = tx;
    this.camera.y = ty;
  }

  updateCamera(dt) {
    const { tx, ty } = this.cameraTarget();
    const k = 1 - Math.exp(-dt * (this.player && this.player.onGround ? 9 : 5.5));
    this.camera.x += (tx - this.camera.x) * k;
    this.camera.y += (ty - this.camera.y) * k;
  }

  snapTitleCamera() {
    if (!this.level) return;
    this.camera.y = this.viewH >= this.level.worldH
      ? this.level.worldH - this.viewH
      : clamp(12 * TILE - this.viewH * 0.78, 0, this.level.worldH - this.viewH);
    this.camera.x = 200;
    this.attract = 0;
  }

  updateTitle(dt) {
    this.attract += dt;
    const maxX = Math.max(0, this.level.worldW - this.viewW - 240);
    const span = Math.min(maxX, 1700);
    const t = (Math.sin(this.attract * 0.13 - Math.PI / 2) + 1) / 2;
    this.camera.x = 200 + t * span;
    if (this.player) this.player.anim += dt * 0.5;
  }

  /* ------------------------------------------------------------------ */
  /*  Flow                                                               */
  /* ------------------------------------------------------------------ */

  startRun() {
    if (this.state !== 'title' && this.state !== 'win') return;
    this.sound.init();
    this.results = [null, null, null];
    this.maxRunMult = 1;
    this.hearts = MAX_HEARTS;
    this.startLevel(0);
  }

  startLevel(index) {
    this.results = this.results.map((r, i) => (i < index ? r : null));
    this.activeCheckpoint = null;
    this.prepareLevel(index);
    this.coinsThisLevel = 0;
    this.stompsThisLevel = 0;
    this.jumpsThisLevel = 0;
    this.levelTime = 0;
    this.hearts = MAX_HEARTS;
    this.particles = [];
    this.texts = [];
    this.shake = 0;
    this.flash = 0;
    this.clearT = 0;
    this.state = 'playing';
    this.player.invuln = 0.6;
    this.snapCamera();
    this.clearInput();

    this.ui.setPlaying(true);
    this.ui.showScreen(null);
    this.ui.setHearts(MAX_HEARTS);
    this.ui.resetHUDCache();
    this.ui.hideToast();
    this.syncHUD();

    const intros = [
      ['WORLD 1-1', this.level.name, 'Every coin boosts your jump!'],
      ['WORLD 2-1', this.level.name, 'Bigger gaps need bigger jumps!'],
      ['WORLD 3-1', this.level.name, 'Final castle — take the crown!'],
    ];
    const intro = intros[index] || [`WORLD ${index + 1}-1`, this.level.name, 'Every coin boosts your jump!'];
    this.ui.banner(intro[0], intro[1], intro[2]);
    this.sound.startMusic(index);
  }

  retry() {
    if (this.state !== 'gameover') return;
    this.startLevel(this.levelIndex);
  }

  advance() {
    if (this.state !== 'clear') return;
    this.sound.init();
    if (this.levelIndex >= 2) {
      this.showWin();
      return;
    }
    this.startLevel(this.levelIndex + 1);
  }

  showWin() {
    const totalCoins = this.results.reduce((a, r) => a + (r ? r.coins : 0), 0);
    const totalTime = this.results.reduce((a, r) => a + (r ? r.time : 0), 0);
    const possible = this.results.reduce((a, r) => a + (r ? r.total : 0), 0);
    const ratio = possible > 0 ? totalCoins / possible : 0;
    let flavor = 'You made it. The castle salutes you.';
    if (ratio >= 0.96) flavor = 'COIN MASTER — not a single coin left behind.';
    else if (ratio >= 0.78) flavor = 'Sky legend. The clouds know your name.';
    else if (ratio >= 0.5) flavor = 'A fine run. Every coin made you fly.';
    const isBest = this.saveBest(totalCoins, totalTime);
    this.ui.setBestLine(this.best);
    this.state = 'win';
    this.ui.setPlaying(false);
    this.ui.showWin({
      coins: totalCoins,
      time: totalTime,
      bestMult: this.maxRunMult,
      flavor,
      bestLine: isBest ? '★ NEW BEST RUN ★' : (this.best ? `Best: ${this.best.coins} coins · ${fmtTime(this.best.time)}` : ''),
    });
    this.sound.stopMusic();
    this.sound.win();
  }

  quitToTitle() {
    this.state = 'title';
    this.sound.stopMusic();
    this.results = [null, null, null];
    this.activeCheckpoint = null;
    this.prepareLevel(0);
    this.coinsThisLevel = 0;
    this.levelTime = 0;
    this.particles = [];
    this.texts = [];
    this.shake = 0;
    this.flash = 0;
    this.clearInput();
    this.ui.setPlaying(false);
    this.ui.showScreen('titleScreen');
    this.ui.setBestLine(this.best);
    this.ui.hideBanner();
    this.ui.hideToast();
    this.snapTitleCamera();
  }

  togglePause() {
    if (this.state === 'playing') {
      this.state = 'paused';
      this.clearInput();
      this.sound.stopMusic();
      this.ui.setTouchVisible(false);
      this.ui.showPause({
        coins: this.coinsThisLevel,
        total: this.level.totalCoins,
        mult: this.jumpMult(),
        hearts: this.hearts,
      });
    } else if (this.state === 'paused') {
      this.state = 'playing';
      this.clearInput();
      this.ui.showScreen(null);
      this.ui.setTouchVisible(true);
      this.sound.startMusic(this.levelIndex);
    }
  }

  toggleSound() {
    const muted = !this.sound.muted;
    this.sound.setMuted(muted);
    this.ui.setSoundMuted(muted);
    if (!muted && this.state === 'playing') this.sound.startMusic(this.levelIndex);
  }

  /* ------------------------------------------------------------------ */
  /*  Input + loop                                                       */
  /* ------------------------------------------------------------------ */

  setMove(act, on) {
    if (act === 'left') this.input.left = on;
    else if (act === 'right') this.input.right = on;
  }

  pressJump() {
    this.input.jump = true;
    if (this.state === 'playing' && this.player) {
      this.player.jumpBuffer = JUMP_BUFFER;
    }
  }

  releaseJump() {
    this.input.jump = false;
    const p = this.player;
    if (this.state === 'playing' && p && p.vy < -190) {
      p.vy *= 0.46;
    }
  }

  clearInput() {
    this.input.left = false;
    this.input.right = false;
    this.input.jump = false;
    document.querySelectorAll('.tbtn.active').forEach((el) => el.classList.remove('active'));
  }

  bindEvents() {
    window.addEventListener('keydown', (e) => {
      const k = e.key.toLowerCase();
      if (k === 'arrowleft' || k === 'arrowright' || k === 'arrowup' || k === 'arrowdown' || k === ' ') {
        e.preventDefault();
      }
      if (k === 'arrowleft' || k === 'a') this.setMove('left', true);
      if (k === 'arrowright' || k === 'd') this.setMove('right', true);
      if (k === ' ' || k === 'arrowup' || k === 'w') {
        if (!e.repeat) this.pressJump();
      }
      if (k === 'escape' || k === 'p') {
        if (this.state === 'playing' || this.state === 'paused') this.togglePause();
      }
      if (e.key === 'Enter') {
        if (this.state === 'title') this.startRun();
        else if (this.state === 'paused') this.togglePause();
        else if (this.state === 'gameover') this.retry();
        else if (this.state === 'clear') this.advance();
        else if (this.state === 'win') this.startRun();
      }
    });

    window.addEventListener('keyup', (e) => {
      const k = e.key.toLowerCase();
      if (k === 'arrowleft' || k === 'a') this.setMove('left', false);
      if (k === 'arrowright' || k === 'd') this.setMove('right', false);
      if (k === ' ' || k === 'arrowup' || k === 'w') this.releaseJump();
    });

    window.addEventListener('blur', () => this.clearInput());
    document.addEventListener('visibilitychange', () => {
      if (document.hidden && this.state === 'playing') this.togglePause();
    });
    window.addEventListener('resize', () => this.resize());
    if (window.ResizeObserver) {
      this.ro = new ResizeObserver(() => this.resize());
      this.ro.observe(this.canvas);
    }
    this.canvas.addEventListener('contextmenu', (e) => e.preventDefault());
  }

  loop(ts) {
    if (!this.lastTs) this.lastTs = ts;
    let dt = (ts - this.lastTs) / 1000;
    this.lastTs = ts;
    if (dt > 0.1) dt = 0.1;
    if (dt < 0) dt = 0;
    this.animClock += dt;

    this.accumulator = Math.min(this.accumulator + dt, 0.2);
    let steps = 0;
    while (this.accumulator >= 1 / 60 && steps < 8) {
      this.update(1 / 60);
      this.accumulator -= 1 / 60;
      steps++;
    }
    this.render();
    this.raf = requestAnimationFrame((t) => this.loop(t));
  }

  update(dt) {
    this.shake = Math.max(0, this.shake - dt * 26);
    if (this.flash > 0) this.flash = Math.max(0, this.flash - dt * 2.1);

    switch (this.state) {
      case 'title':
        this.updateTitle(dt);
        break;
      case 'playing':
        this.levelTime += dt;
        this.updateMovers(dt);
        this.updatePlayer(dt);
        if (this.state === 'playing') this.updateEnemies(dt);
        if (this.state === 'playing') this.updateBlocks(dt);
        this.updateParticles(dt);
        this.updateTexts(dt);
        this.syncHUD();
        if (this.state === 'playing') this.updateCamera(dt);
        break;
      case 'clearing':
        this.clearT += dt;
        this.updateParticles(dt);
        this.updateTexts(dt);
        this.updateCamera(dt);
        if (this.clearT > 1.4) this.finishClear();
        break;
      case 'clear':
      case 'gameover':
      case 'win':
        this.updateParticles(dt);
        this.updateTexts(dt);
        break;
      default:
        break;
    }
  }

  syncHUD() {
    const mult = this.jumpMult();
    if (mult > this.maxRunMult) this.maxRunMult = mult;
    const pct = Math.min(1, this.coinsThisLevel / 55);
    const hot = pct >= 1 ? 'max' : pct >= 0.55 ? 'hot' : null;
    this.ui.updateHUD({
      coins: this.coinsThisLevel,
      total: this.level.totalCoins,
      jumpMult: mult,
      jumpPct: pct,
      time: this.levelTime,
      world: `WORLD ${this.level.id}`,
      levelName: this.level.name,
      hot,
    });
  }

  jumpSpeed() {
    return BASE_JUMP + JUMP_RANGE * (1 - Math.exp(-this.coinsThisLevel / JUMP_CURVE));
  }

  jumpMult() {
    return this.jumpSpeed() / BASE_JUMP;
  }

  overlaps(a, b) {
    return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
  }

  solidAt(x, y, solids) {
    for (const s of solids) {
      if (x >= s.x && x <= s.x + s.w && y >= s.y && y <= s.y + s.h) return true;
    }
    return false;
  }

  updateMovers(dt) {
    for (const m of this.level.movers) {
      m.prevX = m.x;
      m.prevY = m.y;
      const off = Math.sin(this.levelTime * m.speed + m.phase) * m.range;
      if (m.axis === 'x') {
        m.x = m.ox + off;
        m.y = m.oy;
      } else {
        m.x = m.ox;
        m.y = m.oy + off;
      }
      if (this.player && this.player.carrier === m) {
        this.player.x += m.x - m.prevX;
        this.player.y += m.y - m.prevY;
      }
    }
    if (this.player) this.player.carrier = null;
  }

  updatePlayer(dt) {
    const p = this.player;
    const l = this.level;
    p.prevY = p.y;

    const dir = (this.input.right ? 1 : 0) - (this.input.left ? 1 : 0);
    if (dir !== 0) p.facing = dir;

    const accel = p.onGround ? ACCEL : AIR_ACCEL;
    if (dir !== 0) {
      const turning = p.vx !== 0 && Math.sign(dir) !== Math.sign(p.vx);
      p.vx += dir * accel * (turning ? 1.7 : 1) * dt;
      p.vx = clamp(p.vx, -RUN_MAX * 1.06, RUN_MAX * 1.06);
    } else {
      const fr = (p.onGround ? FRICTION : FRICTION * 0.3) * dt;
      p.vx = approach(p.vx, 0, fr);
    }
    if (Math.abs(p.vx) > RUN_MAX) {
      p.vx = approach(p.vx, Math.sign(p.vx) * RUN_MAX, 2000 * dt);
    }

    p.jumpBuffer = Math.max(0, p.jumpBuffer - dt);
    const canJump = p.onGround || p.coyote > 0;
    if (p.jumpBuffer > 0 && canJump) this.doJump();
    p.coyote = p.onGround ? COYOTE : Math.max(0, p.coyote - dt);

    p.vy = Math.min(p.vy + GRAVITY * dt, MAX_FALL);

    const wasGrounded = p.onGround;
    p.onGround = false;

    p.x += p.vx * dt;
    this.collideX(p);

    const fallSpeed = p.vy;
    p.y += p.vy * dt;
    this.collideY(p);

    if (p.x < 0) {
      p.x = 0;
      p.vx = Math.max(0, p.vx);
    }
    if (p.x + p.w > l.worldW) {
      p.x = l.worldW - p.w;
      p.vx = Math.min(0, p.vx);
    }
    if (p.y < 0) {
      p.y = 0;
      if (p.vy < 0) p.vy = 0;
    }

    if (p.onGround) p.coyote = COYOTE;
    if (!wasGrounded && p.onGround && fallSpeed > 420) {
      p.squash = Math.min(1, fallSpeed / 1150);
      this.spawnDust(p.x + p.w / 2, p.y + p.h, fallSpeed > 800 ? 8 : 4);
      if (fallSpeed > 950) this.shake = Math.max(this.shake, 3);
    }

    p.anim += dt * (p.onGround ? clamp(0.4 + Math.abs(p.vx) / 240, 0.4, 1.7) : 0.7);
    p.squash = Math.max(0, p.squash - dt * 4.2);
    p.invuln = Math.max(0, p.invuln - dt);
    p.springT = Math.max(0, p.springT - dt * 3);

    if (p.onGround && Math.abs(p.vx) > 170) {
      p.dustT -= dt;
      if (p.dustT <= 0) {
        p.dustT = 0.15;
        this.spawnDust(p.x + p.w / 2 - Math.sign(p.vx) * 9, p.y + p.h, 2);
      }
    }

    const cx = p.x + p.w / 2;
    const cy = p.y + p.h / 2;
    for (const c of l.coins) {
      if (c.collected) continue;
      if (Math.abs(c.x - cx) < p.w / 2 + c.r && Math.abs(c.y - cy) < p.h / 2 + c.r) {
        c.collected = true;
        this.gainCoin(c.x, c.y);
      }
    }

    for (const cp of l.checkpoints) {
      if (!cp.active && p.x + p.w > cp.x - 34 && p.x < cp.x + 48) {
        cp.active = true;
        this.activeCheckpoint = cp;
        this.hearts = Math.min(MAX_HEARTS, this.hearts + 1);
        this.ui.setHearts(this.hearts);
        this.sound.checkpoint();
        this.ui.toast('CHECKPOINT!');
        this.spawnRing(cp.x, cp.y - 72, 22, '#52e0c4', 240);
        this.addText(cp.x, cp.y - 110, 'CHECKPOINT', '#52e0c4', 17);
      }
    }

    if (l.goal && p.x + p.w > l.goal.x - 18) {
      this.beginClear();
      return;
    }
    if (p.y > l.worldH + 150) {
      this.pitFall();
    }
  }

  collideX(p) {
    for (const s of this.collisionSolids) {
      if (!this.overlaps(p, s)) continue;
      if (p.vx > 0) p.x = s.x - p.w - 0.01;
      else if (p.vx < 0) p.x = s.x + s.w + 0.01;
      else continue;
      p.vx = 0;
    }
  }

  collideY(p) {
    for (const s of this.collisionSolids) {
      if (!this.overlaps(p, s)) continue;
      if (p.vy > 0) {
        p.y = s.y - p.h - 0.01;
        p.vy = 0;
        p.onGround = true;
        p.carrier = s;
        if (s.kind === 'spring' && s.cooldown <= 0) this.bounceSpring(s);
      } else if (p.vy < 0) {
        p.y = s.y + s.h + 0.01;
        p.vy = 0;
        if (s.kind === 'block') this.bumpBlock(s.block);
        else this.spawnDust(p.x + p.w / 2, p.y, 3, '#d8e3f3');
      }
    }
  }

  doJump() {
    const p = this.player;
    p.vy = -this.jumpSpeed();
    p.onGround = false;
    p.coyote = 0;
    p.jumpBuffer = 0;
    p.carrier = null;
    this.jumpsThisLevel++;
    this.sound.jump(this.jumpMult());
    this.spawnDust(p.x + p.w / 2, p.y + p.h, this.jumpMult() > 1.5 ? 10 : 6);
  }

  bounceSpring(s) {
    const p = this.player;
    p.y = s.y - p.h - 1;
    p.vy = -1240;
    p.onGround = false;
    p.coyote = 0;
    p.carrier = null;
    p.springT = 1;
    s.anim = 1;
    s.cooldown = 0.3;
    this.sound.spring();
    this.spawnRing(s.x + s.w / 2, s.y, 18, '#ffd15c', 250);
    this.addText(s.x + s.w / 2, s.y - 38, 'BOING!', '#ffe89a', 18);
    this.shake = Math.max(this.shake, 4);
  }

  updateBlocks(dt) {
    for (const b of this.level.blocks) {
      if (b.bump > 0) b.bump = Math.max(0, b.bump - dt * 3.4);
    }
    for (const s of this.level.springs) {
      s.cooldown = Math.max(0, s.cooldown - dt);
      if (s.anim > 0) s.anim = Math.max(0, s.anim - dt * 4);
    }
    for (const cp of this.level.checkpoints) cp.t += dt;
  }

  bumpBlock(b) {
    if (!b) return;
    b.bump = 0.3;
    this.sound.block();
    if (b.type === '?' && !b.used) {
      b.used = true;
      this.spawnBurst(b.x * TILE + TILE / 2, b.y * TILE - 6, 10, ['#ffe89a', '#ffd15c', '#fff6c8'], 200, true);
      this.gainCoin(b.x * TILE + TILE / 2, b.y * TILE - 14);
    } else {
      this.spawnDust(b.x * TILE + TILE / 2, b.y * TILE, 5, '#d8c3a4');
    }
  }

  gainCoin(x, y) {
    this.coinsThisLevel++;
    this.sound.coin(this.coinsThisLevel);
    this.spawnBurst(x, y, 10, ['#ffe89a', '#ffd15c', '#fff6c8'], 190, true);
    this.addText(x, y - 16, '+1', '#ffe89a', 16);
    if (this.coinsThisLevel % 10 === 0) {
      this.sound.power();
      this.addText(x, y - 42, 'JUMP UP!', '#ffd15c', 22);
      this.spawnRing(x, y, 26, '#ffd15c', 280);
      this.flash = 0.4;
      this.flashColor = '#ffd15c';
      this.shake = Math.max(this.shake, 2.5);
    }
    if (this.coinsThisLevel === this.level.totalCoins) {
      this.ui.toast('ALL COINS COLLECTED!', 2200);
      this.spawnConfetti(x, y - 80, 36);
    }
  }

  updateEnemies(dt) {
    const solids = this.level.solids;
    for (const e of this.level.enemies) {
      if (e.dead) {
        e.deadT += dt;
        continue;
      }
      e.t += dt;
      if (e.type === 'flyer') {
        e.x += e.vx * dt;
        const range = e.range || 150;
        if (e.x < e.spawnX - range) {
          e.x = e.spawnX - range;
          e.vx = Math.abs(e.vx);
        } else if (e.x > e.spawnX + range) {
          e.x = e.spawnX + range;
          e.vx = -Math.abs(e.vx);
        }
        e.y = e.baseY + Math.sin(e.t * 2.2) * 16;
      } else {
        e.vy += GRAVITY * dt;
        e.x += e.vx * dt;
        for (const s of solids) {
          if (!this.overlaps(e, s)) continue;
          if (e.vx > 0) e.x = s.x - e.w - 0.01;
          else if (e.vx < 0) e.x = s.x + s.w + 0.01;
          e.vx *= -1;
          break;
        }
        e.y += e.vy * dt;
        e.grounded = false;
        for (const s of solids) {
          if (!this.overlaps(e, s)) continue;
          if (e.vy > 0) {
            e.y = s.y - e.h;
            e.vy = 0;
            e.grounded = true;
          } else if (e.vy < 0) {
            e.y = s.y + s.h;
            e.vy = 0;
          }
        }
        if (e.grounded) {
          const aheadX = e.vx > 0 ? e.x + e.w + 4 : e.x - 4;
          if (!this.solidAt(aheadX, e.y + e.h + 8, solids)) e.vx *= -1;
        }
        if (e.y > this.level.worldH + 120) e.alive = false;
      }

      if (!e.dead && this.overlaps(this.player, e)) {
        const p = this.player;
        const feet = p.y + p.h;
        const cameFromAbove = p.prevY + p.h <= e.y + 16;
        const stomping = p.vy > 20 && cameFromAbove && feet < e.y + e.h * 0.8;
        if (stomping && e.type !== 'spiky') {
          e.dead = true;
          e.deadT = 0;
          p.vy = -560;
          p.onGround = false;
          p.coyote = 0;
          p.y = e.y - p.h - 1;
          this.stompsThisLevel++;
          this.sound.stomp();
          this.spawnBurst(e.x + e.w / 2, e.y + e.h / 2, 10, ['#fff1d0', '#e8a87c', '#c97a52'], 170, false);
          this.addText(e.x + e.w / 2, e.y - 10, 'BONK!', '#ffe89a', 16);
          this.shake = Math.max(this.shake, 3);
          if (this.input.jump) p.jumpBuffer = JUMP_BUFFER;
        } else {
          this.damage(e);
          if (this.state !== 'playing') break;
        }
      }
    }
    this.level.enemies = this.level.enemies.filter((e) => (e.dead ? e.deadT < 0.8 : e.alive));
  }

  damage(source) {
    if (this.state !== 'playing') return;
    const p = this.player;
    if (p.invuln > 0) return;
    this.hearts--;
    this.ui.setHearts(this.hearts);
    this.sound.hurt();
    this.flash = 1;
    this.flashColor = '#ff3d55';
    this.shake = 14;
    if (this.hearts <= 0) {
      this.beginGameOver();
      return;
    }
    p.invuln = 1.7;
    p.vy = -430;
    if (source && typeof source.x === 'number') {
      const dir = p.x + p.w / 2 < source.x + source.w / 2 ? -1 : 1;
      p.vx = dir * 300;
    } else {
      p.vx *= 0.4;
    }
    p.onGround = false;
    p.coyote = 0;
    this.spawnBurst(p.x + p.w / 2, p.y + p.h / 2, 14, ['#ff6b6b', '#ffd15c', '#ffffff'], 190, true);
    this.addText(p.x + p.w / 2, p.y - 10, 'OUCH!', '#ff8a8e', 18);
  }

  pitFall() {
    if (this.state !== 'playing') return;
    const p = this.player;
    this.sound.fall();
    if (p.invuln <= 0) {
      this.hearts--;
      this.ui.setHearts(this.hearts);
      this.sound.hurt();
      this.flash = 1;
      this.flashColor = '#ff3d55';
      this.shake = 11;
    }
    if (this.hearts <= 0) {
      this.beginGameOver();
      return;
    }
    this.respawn();
  }

  respawn() {
    const sp = this.getSpawn();
    const p = this.player;
    p.x = sp.x - p.w / 2;
    p.y = sp.y - p.h;
    p.vx = 0;
    p.vy = 0;
    p.onGround = false;
    p.coyote = 0;
    p.jumpBuffer = 0;
    p.carrier = null;
    p.invuln = 1.5;
    p.dead = false;
    this.snapCamera();
    this.spawnRing(p.x + p.w / 2, p.y + p.h / 2, 20, '#52e0c4', 180);
    this.ui.toast(this.activeCheckpoint ? 'BACK TO CHECKPOINT' : 'TRY THAT AGAIN!', 1300);
  }

  runCoinsTotal() {
    return this.results.reduce((a, r) => a + (r ? r.coins : 0), 0);
  }

  runTimeTotal() {
    return this.results.reduce((a, r) => a + (r ? r.time : 0), 0);
  }

  beginClear() {
    if (this.state !== 'playing') return;
    this.state = 'clearing';
    this.clearT = 0;
    const p = this.player;
    p.celebrate = true;
    p.vx = 0;
    p.vy = 0;
    this.clearInput();
    this.sound.stopMusic();
    this.sound.clear();
    this.spawnConfetti(p.x + p.w / 2, p.y - 100, 64);
    this.flash = 0.45;
    this.flashColor = '#ffd15c';
    this.ui.setTouchVisible(false);
  }

  finishClear() {
    if (this.state !== 'clearing') return;
    this.state = 'clear';
    const result = {
      index: this.levelIndex,
      coins: this.coinsThisLevel,
      total: this.level.totalCoins,
      time: this.levelTime,
      jumps: this.jumpsThisLevel,
    };
    this.results[this.levelIndex] = result;
    const ratio = result.total > 0 ? result.coins / result.total : 0;
    let flavor = 'Every coin makes the next jump sweeter.';
    if (ratio >= 0.95) flavor = 'Coin perfection! You grabbed almost everything.';
    else if (ratio >= 0.7) flavor = 'Excellent — the sky is yours.';
    else if (ratio >= 0.4) flavor = 'Nice run! There are more coins up high.';
    this.syncHUD();
    this.ui.showClear({
      title: this.level.name,
      coins: result.coins,
      total: result.total,
      time: result.time,
      mult: this.jumpMult(),
      flavor,
      button: this.levelIndex >= 2 ? 'SEE RESULTS →' : 'NEXT LEVEL →',
    });
  }

  beginGameOver() {
    if (this.state === 'gameover') return;
    this.state = 'gameover';
    this.player.dead = true;
    this.sound.stopMusic();
    this.sound.gameover();
    const coins = this.runCoinsTotal() + this.coinsThisLevel;
    const time = this.runTimeTotal() + this.levelTime;
    this.saveBest(coins, time);
    this.ui.setBestLine(this.best);
    this.ui.setPlaying(false);
    this.ui.showGameOver({
      coins,
      level: this.level.id,
      line: coins > 0 ? 'So close. The coins will still be up there.' : 'The coins got the better of you.',
    });
  }

  pushParticle(p) {
    if (this.particles.length > 320) this.particles.shift();
    this.particles.push(p);
  }

  spawnDust(x, y, n = 4, color = '#e9dcc2') {
    for (let i = 0; i < n; i++) {
      const life = 0.3 + Math.random() * 0.3;
      this.pushParticle({
        x: x + (Math.random() - 0.5) * 16,
        y: y - Math.random() * 4,
        vx: (Math.random() - 0.5) * 110,
        vy: -Math.random() * 70,
        life, maxLife: life,
        size: 2 + Math.random() * 4,
        color, gravity: 160, kind: 'dust', rot: 0, vr: 0,
      });
    }
  }

  spawnBurst(x, y, n, colors, speed = 180, lift = true) {
    for (let i = 0; i < n; i++) {
      const a = Math.random() * TAU;
      const v = speed * (0.3 + Math.random() * 0.8);
      const life = 0.35 + Math.random() * 0.5;
      this.pushParticle({
        x, y,
        vx: Math.cos(a) * v,
        vy: Math.sin(a) * v - (lift ? 80 : 0),
        life, maxLife: life,
        size: 2 + Math.random() * 4,
        color: colors[(Math.random() * colors.length) | 0],
        gravity: lift ? 600 : 500,
        kind: 'spark', rot: 0, vr: 0,
      });
    }
  }

  spawnRing(x, y, n, color, speed = 220) {
    for (let i = 0; i < n; i++) {
      const a = (i / n) * TAU;
      const life = 0.45;
      this.pushParticle({
        x, y,
        vx: Math.cos(a) * speed,
        vy: Math.sin(a) * speed,
        life, maxLife: life,
        size: 3,
        color, gravity: 150, kind: 'spark', rot: 0, vr: 0,
      });
    }
  }

  spawnConfetti(x, y, n) {
    const colors = ['#ffd15c', '#ff5d62', '#52e0c4', '#4d7dff', '#fff6c8', '#ff9f43'];
    for (let i = 0; i < n; i++) {
      const life = 1.4 + Math.random() * 1.2;
      this.pushParticle({
        x: x + (Math.random() - 0.5) * 80,
        y: y + (Math.random() - 0.5) * 30,
        vx: (Math.random() - 0.5) * 360,
        vy: -200 - Math.random() * 320,
        life, maxLife: life,
        size: 5 + Math.random() * 6,
        color: colors[(Math.random() * colors.length) | 0],
        gravity: 420, kind: 'confetti',
        rot: Math.random() * TAU, vr: (Math.random() - 0.5) * 12,
      });
    }
  }

  addText(x, y, text, color = '#ffe89a', size = 16) {
    this.texts.push({ x, y, text, color, size, life: 1.05, maxLife: 1.05, vy: -40 });
  }

  updateParticles(dt) {
    for (const p of this.particles) {
      p.life -= dt;
      p.vy += p.gravity * dt;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.vx *= 0.988;
      p.rot += p.vr * dt;
    }
    this.particles = this.particles.filter((p) => p.life > 0);
  }

  updateTexts(dt) {
    for (const t of this.texts) {
      t.life -= dt;
      t.y += t.vy * dt;
      t.vy *= 0.96;
    }
    this.texts = this.texts.filter((t) => t.life > 0);
  }

  render() {
    renderGame(this);
  }
}

export { clamp, approach, hash, TAU, BASE_JUMP, JUMP_RANGE, JUMP_CURVE, GRAVITY, MAX_FALL, RUN_MAX, ACCEL, AIR_ACCEL, FRICTION, COYOTE, JUMP_BUFFER, MAX_HEARTS, PLAYER_W, PLAYER_H, BEST_KEY, fmtTime };
