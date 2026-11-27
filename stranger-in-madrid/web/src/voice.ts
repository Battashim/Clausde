// Voices: the browser's own Spanish (es-ES) speech, one fixed voice/pitch/rate per character.
// Falls back to the platform's Claude voices only if the browser has no Spanish voice.
import type { Character } from "../../shared/src";
import { caps } from "./platform";
import { duck } from "./sound";

let es: SpeechSynthesisVoice[] = [];
let chars: Record<string, Character> = {};
let speed = 1;
let stopped = 0;

function loadVoices() {
  const all = typeof speechSynthesis !== "undefined" ? speechSynthesis.getVoices() : [];
  const norm = (l: string) => l.replace("_", "-").toLowerCase();
  let v = all.filter((x) => norm(x.lang) === "es-es");
  if (!v.length) v = all.filter((x) => norm(x.lang).startsWith("es"));
  // Prefer the free high-quality voices: Edge "Natural/Online", Apple "Enhanced/Premium", Google voices.
  const rank = (x: SpeechSynthesisVoice) => (/natural|neural|online/i.test(x.name) ? 0 : /premium|enhanced|mejorad/i.test(x.name) ? 1 : /google/i.test(x.name) ? 2 : 3);
  const best = Math.min(...v.map(rank));
  const good = v.filter((x) => rank(x) === best);
  es = (good.length ? good : v).sort((a, b) => a.name.localeCompare(b.name));
}

export function initVoices(): Promise<void> {
  if (typeof speechSynthesis === "undefined") return Promise.resolve();
  loadVoices();
  if (es.length) return Promise.resolve();
  return new Promise((r) => {
    const done = () => {
      loadVoices();
      r();
    };
    speechSynthesis.addEventListener?.("voiceschanged", done, { once: true });
    setTimeout(done, 1500);
  });
}

export const voiceSummary = () => ({ count: es.length, names: es.map((v) => v.name), natural: es.some((v) => /natural|neural|online|premium|enhanced|google/i.test(v.name)) });
export const setCharacters = (c: Record<string, Character>) => (chars = c);
export const setSpeed = (f: number) => (speed = f);

/** iOS only lets speech start from a tap: call once inside the first click. */
export function unlockSpeech() {
  if (typeof speechSynthesis === "undefined") return;
  const u = new SpeechSynthesisUtterance(" ");
  u.volume = 0;
  speechSynthesis.speak(u);
}

const CLAUDE_VOICES = ["buttery", "airy", "glassy", "rounded"] as const;

export function speak(text: string, speaker: string, opts: { slow?: boolean } = {}): Promise<void> {
  const c = chars[speaker];
  const token = stopped;
  if (!text.trim()) return Promise.resolve();
  if (!es.length && caps.tts) {
    duck(true);
    const said = Promise.resolve()
      .then(() => caps.tts.speak(text, { voice: CLAUDE_VOICES[(c?.tts.voiceIndex ?? 0) % 4], language: "es", rate: Math.min(1.5, Math.max(0.7, (c?.tts.rate ?? 1) * speed * (opts.slow ? 0.75 : 1))) }))
      .catch(() => undefined);
    // Never let a silent voice freeze the scene.
    return Promise.race([said, new Promise((r) => setTimeout(r, 2500 + text.length * 160))]).then(() => duck(false));
  }
  if (typeof speechSynthesis === "undefined") return Promise.resolve();
  return new Promise((resolve) => {
    if (token !== stopped) return resolve();
    const u = new SpeechSynthesisUtterance(text);
    u.lang = "es-ES";
    if (es.length && c) u.voice = es[c.tts.voiceIndex % es.length];
    else if (es.length) u.voice = es[0];
    u.pitch = c?.tts.pitch ?? 1;
    u.rate = Math.min(2, (c?.tts.rate ?? 1) * speed * (opts.slow ? 0.7 : 1));
    let finished = false;
    const done = () => {
      if (finished) return;
      finished = true;
      duck(false);
      resolve();
    };
    u.onend = done;
    u.onerror = done;
    duck(true);
    try {
      speechSynthesis.speak(u);
    } catch {
      done();
    }
    // Safety net: some browsers never fire onend.
    setTimeout(done, 1500 + text.length * 140);
  });
}

export function stopSpeaking() {
  stopped++;
  if (typeof speechSynthesis !== "undefined") speechSynthesis.cancel();
  caps.tts?.stop?.();
  duck(false);
}

/** Sound zoom: natural line → short clear pieces → natural line again. */
export async function soundZoom(text: string, speaker: string) {
  const token = stopped;
  await speak(text, speaker);
  const pieces = text
    .split(/[,.!?¿¡…;:«»]+/)
    .flatMap((p) => {
      const w = p.trim().split(/\s+/).filter(Boolean);
      const out: string[] = [];
      for (let i = 0; i < w.length; i += 3) out.push(w.slice(i, i + 3).join(" "));
      return out;
    })
    .filter(Boolean);
  for (const p of pieces) {
    if (token !== stopped) return;
    await speak(p, speaker, { slow: true });
  }
  if (token === stopped) await speak(text, speaker);
}
