/* Tiny WebAudio synth: no samples, no network. */

const SONGS = [
  {
    step: 0.155,
    lead: [72, null, 76, null, 79, null, 76, null, 74, null, 77, null, 81, null, 79, null,
           72, null, 76, null, 79, null, 84, null, 83, null, 79, null, 76, null, 74, null],
    bass: [48, 53, 48, 55],
  },
  {
    step: 0.175,
    lead: [77, null, 81, null, 84, null, 81, null, 79, null, 76, null, 72, null, 74, null,
           77, null, 81, null, 86, null, 84, null, 81, null, 79, null, 76, null, 74, null],
    bass: [53, 48, 55, 48],
  },
  {
    step: 0.185,
    lead: [69, null, 72, null, 76, null, 72, null, 71, null, 68, null, 64, null, 68, null,
           69, null, 72, null, 76, null, 81, null, 79, null, 76, null, 72, null, 71, null],
    bass: [45, 41, 45, 43],
  },
];

const midiToFreq = (m) => 440 * Math.pow(2, (m - 69) / 12);

export class Sound {
  constructor() {
    this.ctx = null;
    this.master = null;
    this.sfx = null;
    this.music = null;
    this.muted = false;
    try { this.muted = localStorage.getItem('coinjump.muted') === '1'; } catch {}
    this.song = null;
    this.musicTimer = null;
    this.musicStep = 0;
    this.nextNote = 0;
    this.wantedSong = -1;
  }

  init() {
    if (this.ctx) {
      if (this.ctx.state === 'suspended') this.ctx.resume().catch(() => {});
      return;
    }
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    this.ctx = new AC();
    this.master = this.ctx.createGain();
    this.master.gain.value = this.muted ? 0 : 0.9;
    this.master.connect(this.ctx.destination);

    this.sfx = this.ctx.createGain();
    this.sfx.gain.value = 0.5;
    this.sfx.connect(this.master);

    this.music = this.ctx.createGain();
    this.music.gain.value = 0.16;
    this.music.connect(this.master);
  }

  setMuted(muted) {
    this.muted = muted;
    try { localStorage.setItem('coinjump.muted', muted ? '1' : '0'); } catch {}
    if (this.master && this.ctx) {
      this.master.gain.setTargetAtTime(muted ? 0 : 0.9, this.ctx.currentTime, 0.03);
    }
    if (muted) this.stopMusic();
  }

  tone(freq, dur, { type = 'square', vol = 0.1, slide = 1, delay = 0, attack = 0.006, music = false } = {}) {
    if (!this.ctx || !this.sfx) return;
    const t0 = this.ctx.currentTime + delay;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(Math.max(20, freq), t0);
    if (slide !== 1) {
      osc.frequency.exponentialRampToValueAtTime(Math.max(20, freq * slide), t0 + dur);
    }
    gain.gain.setValueAtTime(0.0001, t0);
    gain.gain.linearRampToValueAtTime(vol, t0 + attack);
    gain.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    osc.connect(gain);
    gain.connect(music ? this.music : this.sfx);
    osc.start(t0);
    osc.stop(t0 + dur + 0.03);
  }

  jump(mult = 1) {
    this.init();
    const base = 290 + Math.min(mult, 2.4) * 120;
    this.tone(base, 0.16, { type: 'square', vol: 0.075, slide: 2.1 });
    this.tone(base * 0.5, 0.1, { type: 'triangle', vol: 0.05, slide: 1.6, delay: 0.01 });
  }

  coin(streak = 0) {
    this.init();
    const pitch = 1 + Math.min(streak, 24) * 0.014;
    this.tone(1046 * pitch, 0.07, { type: 'triangle', vol: 0.1, slide: 1.02 });
    this.tone(1568 * pitch, 0.12, { type: 'triangle', vol: 0.085, delay: 0.065, slide: 1.01 });
  }

  power() {
    this.init();
    [523, 659, 784, 1046, 1318].forEach((f, i) => {
      this.tone(f, 0.1, { type: 'square', vol: 0.055, delay: i * 0.045, slide: 1.02 });
    });
  }

  stomp() {
    this.init();
    this.tone(180, 0.12, { type: 'square', vol: 0.09, slide: 0.32 });
    this.tone(90, 0.1, { type: 'triangle', vol: 0.08, slide: 0.5, delay: 0.01 });
  }

