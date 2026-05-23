// Pirate Smash sound effects. Synthesized via Web Audio. Respects the global
// mute/volume from lib/sound.js.

import { isMuted, getVolume } from '../../sound';

let ctx = null;

function getCtx() {
  if (typeof window === 'undefined') return null;
  const AC = window.AudioContext || window.webkitAudioContext;
  if (!AC) return null;
  if (!ctx) ctx = new AC();
  if (ctx.state === 'suspended') ctx.resume();
  return ctx;
}

function envGain(c, peak, duration) {
  const g = c.createGain();
  const now = c.currentTime;
  const v = peak * getVolume() * (isMuted() ? 0 : 1);
  g.gain.setValueAtTime(0, now);
  g.gain.linearRampToValueAtTime(v, now + 0.005);
  g.gain.exponentialRampToValueAtTime(0.0001, now + duration);
  g.connect(c.destination);
  return g;
}

function noiseBuffer(c, durationSec, fade = true) {
  const samples = Math.floor(22050 * durationSec);
  const buf = c.createBuffer(1, samples, 22050);
  const data = buf.getChannelData(0);
  for (let i = 0; i < samples; i++) {
    const env = fade ? (1 - i / samples) : 1;
    data[i] = (Math.random() * 2 - 1) * env;
  }
  return buf;
}

export function playCannon() {
  const c = getCtx();
  if (!c || isMuted()) return;
  const src = c.createBufferSource();
  src.buffer = noiseBuffer(c, 0.18);
  const f = c.createBiquadFilter();
  f.type = 'lowpass';
  f.frequency.value = 600;
  const g = envGain(c, 0.5, 0.25);
  src.connect(f); f.connect(g);
  src.start();

  const o = c.createOscillator();
  o.type = 'sine';
  o.frequency.setValueAtTime(85, c.currentTime);
  o.frequency.exponentialRampToValueAtTime(30, c.currentTime + 0.2);
  const og = envGain(c, 0.55, 0.22);
  o.connect(og);
  o.start();
  o.stop(c.currentTime + 0.22);
}

export function playMortar() {
  const c = getCtx();
  if (!c || isMuted()) return;
  const o = c.createOscillator();
  o.type = 'square';
  o.frequency.setValueAtTime(220, c.currentTime);
  o.frequency.linearRampToValueAtTime(120, c.currentTime + 0.18);
  const g = envGain(c, 0.3, 0.22);
  o.connect(g);
  o.start();
  o.stop(c.currentTime + 0.22);
}

export function playExplosion() {
  const c = getCtx();
  if (!c || isMuted()) return;
  const src = c.createBufferSource();
  src.buffer = noiseBuffer(c, 0.45);
  const f = c.createBiquadFilter();
  f.type = 'lowpass';
  f.frequency.setValueAtTime(1400, c.currentTime);
  f.frequency.exponentialRampToValueAtTime(180, c.currentTime + 0.4);
  const g = envGain(c, 0.55, 0.5);
  src.connect(f); f.connect(g);
  src.start();
}

export function playPickup() {
  const c = getCtx();
  if (!c || isMuted()) return;
  const notes = [523, 698, 880];
  notes.forEach((freq, i) => {
    const o = c.createOscillator();
    o.type = 'triangle';
    o.frequency.setValueAtTime(freq, c.currentTime + i * 0.05);
    const g = c.createGain();
    const v = 0.25 * getVolume();
    g.gain.setValueAtTime(0, c.currentTime + i * 0.05);
    g.gain.linearRampToValueAtTime(v, c.currentTime + i * 0.05 + 0.01);
    g.gain.exponentialRampToValueAtTime(0.001, c.currentTime + i * 0.05 + 0.18);
    g.connect(c.destination);
    o.connect(g);
    o.start(c.currentTime + i * 0.05);
    o.stop(c.currentTime + i * 0.05 + 0.2);
  });
}

