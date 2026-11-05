export const TILE = 48;
export const ROWS = 15;
export const WORLD_H = ROWS * TILE;

export const ENEMY_DEFS = {
  goomba: { w: 38, h: 32, speed: 54, stompable: true },
  spiky: { w: 36, h: 32, speed: 78, stompable: false },
  flyer: { w: 40, h: 28, speed: 64, stompable: true },
};

class LevelBuilder {
  constructor(cfg) {
    this.id = cfg.id;
    this.name = cfg.name;
    this.theme = cfg.theme;
    this.width = cfg.width;
    this.groundSegs = [];
    this.platforms = [];
    this.blocks = [];
    this.pipes = [];
    this.coins = [];
    this.enemies = [];
    this.movers = [];
    this.springs = [];
    this.checkpoints = [];
    this.goalDef = null;
    this.spawn = { x: 2.4, y: 12 };
  }

  ground(x0, x1, top = 12) {
    this.groundSegs.push({ x0, x1, top });
    return this;
  }

  platform(x, y, w, h = 1, type = 'stone') {
    this.platforms.push({ x, y, w, h, type });
    return this;
  }

  block(x, y, type = '?') {
    this.blocks.push({ x, y, type, used: false, bump: 0 });
    return this;
  }

  pipe(x, top, h = 2) {
    this.pipes.push({ x, top, h });
    return this;
  }

  /** Coin at a centre point measured in tiles. */
  coin(cx, cy) {
    this.coins.push({ x: cx * TILE, y: cy * TILE });
    return this;
  }

  /** Row of coins; x/y are tile cells, coins sit at their centres. */
  coinRow(x, y, n, step = 1) {
    for (let i = 0; i < n; i++) this.coin(x + 0.5 + i * step, y + 0.5);
    return this;
  }

  /** Gentle coin arc over a gap. x0/x1/yBase/yPeak are tile cells. */
  coinArc(x0, x1, yBase, yPeak, n = 5) {
    for (let i = 0; i < n; i++) {
      const t = n === 1 ? 0.5 : i / (n - 1);
      const cx = x0 + 0.35 + (x1 - x0 - 0.7) * t;
      const cy = yBase + 0.5 - (yBase - yPeak) * Math.sin(Math.PI * t);
      this.coin(cx, cy);
    }
    return this;
  }

  enemy(x, surfaceRow, type = 'goomba', opts = {}) {
    this.enemies.push({ x, y: surfaceRow, type, ...opts });
    return this;
  }

  spring(x, surfaceRow = 12) {
    this.springs.push({ x: (x + 0.5) * TILE, y: surfaceRow * TILE });
    return this;
  }

  checkpoint(x, surfaceRow = 12) {
    this.checkpoints.push({ x: (x + 0.5) * TILE, y: surfaceRow * TILE });
    return this;
  }

  goal(x, surfaceRow = 12) {
    this.goalDef = { x: (x + 0.5) * TILE, y: surfaceRow * TILE };
    return this;
  }

  mover(x, y, w, h, axis, range, speed, phase = 0) {
    this.movers.push({ x, y, w, h, axis, range, speed, phase });
    return this;
  }

  /** Ascending staircase, each column one tile taller than the last. */
  stairs(x, baseTop, steps, type = 'stone') {
    for (let i = 0; i < steps; i++) {
      this.platform(x + i, baseTop - i, 1, i + 1, type);
    }
    return this;
  }

