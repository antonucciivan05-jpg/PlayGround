const $ = (id) => document.getElementById(id);

export function fmtTime(seconds) {
  const s = Math.max(0, Math.floor(seconds));
  const m = Math.floor(s / 60);
  return `${m}:${String(s % 60).padStart(2, '0')}`;
}

export class UI {
  constructor() {
    this.el = {
      hud: $('hud'),
      touch: $('touch'),
      hearts: $('hearts'),
      jumpShell: document.querySelector('.jump-shell'),
      jumpFill: $('jumpFill'),
      jumpMult: $('jumpMult'),
      coinHud: $('coinHud'),
      coinTotal: $('coinTotal'),
      timeHud: $('timeHud'),
      worldLabel: $('worldLabel'),
      levelName: $('levelName'),
      banner: $('banner'),
      bannerKicker: $('bannerKicker'),
      bannerTitle: $('bannerTitle'),
      bannerSub: $('bannerSub'),
      toast: $('toast'),
      soundBtn: $('soundBtn'),
      pauseCoins: $('pauseCoins'),
      pauseJump: $('pauseJump'),
      pauseHearts: $('pauseHearts'),
      bestLine: $('bestLine'),
      clearTitle: $('clearTitle'),
      clearCoins: $('clearCoins'),
      clearTime: $('clearTime'),
      clearJump: $('clearJump'),
      clearFlavor: $('clearFlavor'),
      nextBtn: $('nextBtn'),
      gameoverLine: $('gameoverLine'),
      overCoins: $('overCoins'),
      overLevel: $('overLevel'),
      winCoins: $('winCoins'),
      winTime: $('winTime'),
      winBest: $('winBest'),
      winFlavor: $('winFlavor'),
      winBestLine: $('winBestLine'),
    };
    this.screens = ['titleScreen', 'pauseScreen', 'clearScreen', 'gameoverScreen', 'winScreen'];
    this.prev = { coins: -1, total: -1, time: -1, mult: -1, world: '', name: '', hot: null };
    this.bannerTimer = null;
    this.toastTimer = null;
    this.heartCount = -1;
    this.buildHearts(3);
  }

  buildHearts(max) {
    this.el.hearts.innerHTML = '';
    for (let i = 0; i < max; i++) {
      const h = document.createElement('span');
      h.className = 'heart';
      h.textContent = '♥';
      this.el.hearts.appendChild(h);
    }
  }

  setHearts(n) {
    const hearts = [...this.el.hearts.children];
    hearts.forEach((h, i) => {
      h.classList.toggle('empty', i >= n);
      if (n > this.heartCount && i < n) {
        h.classList.remove('pop');
        void h.offsetWidth;
        h.classList.add('pop');
        setTimeout(() => h.classList.remove('pop'), 500);
      }
    });
    this.heartCount = n;
  }

  showScreen(id) {
    for (const s of this.screens) {
      const el = $(s);
      if (el) el.classList.toggle('hidden', s !== id);
    }
  }

  showHUD(visible) {
    this.el.hud.classList.toggle('hidden', !visible);
    this.el.hud.setAttribute('aria-hidden', String(!visible));
  }

  setPlaying(active) {
    this.showHUD(active);
    this.setTouchVisible(active);
  }

  setTouchVisible(visible) {
    this.el.touch.classList.toggle('hidden', !visible);
    this.el.touch.setAttribute('aria-hidden', String(!visible));
  }

  updateHUD({ coins, total, jumpMult, jumpPct, time, world, levelName, hot }) {
    const e = this.el;
    if (coins !== this.prev.coins) {
      e.coinHud.textContent = coins;
      this.prev.coins = coins;
    }
    if (total !== this.prev.total) {
      e.coinTotal.textContent = `/ ${total}`;
      this.prev.total = total;
    }
    if (Math.abs(time - this.prev.time) >= 1) {
      e.timeHud.textContent = fmtTime(time);
      this.prev.time = Math.floor(time);
    }
    const mult = jumpMult.toFixed(1);
    if (mult !== this.prev.mult) {
      e.jumpMult.textContent = `×${mult}`;
      this.prev.mult = mult;
    }
    e.jumpFill.style.width = `${Math.round(jumpPct * 100)}%`;
    e.jumpShell.classList.toggle('hot', hot === 'hot');
    e.jumpShell.classList.toggle('max', hot === 'max');
    if (world !== this.prev.world) {
      e.worldLabel.textContent = world;
      this.prev.world = world;
    }
    if (levelName !== this.prev.name) {
      e.levelName.textContent = levelName;
      this.prev.name = levelName;
    }
  }

  resetHUDCache() {
    this.prev = { coins: -1, total: -1, time: -1, mult: -1, world: '', name: '', hot: null };
  }

  banner(kicker, title, sub) {
    const e = this.el;
    e.bannerKicker.textContent = kicker;
    e.bannerTitle.textContent = title;
    e.bannerSub.textContent = sub;
    e.banner.classList.remove('show');
    void e.banner.offsetWidth;
    e.banner.classList.add('show');
    clearTimeout(this.bannerTimer);
    this.bannerTimer = setTimeout(() => e.banner.classList.remove('show'), 2600);
  }

  hideBanner() {
    clearTimeout(this.bannerTimer);
    this.el.banner.classList.remove('show');
  }

  toast(text, duration = 1600) {
    const e = this.el;
    e.toast.textContent = text;
    e.toast.classList.add('show');
    clearTimeout(this.toastTimer);
    this.toastTimer = setTimeout(() => e.toast.classList.remove('show'), duration);
  }

  hideToast() {
    clearTimeout(this.toastTimer);
    this.el.toast.classList.remove('show');
  }

  setSoundMuted(muted) {
    const b = this.el.soundBtn;
    b.classList.toggle('muted', muted);
    b.setAttribute('aria-pressed', String(muted));
    b.setAttribute('aria-label', muted ? 'Unmute sound' : 'Mute sound');
  }

  showPause({ coins, total, mult, hearts }) {
    this.el.pauseCoins.textContent = `${coins} / ${total}`;
    this.el.pauseJump.textContent = `×${mult.toFixed(1)}`;
    this.el.pauseHearts.textContent = '♥'.repeat(hearts) + '♡'.repeat(Math.max(0, 3 - hearts));
    this.showScreen('pauseScreen');
  }

  showClear({ title, coins, total, time, mult, flavor, button }) {
    this.el.clearTitle.textContent = title;
    this.el.clearCoins.textContent = `${coins} / ${total}`;
    this.el.clearTime.textContent = fmtTime(time);
    this.el.clearJump.textContent = `×${mult.toFixed(1)}`;
    this.el.clearFlavor.textContent = flavor;
    this.el.nextBtn.textContent = button;
    this.showScreen('clearScreen');
  }

  showGameOver({ coins, level, line }) {
    this.el.overCoins.textContent = coins;
    this.el.overLevel.textContent = level;
    this.el.gameoverLine.textContent = line;
    this.showScreen('gameoverScreen');
  }

  showWin({ coins, time, bestMult, flavor, bestLine }) {
    this.el.winCoins.textContent = coins;
    this.el.winTime.textContent = fmtTime(time);
    this.el.winBest.textContent = `×${bestMult.toFixed(1)}`;
    this.el.winFlavor.textContent = flavor;
    this.el.winBestLine.textContent = bestLine;
    this.showScreen('winScreen');
  }

  setBestLine(best) {
    const e = this.el.bestLine;
    if (!best) {
      e.textContent = 'No runs yet — be the first!';
      return;
    }
    e.textContent = `Best run: ${best.coins} coins · ${fmtTime(best.time)}`;
  }
}
