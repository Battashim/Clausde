// Learner model (SPEC §6) for the web app: kept in the artifact's private per-person db
// (data/users/<id>/…), with a browser copy as a fallback when db is unavailable.
import {
  applyChunkEvent,
  emptyLearnerChunk,
  ratingFromOutcome,
  review,
  type CatchBoxItem,
  type ChunkEvent,
  type ErrorTag,
  type LearnerChunk,
} from "../../shared/src";
import { caps } from "./platform";

export type NoiseDial = "off" | "light" | "real";
export type SubtitleMode = "off" | "street" | "street_meaning";

export interface Settings {
  subtitles: SubtitleMode;
  noise: NoiseDial;
  voiceSpeed: number;
  skipCorridor: boolean;
  lifeFacts: string[];
}

export interface Attempt {
  id: string;
  episode_id: string;
  date: string;
  twist: string | null;
  passes_done: string[];
  self_comprehension: number | null;
  asked_meaning: number;
  freezes: number;
  avg_response_ms: number | null;
  success_line: string | null;
}

export interface TurnLog {
  pass: string;
  speaker: string;
  text: string;
  stt_raw?: string | null;
  stt_confidence?: number | null;
  response_ms?: number | null;
  typed?: boolean;
  feedback?: string | null;
  at?: string;
}

interface Model {
  v: 1;
  seeded: boolean;
  chunks: Record<string, LearnerChunk>;
  errors: { tag: ErrorTag; wrong: string; right: string; count: number; last_seen: string }[];
  catchBox: CatchBoxItem[];
  attempts: Attempt[];
  settings: Settings;
}

const DEFAULT_SETTINGS: Settings = {
  subtitles: "street_meaning",
  noise: "light",
  voiceSpeed: 1,
  skipCorridor: false,
  lifeFacts: ["Es de Omán y habla árabe del Golfo.", "Tiene hijos.", "Es madridista.", "Conoce a Toby, el perro de Doña Carmen."],
};

const LS_KEY = "sim-learner-v1";
let model: Model = { v: 1, seeded: false, chunks: {}, errors: [], catchBox: [], attempts: [], settings: { ...DEFAULT_SETTINGS } };
let userDir: string | null = null; // "data/users/<id>"
export let storageMode: "cloud" | "browser" = "browser";

function lsRead(): Model | null {
  try {
    const raw = localStorage.getItem(LS_KEY);
    return raw ? (JSON.parse(raw) as Model) : null;
  } catch {
    return null;
  }
}
function lsWrite() {
  try {
    localStorage.setItem(LS_KEY, JSON.stringify(model));
  } catch {
    /* private window */
  }
}

export async function loadModel() {
  const local = lsRead();
  if (local) model = { ...model, ...local, settings: { ...DEFAULT_SETTINGS, ...local.settings } };
  try {
    const id = caps.db && caps.user ? await caps.user.id() : null;
    if (id) {
      userDir = `data/users/${id}`;
      const snap = await caps.db.collection(userDir).doc("learner").get();
      if (snap.exists) {
        const remote = snap.data() as Model;
        model = { ...model, ...remote, settings: { ...DEFAULT_SETTINGS, ...remote.settings } };
      }
      storageMode = "cloud";
    }
  } catch {
    storageMode = "browser";
  }
}

// One write at a time; coalesce bursts.
let writing: Promise<void> | null = null;
let dirty = false;
export function save() {
  lsWrite();
  if (storageMode !== "cloud" || !userDir) return;
  dirty = true;
  if (writing) return;
  writing = (async () => {
    while (dirty) {
      dirty = false;
      try {
        await caps.db.collection(userDir!).doc("learner").set(JSON.parse(JSON.stringify(model)));
      } catch {
        /* kept in the browser copy; next save retries */
      }
    }
    writing = null;
  })();
}

export const settings = () => model.settings;
export function saveSettings(p: Partial<Settings>) {
  model.settings = { ...model.settings, ...p };
  save();
}

// ---------- chunks ----------
export function learnerChunk(id: string, now = new Date()): LearnerChunk {
  return model.chunks[id] ?? emptyLearnerChunk(id, now);
}
export const allLearnerChunks = () => Object.values(model.chunks);