  build() {
    const solids = [];
    for (const g of this.groundSegs) {
      solids.push({
        x: g.x0 * TILE, y: g.top * TILE,
        w: (g.x1 - g.x0) * TILE, h: WORLD_H - g.top * TILE,
        kind: 'ground',
      });
    }
    for (const p of this.platforms) {
      solids.push({
        x: p.x * TILE, y: p.y * TILE, w: p.w * TILE, h: p.h * TILE,
        kind: 'platform', style: p.type,
      });
    }
    for (const b of this.blocks) {
      solids.push({
        x: b.x * TILE, y: b.y * TILE, w: TILE, h: TILE,
        kind: 'block', block: b,
      });
    }
    for (const p of this.pipes) {
      solids.push({
        x: p.x * TILE, y: p.top * TILE, w: 2 * TILE, h: p.h * TILE,
        kind: 'pipe',
      });
    }

    const sorted = [...this.groundSegs].sort((a, b) => a.x0 - b.x0);
    const gaps = [];
    for (let i = 0; i < sorted.length - 1; i++) {
      if (sorted[i + 1].x0 > sorted[i].x1) {
        gaps.push({ x0: sorted[i].x1, x1: sorted[i + 1].x0 });
      }
    }

    const coins = this.coins.map((c, i) => ({
      x: c.x, y: c.y, r: 14, phase: (i * 0.73) % (Math.PI * 2), collected: false,
    }));

    const enemies = this.enemies.map((e, i) => {
      const def = ENEMY_DEFS[e.type] || ENEMY_DEFS.goomba;
      const cx = (e.x + 0.5) * TILE;
      let x, y;
      if (e.type === 'flyer') {
        x = cx - def.w / 2;
        y = (e.y + 0.5) * TILE - def.h / 2;
      } else {
        x = cx - def.w / 2;
        y = e.y * TILE - def.h;
      }
      return {
        ...def, type: e.type, x, y, baseY: y,
        spawnX: x, spawnY: y, w: def.w, h: def.h,
        vx: -(e.dir || 1) * def.speed,
        dir: e.dir || 1,
        t: i * 0.8,
        dead: false, deadT: 0, squash: 0,
        range: e.range != null ? e.range * TILE : null,
        alive: true,
      };
    });

    const movers = this.movers.map((m, i) => ({
      x: m.x * TILE, y: m.y * TILE,
      ox: m.x * TILE, oy: m.y * TILE,
      w: m.w * TILE, h: m.h * TILE,
      axis: m.axis, range: m.range * TILE, speed: m.speed,
      phase: m.phase + i * 1.7,
      prevX: m.x * TILE, prevY: m.y * TILE,
      kind: 'mover',
    }));

    const springs = this.springs.map((s) => ({
      x: s.x - 27, y: s.y - 15, w: 54, h: 15,
      baseY: s.y, anim: 0, cooldown: 0, kind: 'spring',
    }));

    const checkpoints = this.checkpoints.map((c) => ({
      x: c.x, y: c.y, active: false, t: 0,
    }));

    let totalCoins = coins.length + this.blocks.filter((b) => b.type === '?').length;

    return {
      id: this.id,
      name: this.name,
      theme: this.theme,
      width: this.width,
      worldW: this.width * TILE,
      worldH: WORLD_H,
      groundSegs: sorted,
      platforms: this.platforms,
      blocks: this.blocks,
      pipes: this.pipes,
      gaps,
      solids,
      coins,
      enemies,
      movers,
      springs,
      checkpoints,
      goal: this.goalDef,
      totalCoins,
      spawn: { x: this.spawn.x * TILE, y: this.spawn.y * TILE },
    };
  }
}

/* ------------------------------------------------------------------ */
/*  WORLD 1 — MUSHROOM MEADOW                                          */
/* ------------------------------------------------------------------ */

