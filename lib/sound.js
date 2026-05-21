// Synthesized 8-bit / chiptune game sounds via the Web Audio API — no audio
// assets to host. Pulse + triangle oscillators (NES-style), bouncy arpeggios.
// A single shared AudioContext is created lazily on first playback (after a
// user gesture, per browser autoplay rules).

let ctx = null;
let master = null;
let pulseWave = null;
let muted = false;
let volume = 0.6;

if (typeof window !== 'undefined') {
  muted = localStorage.getItem('poordown_muted') === 'true';
  const v = parseFloat(localStorage.getItem('poordown_volume'));
  if (!Number.isNaN(v)) volume = Math.min(1, Math.max(0, v));
}

function applyGain() {
  if (master) master.gain.value = muted ? 0 : volume;
}

// 25%-duty pulse wave — the classic NES lead voice
function makePulse(c, duty = 0.25, n = 22) {
  const real = new Float32Array(n);
  const imag = new Float32Array(n);
  for (let i = 1; i < n; i++) imag[i] = (2 / (i * Math.PI)) * Math.sin(i * Math.PI * duty);
  return c.createPeriodicWave(real, imag, { disableNormalization: false });
}

function getCtx() {
  if (typeof window === 'undefined') return null;
  const AC = window.AudioContext || window.webkitAudioContext;
  if (!AC) return null;
  if (!ctx) {
    ctx = new AC();
    master = ctx.createGain();
    applyGain();
    // Gentle lowpass tames the harsh top end of square/pulse waves
    const lp = ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.value = 7000;
    master.connect(lp);
    lp.connect(ctx.destination);
    pulseWave = makePulse(ctx);
  }
  if (ctx.state === 'suspended') ctx.resume();
  return ctx;
}

export function isMuted() { return muted; }
export function getVolume() { return volume; }

export function setMuted(value) {
  muted = value;
  applyGain();
  if (typeof window !== 'undefined') localStorage.setItem('poordown_muted', String(value));
}

export function toggleMuted() {
  setMuted(!muted);
  return muted;
}

export function setVolume(value) {
  volume = Math.min(1, Math.max(0, value));
  if (volume > 0 && muted) muted = false; // dragging the slider up unmutes
  applyGain();
  if (typeof window !== 'undefined') {
    localStorage.setItem('poordown_volume', String(volume));
    localStorage.setItem('poordown_muted', String(muted));
  }
}

// A single chiptune note with a snappy percussive envelope.
// type: 'pulse' (NES lead) | 'triangle' (NES bass) | 'square'
function blip(c, { freq, start = 0, dur, type = 'pulse', gain = 0.2, slideTo, attack = 0.004 }) {
  const t0 = c.currentTime + start;
  const osc = c.createOscillator();
  const g = c.createGain();
  if (type === 'pulse' && pulseWave) osc.setPeriodicWave(pulseWave);
  else osc.type = type === 'pulse' ? 'square' : type;
  osc.frequency.setValueAtTime(freq, t0);
  if (slideTo) osc.frequency.linearRampToValueAtTime(slideTo, t0 + dur);
  g.gain.setValueAtTime(0.0001, t0);
  g.gain.exponentialRampToValueAtTime(gain, t0 + attack);
  g.gain.setValueAtTime(gain * 0.9, t0 + dur * 0.55);
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
  osc.connect(g);
  g.connect(master);
  osc.start(t0);
  osc.stop(t0 + dur + 0.02);
}

const ready = () => (!muted && volume > 0 ? getCtx() : null);

// A card was drawn / placed — crisp upward blip
export function playDraw() {
  const c = ready();
  if (!c) return;
  blip(c, { freq: 880, dur: 0.07, gain: 0.2, slideTo: 1320 });
}

// It's your turn — bright coin-style alert
export function playYourTurn() {
  const c = ready();
  if (!c) return;
  blip(c, { freq: 988, dur: 0.08, gain: 0.22 });             // B5
  blip(c, { freq: 1319, start: 0.075, dur: 0.24, gain: 0.22 }); // E6
}

// A player busted / got hit with penalty cards — arcade "fail" descent
export function playBust() {
  const c = ready();
  if (!c) return;
  [466, 415, 370, 311].forEach((f, i) => // Bb4 Ab4 F#4 Eb4 — chromatic-ish drop
    blip(c, { freq: f, start: i * 0.085, dur: i === 3 ? 0.32 : 0.1, gain: 0.2, slideTo: i === 3 ? 233 : undefined })
  );
  blip(c, { freq: 117, start: 0.28, dur: 0.34, type: 'triangle', gain: 0.22 }); // low thud
}

// Round start — energetic ascending fanfare
export function playRoundStart() {
  const c = ready();
  if (!c) return;
  [523, 659, 784, 1047].forEach((f, i) => // C5 E5 G5 C6
    blip(c, { freq: f, start: i * 0.07, dur: 0.16, gain: 0.2 })
  );
  blip(c, { freq: 1319, start: 0.28, dur: 0.22, gain: 0.22 }); // E6 accent
  blip(c, { freq: 262, start: 0, dur: 0.5, type: 'triangle', gain: 0.18 }); // bass body
}

// Round end — triumphant little victory jingle
export function playRoundEnd() {
  const c = ready();
  if (!c) return;
  [784, 1047, 1319].forEach((f, i) => // G5 C6 E6
    blip(c, { freq: f, start: i * 0.1, dur: 0.16, gain: 0.21 })
  );
  blip(c, { freq: 1568, start: 0.3, dur: 0.42, gain: 0.23 }); // G6 held accent
  blip(c, { freq: 392, start: 0, dur: 0.7, type: 'triangle', gain: 0.18 }); // bass
}