export function chunkEvent(id: string, ev: ChunkEvent) {
  model.chunks[id] = applyChunkEvent(learnerChunk(id), ev);
  save();
}
export function chunkReview(id: string, outcome: "unaided" | "helped" | "missed", responseMs?: number, now = new Date()) {
  const c = learnerChunk(id, now);
  model.chunks[id] = { ...c, fsrs: review(c.fsrs, ratingFromOutcome(outcome, responseMs), now) };
  save();
}
export function seedKnownChunks(ids: string[], now = new Date()) {
  if (model.seeded) return;
  const yesterday = new Date(now.getTime() - 86_400_000);
  for (const id of ids) {
    const c = applyChunkEvent(emptyLearnerChunk(id, yesterday), { kind: "said_helped" });
    model.chunks[id] = { ...c, fsrs: review(c.fsrs, ratingFromOutcome("helped"), yesterday) };
  }
  model.seeded = true;
  save();
}
export const knownChunkIds = () => allLearnerChunks().filter((c) => ["said_helped", "said_alone", "transferred"].includes(c.state)).map((c) => c.chunk_id);

// ---------- errors ----------
export function recordError(wrong: string, right: string, tag: ErrorTag = "other") {
  const e = model.errors.find((x) => x.wrong === wrong && x.right === right);
  if (e) {
    e.count++;
    e.last_seen = new Date().toISOString();
  } else model.errors.push({ tag, wrong, right, count: 1, last_seen: new Date().toISOString() });
  save();
}
export const errorPatterns = () => [...model.errors].sort((a, b) => b.count - a.count).slice(0, 10);

export function guessErrorTag(wrong: string, right: string): ErrorTag {
  const w = wrong.toLowerCase(), r = right.toLowerCase();
  const ser = /\b(soy|eres|es)\b/, estar = /\b(estoy|estás|está)\b/;
  if (ser.test(w) !== ser.test(r) || estar.test(w) !== estar.test(r)) return "ser_estar";
  if (/\b(dije|fui|conocí|dijo|ha)\b/.test(r)) return "past_retell";
  if (w.split(" ").length === r.split(" ").length) return "person_ending";
  return "other";
}

// ---------- catch box ----------
export function catchAdd(item: { word: string; source_sentence: string; speaker: string; moment: string }) {
  const e = model.catchBox.find((c) => c.word.toLowerCase() === item.word.toLowerCase());
  if (e) {
    e.sightings++;
    e.source_sentence = item.source_sentence;
  } else model.catchBox.unshift({ ...item, anchor: null, sightings: 1, used: false });
  save();
}
export const catchBox = (onlyUnused = false) => model.catchBox.filter((c) => !onlyUnused || !c.used);
export function catchUsed(word: string) {
  const e = model.catchBox.find((c) => c.word === word);
  if (e) e.used = true;
  save();
}

// ---------- attempts + turns ----------
const turnBuffers = new Map<string, TurnLog[]>();

export function startAttempt(episodeId: string, twist: string | null): Attempt {
  const a: Attempt = { id: `a${Date.now().toString(36)}`, episode_id: episodeId, date: new Date().toISOString(), twist, passes_done: [], self_comprehension: null, asked_meaning: 0, freezes: 0, avg_response_ms: null, success_line: null };
  model.attempts.unshift(a);
  model.attempts = model.attempts.slice(0, 200);
  turnBuffers.set(a.id, []);
  save();
  return a;
}
export function updateAttempt(a: Attempt) {
  const i = model.attempts.findIndex((x) => x.id === a.id);
  if (i >= 0) model.attempts[i] = { ...a };
  save();
}
export const attempts = () => model.attempts;

/** Log EVERY turn (raw STT text, latency…); flushed to the private db per attempt. */
export function logTurn(attemptId: string, t: TurnLog) {
  const buf = turnBuffers.get(attemptId) ?? [];
  buf.push({ ...t, at: new Date().toISOString() });
  turnBuffers.set(attemptId, buf);
}
export function avgResponseMs(attemptId: string): number | null {
  const xs = (turnBuffers.get(attemptId) ?? []).filter((t) => t.speaker === "you" && typeof t.response_ms === "number").map((t) => t.response_ms as number);
  return xs.length ? Math.round(xs.reduce((a, b) => a + b, 0) / xs.length) : null;
}
export async function flushTurns(attemptId: string) {
  const turns = turnBuffers.get(attemptId) ?? [];
  if (storageMode !== "cloud" || !userDir || !turns.length) return;
  try {
    await caps.db.collection(userDir).doc(`turns-${attemptId}`).set({ attempt_id: attemptId, turns: JSON.parse(JSON.stringify(turns)) });
  } catch {
    /* best effort */
  }
}

export function streakDays(now = new Date()): number {
  const days = new Set(model.attempts.map((a) => a.date.slice(0, 10)));
  let n = 0;
  const cur = new Date(now);
  if (!days.has(cur.toISOString().slice(0, 10))) cur.setUTCDate(cur.getUTCDate() - 1);
  while (days.has(cur.toISOString().slice(0, 10))) {
    n++;
    cur.setUTCDate(cur.getUTCDate() - 1);
  }
  return n;
}