function buildLevelOne() {
  const b = new LevelBuilder({ id: '1-1', name: 'Mushroom Meadow', theme: 'meadow', width: 152 });
  b.spawn = { x: 2.4, y: 12 };
  b.ground(0, 30);
  b.ground(34, 64);
  b.ground(68, 98);
  b.ground(102, 152);

  // Opening stretch
  b.coinRow(3, 10, 4);
  b.platform(8, 10, 4, 1, 'brick');
  b.coinRow(8, 9, 4);
  b.enemy(12, 12, 'goomba');
  b.block(14, 8, '?');
  b.block(16, 8, '?');
  b.block(18, 8, 'B');
  b.platform(21, 9, 3, 1, 'wood');
  b.coinRow(21, 8, 3);
  b.enemy(24, 12, 'goomba');
  b.pipe(26, 10, 2);
  b.coin(26.5, 8.5);
  b.coin(27.5, 8.5);
  b.platform(31, 10, 2, 1, 'stone');
  b.coinArc(29.6, 34.4, 10, 8, 5);

  // Spring field
  b.enemy(36, 12, 'goomba');
  b.platform(38, 9, 4, 1, 'wood');
  b.coinRow(38, 8, 4);
  b.spring(43, 12);
  b.coinRow(42, 5, 3);
  b.coinRow(45, 5, 3);
  b.enemy(46, 12, 'goomba');
  b.block(48, 9, '?');
  b.block(50, 9, 'B');
  b.block(52, 9, '?');
  b.pipe(55, 9, 3);
  b.coinRow(55, 7, 2);
  b.enemy(58, 12, 'goomba');
  b.enemy(60, 12, 'goomba');
  b.checkpoint(61, 12);
  b.platform(65, 9, 2, 1, 'stone');
  b.coinArc(63.6, 68.4, 10, 8, 5);

  // Mid-level climb
  b.enemy(71, 12, 'goomba');
  b.platform(72, 9, 5, 1, 'stone');
  b.coinRow(72, 8, 5);
  b.platform(74, 6, 3, 1, 'stone');
  b.coinRow(74, 5, 3);
  b.enemy(78, 12, 'spiky');
  b.block(80, 8, '?');
  b.block(82, 8, 'B');
  b.block(84, 8, '?');
  b.coinRow(81, 7, 4);
  b.spring(87, 12);
  b.coinRow(86, 4, 4);
  b.pipe(91, 10, 2);
  b.enemy(94, 12, 'goomba');
  b.checkpoint(95, 12);
  b.platform(99, 9, 2, 1, 'stone');
  b.coinArc(97.6, 102.4, 10, 8, 5);

  // Final stretch
  b.enemy(106, 12, 'goomba');
  b.enemy(110, 12, 'spiky');
  b.platform(108, 9, 4, 1, 'brick');
  b.coinRow(108, 8, 4);
  b.coinRow(113, 10, 3);
  b.coinRow(116, 9, 3);
  b.enemy(116, 12, 'goomba');
  b.coinArc(118, 123, 8, 6, 5);
  b.enemy(122, 12, 'goomba');
  b.stairs(126, 11, 5, 'stone');
  b.platform(132, 4, 7, 1, 'stone');
  b.coinRow(132, 3, 7);
  b.coin(138.5, 2.5);
  b.enemy(144, 12, 'goomba');
  b.goal(147, 12);

  return b.build();
}

/* ------------------------------------------------------------------ */
/*  WORLD 2 — SUNSET CLIFFS                                            */
/* ------------------------------------------------------------------ */

