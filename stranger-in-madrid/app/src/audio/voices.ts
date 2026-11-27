// One fixed voice per character (device TTS, es-ES), consistent across passes and sessions.
import * as Speech from "expo-speech";
import type { Character } from "../../../shared/src";
import { mixer } from "./mixer";

let esVoices: Speech.Voice[] = [];
let ready: Promise<void> | null = null;

export function initVoices(): Promise<void> {
  ready ??= (async () => {
    const all = await Speech.getAvailableVoicesAsync();
    const norm = (l: string) => l.replace("_", "-").toLowerCase();
    esVoices = all.filter((v) => norm(v.language) === "es-es");
    if (!esVoices.length) esVoices = all.filter((v) => norm(v.language).startsWith("es"));
    // Stable order so a character keeps the same voice forever on this device.
    esVoices.sort((a, b) => a.identifier.localeCompare(b.identifier));
  })();
  return ready;
}

export const voiceCount = () => esVoices.length;

let characters: Record<string, Character> = {};
export function setCharacters(c: Record<string, Character>) {
  characters = c;
}

function voiceFor(c: Character | undefined): string | undefined {
  if (!c || !esVoices.length) return undefined;
  // Devices expose few es-ES voices (often 1–4); voiceIndex + per-character pitch/rate keep everyone distinct.
  return esVoices[c.tts.voiceIndex % esVoices.length].identifier;
}

let speedFactor = 1;
export const setVoiceSpeed = (f: number) => (speedFactor = f);

/** Speaks a line in the character's voice; resolves when done. Ambience is ducked while speaking. */
export function speak(text: string, speaker: string, opts: { slow?: boolean } = {}): Promise<void> {
  const c = characters[speaker];
  return new Promise((resolve) => {
    mixer.duck(true);
    const done = () => {
      mixer.duck(false);
      resolve();
    };
    Speech.speak(text, {
      language: "es-ES",
      voice: voiceFor(c),
      pitch: c?.tts.pitch ?? 1,
      rate: (c?.tts.rate ?? 1) * speedFactor * (opts.slow ? 0.7 : 1),
      onDone: done,
      onStopped: done,
      onError: done,
    });
  });
}

export function stopSpeaking() {
  Speech.stop();
  mixer.duck(false);
}

/** Sound zoom: natural line → short clear pieces → natural line again. */
export async function soundZoom(text: string, speaker: string) {
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
  for (const p of pieces) await speak(p, speaker, { slow: true });
  await speak(text, speaker);
}
