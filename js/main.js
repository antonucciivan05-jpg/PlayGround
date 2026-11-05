import { Game } from './game.js';
import { UI } from './ui.js';
import { Sound } from './audio.js';

const $ = (id) => document.getElementById(id);

const canvas = $('game');
const ui = new UI();
const sound = new Sound();

// Treat touch-capable devices as touch-first so the on-screen pad stays visible,
// even when a tablet also has a mouse attached.
const coarse = window.matchMedia?.('(pointer: coarse)').matches
  || window.matchMedia?.('(any-pointer: coarse)').matches
  || navigator.maxTouchPoints > 0;
document.body.classList.toggle('touch-mode', Boolean(coarse));

const game = new Game(canvas, ui, sound);

/* ------------------------------------------------------------------ */
/*  Menu buttons                                                       */
/* ------------------------------------------------------------------ */

function onClick(id, fn) {
  const el = $(id);
  if (!el) return;
  el.addEventListener('click', (e) => {
    e.preventDefault();
    sound.init();
    sound.click();
    fn();
  });
}

onClick('playBtn', () => game.startRun());
onClick('pauseBtn', () => game.togglePause());
onClick('resumeBtn', () => game.togglePause());
onClick('restartBtn', () => game.startLevel(game.levelIndex));
onClick('quitBtn', () => game.quitToTitle());
onClick('nextBtn', () => game.advance());
onClick('retryBtn', () => game.retry());
onClick('overTitleBtn', () => game.quitToTitle());
onClick('replayBtn', () => {
  if (game.state === 'win') game.startRun();
});
onClick('winTitleBtn', () => game.quitToTitle());
onClick('soundBtn', () => game.toggleSound());

/* ------------------------------------------------------------------ */
/*  Touch controls                                                     */
/* ------------------------------------------------------------------ */

const pointers = new Map();

function setTouchButton(btn, active) {
  btn.classList.toggle('active', active);
}

for (const btn of document.querySelectorAll('.tbtn')) {
  const act = btn.dataset.act;

  btn.addEventListener('pointerdown', (e) => {
    if (e.pointerType === 'mouse' && e.button !== 0) return;
    e.preventDefault();
    sound.init();

    // Capture the pointer so sliding a thumb off the button still releases it.
    try { btn.setPointerCapture(e.pointerId); } catch {}
    pointers.set(e.pointerId, { btn, act });
    setTouchButton(btn, true);

    if (act === 'jump') game.pressJump();
    else game.setMove(act, true);
  });

  const release = (e) => {
    const held = pointers.get(e.pointerId);
    if (!held || held.btn !== btn) return;
    pointers.delete(e.pointerId);
    setTouchButton(btn, false);

    if (held.act === 'jump') game.releaseJump();
    else game.setMove(held.act, false);
  };

  btn.addEventListener('pointerup', release);
  btn.addEventListener('pointercancel', release);
  btn.addEventListener('lostpointercapture', release);
  btn.addEventListener('click', (e) => e.preventDefault());
  btn.addEventListener('contextmenu', (e) => e.preventDefault());
}

function releaseAllTouch() {
  for (const { btn, act } of pointers.values()) {
    setTouchButton(btn, false);
    if (act === 'jump') game.releaseJump();
    else game.setMove(act, false);
  }
  pointers.clear();
}

window.addEventListener('blur', releaseAllTouch);
window.addEventListener('pagehide', releaseAllTouch);
document.addEventListener('visibilitychange', () => {
  if (document.hidden) releaseAllTouch();
});

// Stop accidental pull-to-refresh / pinch zoom on the game surface while
// leaving the UI controls usable.
document.addEventListener('gesturestart', (e) => e.preventDefault());
canvas.addEventListener('touchmove', (e) => e.preventDefault(), { passive: false });

/* ------------------------------------------------------------------ */
/*  Debug / test hooks                                                 */
/* ------------------------------------------------------------------ */

window.__game = game;
window.__coinjump = { game, ui, sound };