export function playSink() {
  const c = getCtx();
  if (!c || isMuted()) return;
  const o = c.createOscillator();
  o.type = 'sawtooth';
  o.frequency.setValueAtTime(220, c.currentTime);
  o.frequency.exponentialRampToValueAtTime(40, c.currentTime + 0.6);
  const g = envGain(c, 0.4, 0.7);
  o.connect(g);
  o.start();
  o.stop(c.currentTime + 0.7);

  const src = c.createBufferSource();
  src.buffer = noiseBuffer(c, 0.5);
  const ng = envGain(c, 0.3, 0.5);
  src.connect(ng);
  src.start(c.currentTime + 0.15);
}

export function playBoost() {
  const c = getCtx();
  if (!c || isMuted()) return;
  const o = c.createOscillator();
  o.type = 'sawtooth';
  o.frequency.setValueAtTime(180, c.currentTime);
  o.frequency.exponentialRampToValueAtTime(620, c.currentTime + 0.25);
  const g = envGain(c, 0.3, 0.3);
  o.connect(g);
  o.start();
  o.stop(c.currentTime + 0.3);
}

export function playShield() {
  const c = getCtx();
  if (!c || isMuted()) return;
  const o = c.createOscillator();
  o.type = 'triangle';
  o.frequency.setValueAtTime(440, c.currentTime);
  o.frequency.linearRampToValueAtTime(880, c.currentTime + 0.25);
  const g = envGain(c, 0.28, 0.35);
  o.connect(g);
  o.start();
  o.stop(c.currentTime + 0.35);
}

export function playMineDrop() {
  const c = getCtx();
  if (!c || isMuted()) return;
  const o = c.createOscillator();
  o.type = 'square';
  o.frequency.setValueAtTime(180, c.currentTime);
  const g = envGain(c, 0.25, 0.15);
  o.connect(g);
  o.start();
  o.stop(c.currentTime + 0.15);
}

export function playCountdown() {
  const c = getCtx();
  if (!c || isMuted()) return;
  const o = c.createOscillator();
  o.type = 'triangle';
  o.frequency.setValueAtTime(660, c.currentTime);
  const g = envGain(c, 0.3, 0.2);
  o.connect(g);
  o.start();
  o.stop(c.currentTime + 0.2);
}

export function playGo() {
  const c = getCtx();
  if (!c || isMuted()) return;
  const notes = [523, 784, 1046];
  notes.forEach((freq, i) => {
    const o = c.createOscillator();
    o.type = 'triangle';
    o.frequency.setValueAtTime(freq, c.currentTime + i * 0.04);
    const g = c.createGain();
    const v = 0.32 * getVolume();
    g.gain.setValueAtTime(0, c.currentTime + i * 0.04);
    g.gain.linearRampToValueAtTime(v, c.currentTime + i * 0.04 + 0.01);
    g.gain.exponentialRampToValueAtTime(0.001, c.currentTime + i * 0.04 + 0.3);
    g.connect(c.destination);
    o.connect(g);
    o.start(c.currentTime + i * 0.04);
    o.stop(c.currentTime + i * 0.04 + 0.32);
  });
}

export function playGameOver() {
  const c = getCtx();
  if (!c || isMuted()) return;
  const notes = [392, 523, 659, 784, 988, 1318];
  notes.forEach((freq, i) => {
    const o = c.createOscillator();
    o.type = 'triangle';
    o.frequency.setValueAtTime(freq, c.currentTime + i * 0.12);
    const g = c.createGain();
    const v = 0.25 * getVolume();
    g.gain.setValueAtTime(0, c.currentTime + i * 0.12);
    g.gain.linearRampToValueAtTime(v, c.currentTime + i * 0.12 + 0.02);
    g.gain.exponentialRampToValueAtTime(0.001, c.currentTime + i * 0.12 + 0.5);
    g.connect(c.destination);
    o.connect(g);
    o.start(c.currentTime + i * 0.12);
    o.stop(c.currentTime + i * 0.12 + 0.52);
  });
}