  hurt() {
    this.init();
    this.tone(260, 0.3, { type: 'sawtooth', vol: 0.09, slide: 0.3 });
    this.tone(130, 0.32, { type: 'square', vol: 0.06, slide: 0.4, delay: 0.03 });
  }

  spring() {
    this.init();
    this.tone(170, 0.28, { type: 'triangle', vol: 0.1, slide: 6.2 });
    this.tone(340, 0.14, { type: 'square', vol: 0.04, slide: 3, delay: 0.02 });
  }

  checkpoint() {
    this.init();
    [523, 659, 784, 1046].forEach((f, i) => {
      this.tone(f, 0.16, { type: 'triangle', vol: 0.075, delay: i * 0.07, slide: 1.01 });
    });
  }

  block() {
    this.init();
    this.tone(150, 0.08, { type: 'square', vol: 0.08, slide: 0.7 });
  }

  fall() {
    this.init();
    this.tone(700, 0.42, { type: 'sine', vol: 0.07, slide: 0.16 });
  }

  click() {
    this.init();
    this.tone(760, 0.05, { type: 'triangle', vol: 0.05, slide: 1.1 });
  }

  clear() {
    this.init();
    [523, 659, 784, 1046, 1318, 1568].forEach((f, i) => {
      this.tone(f, i === 5 ? 0.5 : 0.18, { type: 'triangle', vol: 0.09, delay: i * 0.11, slide: 1.005 });
    });
  }

  win() {
    this.init();
    const seq = [523, 659, 784, 1046, 784, 1046, 1318, 1568];
    seq.forEach((f, i) => {
      this.tone(f, i === seq.length - 1 ? 0.8 : 0.22, {
        type: 'triangle', vol: 0.09, delay: i * 0.13, slide: 1.005,
      });
    });
    this.tone(261, 0.8, { type: 'triangle', vol: 0.05, delay: 0, slide: 1.01 });
  }

  gameover() {
    this.init();
    [392, 349, 294, 196].forEach((f, i) => {
      this.tone(f, 0.32, { type: 'triangle', vol: 0.085, delay: i * 0.18, slide: 0.98 });
    });
  }

  startMusic(theme = 0) {
    this.wantedSong = theme;
    if (this.muted) return;
    this.init();
    if (!this.ctx) return;
    this.stopMusic();
    this.song = SONGS[theme % SONGS.length];
    this.musicStep = 0;
    this.nextNote = this.ctx.currentTime + 0.1;
    if (this.music) this.music.gain.setTargetAtTime(0.16, this.ctx.currentTime, 0.08);
    this.scheduleMusic();
    this.musicTimer = setInterval(() => this.scheduleMusic(), 60);
  }

  scheduleMusic() {
    if (!this.ctx || !this.song) return;
    const ahead = this.ctx.currentTime + 0.32;
    let guard = 0;
    while (this.nextNote < ahead && guard++ < 12) {
      const i = this.musicStep;
      const lead = this.song.lead[i % this.song.lead.length];
      if (lead != null) {
        this.musicTone(midiToFreq(lead), this.song.step * 0.82, 'square', 0.035, this.nextNote);
      }
      if (i % 8 === 0) {
        const bass = this.song.bass[(Math.floor(i / 8)) % this.song.bass.length];
        this.musicTone(midiToFreq(bass), this.song.step * 6.4, 'triangle', 0.055, this.nextNote);
      }
      if (i % 4 === 2) {
        this.musicTone(midiToFreq(lead != null ? lead + 12 : 72), this.song.step * 0.3, 'sine', 0.012, this.nextNote);
      }
      this.nextNote += this.song.step;
      this.musicStep++;
    }
  }

  musicTone(freq, dur, type, vol, startTime) {
    if (!this.ctx || !this.music) return;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, startTime);
    gain.gain.setValueAtTime(0.0001, startTime);
    gain.gain.linearRampToValueAtTime(vol, startTime + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.0001, startTime + dur);
    osc.connect(gain);
    gain.connect(this.music);
    osc.start(startTime);
    osc.stop(startTime + dur + 0.05);
  }

  stopMusic() {
    if (this.musicTimer) clearInterval(this.musicTimer);
    this.musicTimer = null;
    this.song = null;
  }

  resumeWantedMusic() {
    if (this.wantedSong >= 0 && !this.muted) this.startMusic(this.wantedSong);
  }
}
