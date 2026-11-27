// Generates the MVP ambience + SFX procedurally (original synthesis, dedicated to the public domain / CC0).
// Usage: node tools/genSounds.mjs   → writes app/assets/audio/*.wav
// Swap any file for a CC0 recording (e.g. Freesound filtered to CC0) later; keep the same file names.
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const SR = 22050;
const OUT = join(dirname(fileURLToPath(import.meta.url)), "../app/assets/audio");
mkdirSync(OUT, { recursive: true });

let seed = 12345;
const rand = () => ((seed = (seed * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff) * 2 - 1;

function wav(name, samples) {
  const n = samples.length;
  const buf = Buffer.alloc(44 + n * 2);
  buf.write("RIFF", 0); buf.writeUInt32LE(36 + n * 2, 4); buf.write("WAVE", 8);
  buf.write("fmt ", 12); buf.writeUInt32LE(16, 16); buf.writeUInt16LE(1, 20); buf.writeUInt16LE(1, 22);
  buf.writeUInt32LE(SR, 24); buf.writeUInt32LE(SR * 2, 28); buf.writeUInt16LE(2, 32); buf.writeUInt16LE(16, 34);
  buf.write("data", 36); buf.writeUInt32LE(n * 2, 40);
  let peak = 0;
  for (const s of samples) peak = Math.max(peak, Math.abs(s));
  const g = peak > 0 ? 0.89 / peak : 1;
  for (let i = 0; i < n; i++) buf.writeInt16LE(Math.round(Math.max(-1, Math.min(1, samples[i] * g)) * 32767), 44 + i * 2);
  writeFileSync(join(OUT, `${name}.wav`), buf);
  console.log(`${name}.wav  ${(n / SR).toFixed(1)}s`);
}

const len = (sec) => new Float32Array(Math.round(sec * SR));
const env = (i, n, a = 0.01, r = 0.1) => {
  const t = i / SR, T = n / SR;
  return Math.min(1, t / a) * Math.min(1, (T - t) / r);
};
function lowpass(x, cut) {
  const a = Math.exp((-2 * Math.PI * cut) / SR);
  let y = 0;
  return x.map((v) => (y = (1 - a) * v + a * y));
}
function bandNoise(n, lo, hi) {
  const w = new Float32Array(n).map(rand);
  const l1 = lowpass(w, hi), l2 = lowpass(w, lo);
  return l1.map((v, i) => v - l2[i]);
}
function addAt(dst, src, atSec, gain = 1) {
  const o = Math.round(atSec * SR);
  for (let i = 0; i < src.length && o + i < dst.length; i++) dst[o + i] += src[i] * gain;
}
/** Loop-safe: crossfade the tail into the head. */
function makeLoop(x, fadeSec = 1) {
  const f = Math.round(fadeSec * SR), n = x.length - f, out = new Float32Array(n);
  for (let i = 0; i < n; i++) out[i] = x[i];
  for (let i = 0; i < f; i++) out[i] = x[i] * (i / f) + x[n + i] * (1 - i / f);
  return out;
}

// --- SFX ---
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
    const t = i / SR, f = 2850 + 140 * Math.sin(2 * Math.PI * 38 * t); // pea rattle
    ph += (2 * Math.PI * f) / SR;
    x[i] = (Math.sin(ph) * 0.8 + rand() * 0.08) * env(i, x.length, 0.02, 0.08);
  }
  return x;
}
function uuuh() {
  // A dozen kids' voices gliding up on "uuu" (formants ≈ 320 / 800 Hz), slightly detuned.
  const x = len(1.7);
  for (let v = 0; v < 12; v++) {
    const f0 = 260 + v * 23 + rand() * 20, d = rand() * 0.12;
    let ph = 0;
    for (let i = 0; i < x.length; i++) {
      const t = i / SR - d;
      if (t < 0) continue;
      const f = f0 * (1 + 0.25 * Math.min(1, t / 0.9)) * (1 + 0.01 * Math.sin(2 * Math.PI * 5.5 * t));
      ph += (2 * Math.PI * f) / SR;
      const src = Math.sin(ph) + 0.5 * Math.sin(2 * ph) + 0.25 * Math.sin(3 * ph);
      x[i] += src * 0.08 * env(i, x.length, 0.15, 0.4);
    }
  }
  const voiced = lowpass(x, 900);
  return voiced.map((s, i) => s + rand() * 0.01 * env(i, x.length, 0.15, 0.4));
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

// --- Ambience beds ---
function pitchAmbience() {
  const sec = 14, n = Math.round(sec * SR);
  const wind = lowpass(bandNoise(n, 60, 900), 700);
  const x = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    const t = i / SR;
    x[i] = wind[i] * (0.55 + 0.35 * Math.sin(2 * Math.PI * 0.11 * t) + 0.1 * Math.sin(2 * Math.PI * 0.37 * t));
  }
  // distant kicks and far shouts
  for (const at of [1.2, 3.9, 4.6, 7.3, 9.8, 11.1, 12.4]) addAt(x, lowpass(kick(), 900), at, 0.25);
  for (const at of [2.5, 8.6]) addAt(x, lowpass(uuuh(), 500).slice(0, Math.round(0.7 * SR)), at, 0.12);
  return makeLoop(x, 1.2);
}
function cafeAmbience() {
  const sec = 14, n = Math.round(sec * SR);
  const murmur = bandNoise(n, 180, 1100), x = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    const t = i / SR;
    // syllable-rate modulation makes noise sound like distant chatter
    const m = 0.6 + 0.25 * Math.abs(Math.sin(2 * Math.PI * 2.3 * t)) + 0.15 * Math.abs(Math.sin(2 * Math.PI * 3.7 * t + 1));
    x[i] = murmur[i] * m;
  }
  for (const [at, f] of [[1.5, 3100], [4.2, 2600], [6.8, 3500], [10.1, 2900], [12.3, 3300]]) addAt(x, clink(f, 0.4), at, 0.12);
  addAt(x, espresso(), 7.5, 0.25);
  return makeLoop(x, 1.2);
}

wav("pitch_ambience", pitchAmbience());
wav("cafe_ambience", cafeAmbience());
wav("whistle", whistle());
wav("ball_kick", kick());
wav("kids_uuuh", uuuh());
wav("espresso_machine", espresso());
wav("spoon", clink(3400, 0.45));
wav("door_bell", doorBell());
