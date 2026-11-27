// Ambience beds + SFX synthesized in the browser (original synthesis, no files needed).
// Same recipes as tools/genSounds.mjs. Ambience ducks ~12 dB under speech; noise dial off/light/real.
import type { NoiseDial } from "./store";

const SR = 22050;
let ctx: AudioContext | null = null;
let bedGain: GainNode | null = null;
let sfxGain: GainNode | null = null;
let bedSrc: AudioBufferSourceNode | null = null;
let bedName: string | null = null;
const buffers = new Map<string, AudioBuffer>();
let noise: NoiseDial = "light";
let ducked = false;

let seed = 12345;
const rand = () => ((seed = (seed * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff) * 2 - 1;
const len = (sec: number) => new Float32Array(Math.round(sec * SR));
const env = (i: number, n: number, a = 0.01, r = 0.1) => Math.min(1, i / SR / a) * Math.min(1, (n - i) / SR / r);
function lowpass(x: Float32Array, cut: number) {
  const a = Math.exp((-2 * Math.PI * cut) / SR);
  let y = 0;
  return x.map((v) => (y = (1 - a) * v + a * y));
}
function bandNoise(n: number, lo: number, hi: number) {
  const w = new Float32Array(n).map(rand);
  const l1 = lowpass(w, hi), l2 = lowpass(w, lo);
  return l1.map((v, i) => v - l2[i]);
}
function addAt(dst: Float32Array, src: Float32Array, atSec: number, gain = 1) {
  const o = Math.round(atSec * SR);
  for (let i = 0; i < src.length && o + i < dst.length; i++) dst[o + i] += src[i] * gain;
}
function makeLoop(x: Float32Array, fadeSec = 1) {
  const f = Math.round(fadeSec * SR), n = x.length - f, out = new Float32Array(n);
  for (let i = 0; i < n; i++) out[i] = x[i];
  for (let i = 0; i < f; i++) out[i] = x[i] * (i / f) + x[n + i] * (1 - i / f);
  return out;
}
function kick() {
  const x = len(0.35);
  for (let i = 0; i < x.length; i++) {
    const t = i / SR;
    x[i] = Math.sin(2 * Math.PI * (120 - 260 * t) * t) * Math.exp(-t * 22) + rand() * Math.exp(-t * 60) * 0.6;
  }
  return lowpass(x, 2500);
}
function whistle(sec = 0.9) {
  const x = len(sec);
  let ph = 0;
  for (let i = 0; i < x.length; i++) {
    const t = i / SR, f = 2850 + 140 * Math.sin(2 * Math.PI * 38 * t);
    ph += (2 * Math.PI * f) / SR;
    x[i] = (Math.sin(ph) * 0.8 + rand() * 0.08) * env(i, x.length, 0.02, 0.08);
  }
  return x;
}
function uuuh() {
  const x = len(1.7);
  for (let v = 0; v < 12; v++) {
    const f0 = 260 + v * 23 + rand() * 20, d = Math.abs(rand()) * 0.12;
    let ph = 0;
    for (let i = 0; i < x.length; i++) {
      const t = i / SR - d;
      if (t < 0) continue;
      const f = f0 * (1 + 0.25 * Math.min(1, t / 0.9)) * (1 + 0.01 * Math.sin(2 * Math.PI * 5.5 * t));
      ph += (2 * Math.PI * f) / SR;
      x[i] += (Math.sin(ph) + 0.5 * Math.sin(2 * ph) + 0.25 * Math.sin(3 * ph)) * 0.08 * env(i, x.length, 0.15, 0.4);
    }
  }
  return lowpass(x, 900);
}
function espresso() {
  const x = len(2.2), hiss = bandNoise(x.length, 1500, 7000), rumble = bandNoise(x.length, 40, 180);
  return x.map((_, i) => (hiss[i] * 0.7 + rumble[i] * 1.5) * env(i, x.length, 0.2, 0.5));
}
function clink(f = 3200, sec = 0.5) {
  const x = len(sec);
  for (let i = 0; i < x.length; i++) {
    const t = i / SR;
    x[i] = (Math.sin(2 * Math.PI * f * t) + 0.6 * Math.sin(2 * Math.PI * f * 2.76 * t) + 0.3 * Math.sin(2 * Math.PI * f * 5.4 * t)) * Math.exp(-t * 14);
  }
  return x;
}
function doorBell() {
  const x = len(1.2);
  addAt(x, clink(1760, 1.2), 0, 1);
  addAt(x, clink(2093, 1.0), 0.12, 0.8);
  return x;
}
function pitchAmbience() {
  const n = Math.round(14 * SR);
  const wind = lowpass(bandNoise(n, 60, 900), 700);
  const x = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    const t = i / SR;
    x[i] = wind[i] * (0.55 + 0.35 * Math.sin(2 * Math.PI * 0.11 * t) + 0.1 * Math.sin(2 * Math.PI * 0.37 * t));
  }
  for (const at of [1.2, 3.9, 4.6, 7.3, 9.8, 11.1, 12.4]) addAt(x, lowpass(kick(), 900), at, 0.25);
  for (const at of [2.5, 8.6]) addAt(x, lowpass(uuuh(), 500).slice(0, Math.round(0.7 * SR)), at, 0.12);
  return makeLoop(x, 1.2);
}
function cafeAmbience() {
  const n = Math.round(14 * SR);
  const murmur = bandNoise(n, 180, 1100), x = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    const t = i / SR;
    x[i] = murmur[i] * (0.6 + 0.25 * Math.abs(Math.sin(2 * Math.PI * 2.3 * t)) + 0.15 * Math.abs(Math.sin(2 * Math.PI * 3.7 * t + 1)));
  }
  for (const [at, f] of [[1.5, 3100], [4.2, 2600], [6.8, 3500], [10.1, 2900], [12.3, 3300]]) addAt(x, clink(f, 0.4), at, 0.12);
  addAt(x, espresso(), 7.5, 0.25);
  return makeLoop(x, 1.2);
}