function buildLevelTwo() {
  const b = new LevelBuilder({ id: '2-1', name: 'Sunset Cliffs', theme: 'sunset', width: 144 });
  b.spawn = { x: 2.4, y: 12 };
  b.ground(0, 22);
  b.ground(26, 44);
  b.ground(50, 70);
  b.ground(76, 96);
  b.ground(102, 122);
  b.ground(128, 144);

  // Opening
  b.coinRow(3, 11, 5);
  b.platform(6, 9, 4, 1, 'wood');
  b.coinRow(6, 8, 4);
  b.enemy(10, 12, 'goomba');
  b.block(11, 8, '?');
  b.block(13, 8, '?');
  b.platform(16, 10, 3, 1, 'stone');
  b.coinRow(16, 9, 3);
  b.enemy(18, 12, 'goomba');
  b.platform(23, 9, 3, 1, 'cloud');
  b.coinArc(21.6, 26.4, 10, 8, 5);

  // Spring + cliff steps
  b.spring(28, 12);
  b.coinRow(27, 4, 5);
  b.platform(31, 8, 4, 1, 'stone');
  b.coinRow(31, 7, 4);
  b.enemy(34, 12, 'spiky');
  b.block(38, 8, '?');
  b.coinRow(38, 7, 3);
  b.pipe(40, 10, 2);
  b.coinRow(40, 8, 2);
  b.checkpoint(42, 12);

  // The big gap — moving platform
  const mover1 = { x: 44.6, y: 9, w: 3, h: 1, axis: 'x', range: 1.6, speed: 0.9, phase: 0.4 };
  b.mover(mover1.x, mover1.y, mover1.w, mover1.h, mover1.axis, mover1.range, mover1.speed, mover1.phase);
  b.coinArc(43.6, 50.4, 10, 6.5, 6);

  // Cloud climb
  b.platform(54, 9, 3, 1, 'cloud');
  b.coinRow(54, 8, 3);
  b.platform(58, 7, 3, 1, 'cloud');
  b.coinRow(58, 6, 3);
  b.platform(62, 5, 3, 1, 'cloud');
  b.coinRow(62, 4, 3);
  b.platform(59, 2, 6, 1, 'cloud');
  b.coinRow(59, 1, 6);
  b.enemy(55, 12, 'goomba');
  b.enemy(60, 12, 'spiky');
  b.enemy(64, 12, 'goomba');
  b.checkpoint(67, 12);

  // Gap with spring + cloud
  b.spring(68.7, 12);
  b.platform(72, 7, 3, 1, 'cloud');
  b.coinArc(69.6, 76.4, 9, 5.5, 6);
  b.enemy(74, 12, 'goomba');

  // Midway
  b.platform(78, 9, 4, 1, 'stone');
  b.coinRow(78, 8, 4);
  b.enemy(80, 6, 'flyer');
  b.block(84, 8, '?');
  b.coinRow(84, 7, 3);
  b.pipe(88, 9, 3);
  b.coinRow(88, 7, 2);
  b.enemy(90, 12, 'goomba');
  b.spring(92, 12);
  b.coinRow(91, 3, 4);
  b.checkpoint(94, 12);

  // Second mover gap
  b.mover(97, 8, 3, 1, 'x', 2.2, 0.75, 1.1);
  b.coinArc(95.6, 102.4, 10, 6.5, 6);

  // Cliffside run
  b.platform(106, 9, 4, 1, 'stone');
  b.coinRow(106, 8, 4);
  b.enemy(108, 12, 'goomba');
  b.block(111, 8, '?');
  b.block(113, 8, 'B');
  b.platform(112, 6, 4, 1, 'cloud');
  b.coinRow(112, 5, 4);
  b.enemy(116, 5, 'flyer');
  b.enemy(117, 12, 'spiky');
  b.checkpoint(119, 12);

  // Final ascent
  b.spring(120.5, 12);
  b.platform(124, 8, 3, 1, 'cloud');
  b.coinArc(121.6, 128.4, 9, 6, 5);
  b.enemy(130, 12, 'goomba');
  b.stairs(133, 11, 4, 'stone');
  b.platform(137, 4, 5, 1, 'cloud');
  b.coinRow(137, 3, 5);
  b.coin(141, 2.5);
  b.enemy(135, 12, 'goomba');
  b.goal(141, 12);

  return b.build();
}

/* ------------------------------------------------------------------ */
/*  WORLD 3 — MOONLIT CASTLE                                           */
/* ------------------------------------------------------------------ */