const RECIPES: Record<string, () => Float32Array> = {
  pitch_ambience: pitchAmbience,
  cafe_ambience: cafeAmbience,
  whistle: () => whistle(),
  ball_kick: kick,
  kids_uuuh: uuuh,
  espresso_machine: espresso,
  spoon: () => clink(3400, 0.45),
  door_bell: doorBell,
};

function buffer(name: string): AudioBuffer | null {
  if (!ctx || !RECIPES[name]) return null;
  if (!buffers.has(name)) {
    const data = RECIPES[name]();
    let peak = 0;
    for (const v of data) peak = Math.max(peak, Math.abs(v));
    const g = peak ? 0.89 / peak : 1;
    const b = ctx.createBuffer(1, data.length, SR);
    b.getChannelData(0).set(data.map((v) => v * g));
    buffers.set(name, b);
  }
  return buffers.get(name)!;
}

const LEVEL: Record<NoiseDial, number> = { off: 0, light: 0.3, real: 0.75 };
const target = () => (ducked && noise !== "real" ? LEVEL[noise] * 0.25 : LEVEL[noise]);

function applyLevel(ramp = 0.15) {
  if (!ctx || !bedGain) return;
  bedGain.gain.cancelScheduledValues(ctx.currentTime);
  bedGain.gain.setTargetAtTime(target(), ctx.currentTime, ramp / 3);
}

/** Must be called from a click (browsers only start audio after a gesture). */
export function unlockAudio() {
  if (!ctx) {
    const AC = window.AudioContext ?? (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (!AC) return;
    ctx = new AC();
    bedGain = ctx.createGain();
    sfxGain = ctx.createGain();
    bedGain.gain.value = 0;
    bedGain.connect(ctx.destination);
    sfxGain.connect(ctx.destination);
  }
  void ctx.resume();
}

export function setNoise(n: NoiseDial) {
  noise = n;
  applyLevel();
}

export function playAmbience(name: string | null | undefined) {
  if (!ctx || !bedGain) return;
  if (name === bedName) return;
  stopAmbience();
  const b = name ? buffer(name) : null;
  if (!b) return;
  bedSrc = ctx.createBufferSource();
  bedSrc.buffer = b;
  bedSrc.loop = true;
  bedSrc.connect(bedGain);
  bedSrc.start();
  bedName = name!;
  applyLevel(0.8);
}

export function stopAmbience() {
  try {
    bedSrc?.stop();
  } catch {
    /* already stopped */
  }
  bedSrc = null;
  bedName = null;
}

export function duck(on: boolean) {
  if (ducked === on) return;
  ducked = on;
  applyLevel();
}

export function playSfx(name: string | null | undefined) {
  if (!ctx || !sfxGain || !name) return;
  const b = buffer(name);
  if (!b) return;
  const s = ctx.createBufferSource();
  s.buffer = b;
  sfxGain.gain.value = noise === "off" ? 0.5 : 0.8;
  s.connect(sfxGain);
  s.start();
}