function buildLevelThree() {
  const b = new LevelBuilder({ id: '3-1', name: 'Moonlit Castle', theme: 'castle', width: 152 });
  b.spawn = { x: 2.4, y: 12 };
  b.ground(0, 20);
  b.ground(24, 40);
  b.ground(45, 63);
  b.ground(68, 86);
  b.ground(91, 110);
  b.ground(115, 133);
  b.ground(138, 152);

  // Entrance hall
  b.coinRow(3, 11, 4);
  b.platform(7, 9, 3, 1, 'stone');
  b.coinRow(7, 8, 3);
  b.enemy(10, 12, 'goomba');
  b.block(11, 8, '?');
  b.block(13, 8, 'B');
  b.enemy(15, 12, 'spiky');
  b.pipe(16, 10, 2);
  b.coin(16.5, 8.5);
  b.coin(17.5, 8.5);
  b.platform(21, 9, 2, 1, 'stone');
  b.coinArc(19.6, 24.4, 10, 7, 5);

  // Hall of spikes
  b.enemy(27, 12, 'spiky');
  b.platform(28, 8, 4, 1, 'stone');
  b.coinRow(28, 7, 4);
  b.enemy(32, 12, 'goomba');
  b.coinRow(31, 5, 4);
  b.block(34, 8, '?');
  b.pipe(36, 9, 3);
  b.coinRow(36, 7, 2);
  b.enemy(38, 12, 'spiky');
  b.checkpoint(39, 12);

  // Mover over the moat
  b.mover(40.6, 8, 3, 1, 'x', 1.5, 1.0, 0.6);
  b.coinArc(39.6, 45.4, 10, 7, 5);

  // Upper walkway
  b.platform(47, 9, 3, 1, 'stone');
  b.coinRow(47, 8, 3);
  b.enemy(50, 5, 'flyer');
  b.platform(52, 7, 3, 1, 'stone');
  b.coinRow(52, 6, 3);
  b.enemy(54, 12, 'spiky');
  b.block(56, 8, '?');
  b.coinRow(56, 7, 3);
  b.enemy(58, 12, 'goomba');
  b.pipe(59, 10, 2);
  b.checkpoint(61, 12);

  // Moving-stone pit
  b.spring(62.2, 12);
  b.mover(64, 9, 2.6, 1, 'y', 1.4, 1.2, 0.2);
  b.coinArc(63.6, 68.4, 9, 5.5, 5);

  // Chandelier climb
  b.platform(70, 9, 4, 1, 'stone');
  b.coinRow(70, 8, 4);
  b.enemy(73, 12, 'spiky');
  b.platform(75, 6, 4, 1, 'stone');
  b.coinRow(75, 5, 4);
  b.enemy(77, 3.5, 'flyer');
  b.block(80, 8, '?');
  b.coinRow(80, 7, 3);
  b.enemy(82, 12, 'goomba');
  b.coinRow(82, 4, 3);
  b.checkpoint(84, 12);

  // Moat two
  b.mover(86.6, 8, 3, 1, 'x', 1.7, 0.9, 1.8);
  b.coinArc(85.6, 91.4, 10, 6.5, 5);

  // Long gallery
  b.platform(93, 9, 4, 1, 'stone');
  b.coinRow(93, 8, 4);
  b.enemy(96, 12, 'goomba');
  b.block(98, 8, '?');
  b.coinRow(98, 7, 3);
  b.enemy(100, 12, 'spiky');
  b.pipe(102, 9, 3);
  b.coinRow(102, 7, 2);
  b.enemy(105, 5, 'flyer');
  b.platform(104, 6, 3, 1, 'stone');
  b.coinRow(104, 5, 3);
  b.checkpoint(108, 12);

  // Moat three
  b.spring(109.5, 12);
  b.platform(112, 8, 2, 1, 'stone');
  b.coinArc(109.6, 115.4, 9, 6, 5);

  // Clockwork hall
  b.platform(117, 9, 4, 1, 'stone');
  b.coinRow(117, 8, 4);
  b.enemy(120, 12, 'spiky');
  b.mover(122, 6, 2.6, 1, 'y', 1.6, 1.1, 0.9);
  b.coinRow(121, 3, 4);
  b.enemy(125, 12, 'goomba');
  b.block(126, 8, '?');
  b.checkpoint(130, 12);

  // Final moat + throne
  b.spring(131.5, 12);
  b.coinArc(132.6, 138.4, 9, 6, 5);
  b.enemy(136, 12, 'goomba');
  b.stairs(139, 11, 4, 'stone');
  b.platform(143, 4, 5, 1, 'stone');
  b.coinRow(143, 3, 5);
  b.coin(147, 2.5);
  b.enemy(141, 12, 'spiky');
  b.goal(147, 12);

  return b.build();
}

export const LEVEL_FACTORIES = [buildLevelOne, buildLevelTwo, buildLevelThree];

export function makeLevel(index) {
  const factory = LEVEL_FACTORIES[Math.max(0, Math.min(LEVEL_FACTORIES.length - 1, index))];
  return factory();
}

export const THEMES = {
  meadow: {
    skyTop: '#5cc9ff',
    skyMid: '#9fe7ff',
    skyLow: '#e7fbff',
    sun: '#fff3ae',
    sunGlow: 'rgba(255, 240, 170, .55)',
    farHill: '#7fd4b0',
    midHill: '#4fb98a',
    nearHill: '#2f9669',
    cloud: 'rgba(255,255,255,.92)',
    cloudShade: 'rgba(196,236,255,.9)',
    groundTop: '#66d05e',
    groundTopDark: '#3ea447',
    groundBody: '#b46f43',
    groundBodyDark: '#8e4f2e',
    groundLine: '#6f3b22',
    stone: '#9a8f7e',
    stoneDark: '#6e6355',
    stoneLight: '#c0b6a3',
    brick: '#cc6446',
    brickDark: '#8f3a29',
    brickLight: '#ea8c6a',
    wood: '#bd8349',
    woodDark: '#82542b',
    pipe: '#45b94f',
    pipeDark: '#1f7d33',
    pipeLight: '#8aeb83',
    bush: '#3ca35e',
    bushDark: '#237644',
    accent: '#ffd15c',
    ambient: 'rgba(255, 244, 190, .12)',
    lava: false,
    stars: 0,
    moon: false,
    decor: 'bush',
  },
  sunset: {
    skyTop: '#5b3d8f',
    skyMid: '#e8708a',
    skyLow: '#ffc477',
    sun: '#ffd98a',
    sunGlow: 'rgba(255, 151, 96, .55)',
    farHill: '#b25b78',
    midHill: '#8e3f63',
    nearHill: '#642c50',
    cloud: 'rgba(255, 206, 196, .82)',
    cloudShade: 'rgba(255, 159, 148, .8)',
    groundTop: '#efb26a',
    groundTopDark: '#c9844a',
    groundBody: '#a45c40',
    groundBodyDark: '#7c3d30',
    groundLine: '#5f2c24',
    stone: '#b58a72',
    stoneDark: '#80594a',
    stoneLight: '#dbb49a',
    brick: '#c96b4e',
    brickDark: '#8d3f2e',
    brickLight: '#e99a7a',
    wood: '#a86e42',
    woodDark: '#714328',
    pipe: '#c07a8f',
    pipeDark: '#8a4a61',
    pipeLight: '#f0aab9',
    bush: '#98547a',
    bushDark: '#6b3558',
    accent: '#ffcf8a',
    ambient: 'rgba(255, 143, 106, .13)',
    lava: false,
    stars: 0,
    moon: false,
    decor: 'cactus',
  },
  castle: {
    skyTop: '#090b24',
    skyMid: '#1c1746',
    skyLow: '#3b2463',
    sun: '#dbe6ff',
    sunGlow: 'rgba(158, 186, 255, .35)',
    farHill: '#241d47',
    midHill: '#1a1638',
    nearHill: '#12102b',
    cloud: 'rgba(120, 118, 178, .2)',
    cloudShade: 'rgba(90, 88, 150, .2)',
    groundTop: '#6b6386',
    groundTopDark: '#474264',
    groundBody: '#3a3555',
    groundBodyDark: '#262239',
    groundLine: '#161326',
    stone: '#655d80',
    stoneDark: '#3f3a58',
    stoneLight: '#9188ab',
    brick: '#5c4a70',
    brickDark: '#392c4a',
    brickLight: '#806a95',
    wood: '#4d3a55',
    woodDark: '#30223a',
    pipe: '#3c6a7a',
    pipeDark: '#224555',
    pipeLight: '#6fa6b4',
    bush: '#314a6b',
    bushDark: '#1c2c46',
    accent: '#8be9ff',
    ambient: 'rgba(116, 208, 255, .08)',
    lava: true,
    stars: 60,
    moon: true,
    decor: 'torch',
  },
};

export function levelTotalCoins(index) {
  return makeLevel(index).totalCoins;
}
