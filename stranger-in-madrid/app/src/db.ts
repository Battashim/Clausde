// On-device learner model (SPEC §6) in SQLite — one learner, works offline.
import * as SQLite from "expo-sqlite";
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
import { DEFAULT_APP_TOKEN, DEFAULT_LIFE_FACTS, DEFAULT_SERVER_URL } from "./config";

const db = SQLite.openDatabaseSync("stranger-in-madrid.db");

db.execSync(`
PRAGMA journal_mode = WAL;
CREATE TABLE IF NOT EXISTS kv (key TEXT PRIMARY KEY, value TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS learner_chunks (
  chunk_id TEXT PRIMARY KEY, state TEXT NOT NULL, stability REAL, difficulty REAL, due TEXT, last_review TEXT,
  reps INTEGER, lapses INTEGER, sightings INTEGER, last_error TEXT, first_alone_day TEXT, first_alone_episode TEXT);
CREATE TABLE IF NOT EXISTS error_patterns (
  tag TEXT NOT NULL, wrong TEXT NOT NULL, right TEXT NOT NULL, count INTEGER NOT NULL, last_seen TEXT NOT NULL,
  PRIMARY KEY (wrong, right));
CREATE TABLE IF NOT EXISTS attempts (
  id INTEGER PRIMARY KEY AUTOINCREMENT, episode_id TEXT NOT NULL, date TEXT NOT NULL, passes_done TEXT NOT NULL,
  self_comprehension INTEGER, asked_meaning INTEGER DEFAULT 0, freezes INTEGER DEFAULT 0, avg_response_ms INTEGER,
  success_line TEXT, twist TEXT);
CREATE TABLE IF NOT EXISTS turns (
  id INTEGER PRIMARY KEY AUTOINCREMENT, attempt_id INTEGER, pass TEXT NOT NULL, speaker TEXT NOT NULL, text TEXT NOT NULL,
  stt_raw TEXT, stt_confidence REAL, response_ms INTEGER, pron_score REAL, feedback TEXT, at TEXT NOT NULL, synced INTEGER DEFAULT 0);
CREATE TABLE IF NOT EXISTS catch_box (
  word TEXT PRIMARY KEY, source_sentence TEXT NOT NULL, speaker TEXT NOT NULL, moment TEXT NOT NULL,
  anchor TEXT, sightings INTEGER NOT NULL DEFAULT 1, used INTEGER NOT NULL DEFAULT 0);
`);

// ---------- settings ----------
export type NoiseDial = "off" | "light" | "real";
export type SubtitleMode = "off" | "street" | "street_meaning";

export interface Settings {
  serverUrl: string;
  appToken: string;
  catchWord: string;
  noise: NoiseDial;
  subtitles: SubtitleMode;
  voiceSpeed: number;
  skipCorridor: boolean;
  lifeFacts: string[];
}

const DEFAULT_SETTINGS: Settings = {
  serverUrl: DEFAULT_SERVER_URL,
  appToken: DEFAULT_APP_TOKEN,
  catchWord: "سؤال",
  noise: "light",
  subtitles: "street_meaning",
  voiceSpeed: 1,
  skipCorridor: false,
  lifeFacts: DEFAULT_LIFE_FACTS,
};

export function kvGet<T>(key: string): T | null {
  const row = db.getFirstSync<{ value: string }>("SELECT value FROM kv WHERE key = ?", key);
  return row ? (JSON.parse(row.value) as T) : null;
}
export function kvSet(key: string, value: unknown) {
  db.runSync("INSERT INTO kv (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value", key, JSON.stringify(value));
}

export const getSettings = (): Settings => ({ ...DEFAULT_SETTINGS, ...(kvGet<Partial<Settings>>("settings") ?? {}) });
export const saveSettings = (patch: Partial<Settings>) => kvSet("settings", { ...getSettings(), ...patch });

// ---------- learner chunks ----------
type LcRow = {
  chunk_id: string; state: LearnerChunk["state"]; stability: number; difficulty: number; due: string; last_review: string | null;
  reps: number; lapses: number; sightings: number; last_error: string | null; first_alone_day: string | null; first_alone_episode: string | null;
};
const fromRow = (r: LcRow): LearnerChunk => ({
  chunk_id: r.chunk_id, state: r.state, sightings: r.sightings, last_error: r.last_error,
  first_alone_day: r.first_alone_day, first_alone_episode: r.first_alone_episode,
  fsrs: { stability: r.stability, difficulty: r.difficulty, due: r.due, last_review: r.last_review, reps: r.reps, lapses: r.lapses },
});

export function allLearnerChunks(): LearnerChunk[] {
  return db.getAllSync<LcRow>("SELECT * FROM learner_chunks").map(fromRow);
}

export function getLearnerChunk(id: string, now = new Date()): LearnerChunk {
  const r = db.getFirstSync<LcRow>("SELECT * FROM learner_chunks WHERE chunk_id = ?", id);
  return r ? fromRow(r) : emptyLearnerChunk(id, now);
}

function putLearnerChunk(c: LearnerChunk) {
  db.runSync(
    `INSERT OR REPLACE INTO learner_chunks VALUES (?,?,?,?,?,?,?,?,?,?,?,?)`,
    c.chunk_id, c.state, c.fsrs.stability, c.fsrs.difficulty, c.fsrs.due, c.fsrs.last_review, c.fsrs.reps, c.fsrs.lapses,
    c.sightings, c.last_error, c.first_alone_day, c.first_alone_episode,
  );
}

export function chunkEvent(id: string, ev: ChunkEvent) {
  putLearnerChunk(applyChunkEvent(getLearnerChunk(id), ev));
}

/** FSRS update after the learner produced (or failed to produce) a chunk. */
export function chunkReview(id: string, outcome: "unaided" | "helped" | "missed", responseMs?: number, now = new Date()) {
  const c = getLearnerChunk(id, now);
  putLearnerChunk({ ...c, fsrs: review(c.fsrs, ratingFromOutcome(outcome, responseMs), now) });
}

/**
 * Seeds the learner model the first time: chunks of earlier episodes count as already said once
 * (so FSRS can schedule them for recall). The real history then takes over.
 */
export function seedKnownChunks(ids: string[], now = new Date()) {
  if (kvGet<boolean>("seeded")) return;
  const yesterday = new Date(now.getTime() - 86_400_000);
  for (const id of ids) {
    const c = applyChunkEvent(emptyLearnerChunk(id, yesterday), { kind: "said_helped" });
    putLearnerChunk({ ...c, fsrs: review(c.fsrs, ratingFromOutcome("helped"), yesterday) });
  }
  kvSet("seeded", true);
}

/** Known = anything the learner has at least said with help. */
export function knownChunkIds(): string[] {
  return db
    .getAllSync<{ chunk_id: string }>("SELECT chunk_id FROM learner_chunks WHERE state IN ('said_helped','said_alone','transferred')")
    .map((r) => r.chunk_id);
}

// ---------- error patterns ----------
export function recordError(wrong: string, right: string, tag: ErrorTag = "other") {
  db.runSync(
    `INSERT INTO error_patterns (tag, wrong, right, count, last_seen) VALUES (?,?,?,1,?)
     ON CONFLICT(wrong, right) DO UPDATE SET count = count + 1, last_seen = excluded.last_seen`,
    tag, wrong, right, new Date().toISOString(),
  );
}
export function errorPatterns(): { tag: string; wrong: string; right: string; count: number }[] {
  return db.getAllSync("SELECT tag, wrong, right, count FROM error_patterns ORDER BY count DESC, last_seen DESC LIMIT 10");
}

/** Rough tag for a correction, so the notebook can group traps. */
export function guessErrorTag(wrong: string, right: string): ErrorTag {
  const w = wrong.toLowerCase(), r = right.toLowerCase();
  if (/\b(soy|eres|es)\b/.test(w) !== /\b(soy|eres|es)\b/.test(r) || /\b(estoy|estás|está)\b/.test(w) !== /\b(estoy|estás|está)\b/.test(r)) return "ser_estar";
  if (/\b(dije|fui|conocí|dijo|ha)\b/.test(r)) return "past_retell";
  if (/\b(el|la|un|una)\b/.test(w) && /\b(el|la|un|una)\b/.test(r) && w.replace(/\b(el|la|un|una)\b/g, "") === r.replace(/\b(el|la|un|una)\b/g, "")) return "gender";
  if (w.split(" ").length === r.split(" ").length) return "person_ending";
  return "other";
}

// ---------- attempts + turns ----------
export function startAttempt(episodeId: string, twist: string | null): number {
  return db.runSync("INSERT INTO attempts (episode_id, date, passes_done, twist) VALUES (?,?,?,?)", episodeId, new Date().toISOString(), "[]", twist).lastInsertRowId;
}

export function updateAttempt(id: number, patch: { passes_done?: string[]; self_comprehension?: number; asked_meaning?: number; freezes?: number; avg_response_ms?: number | null; success_line?: string | null }) {
  const cur = db.getFirstSync<Record<string, unknown>>("SELECT * FROM attempts WHERE id = ?", id);
  if (!cur) return;
  db.runSync(
    "UPDATE attempts SET passes_done=?, self_comprehension=?, asked_meaning=?, freezes=?, avg_response_ms=?, success_line=? WHERE id=?",
    patch.passes_done ? JSON.stringify(patch.passes_done) : (cur.passes_done as string),
    (patch.self_comprehension ?? cur.self_comprehension) as number | null,
    (patch.asked_meaning ?? cur.asked_meaning) as number,
    (patch.freezes ?? cur.freezes) as number,
    (patch.avg_response_ms !== undefined ? patch.avg_response_ms : cur.avg_response_ms) as number | null,
    (patch.success_line !== undefined ? patch.success_line : cur.success_line) as string | null,
    id,
  );
}

export interface TurnLog {
  attempt_id: number;
  pass: string;
  speaker: string;
  text: string;
  stt_raw?: string | null;
  stt_confidence?: number | null;
  response_ms?: number | null;
  pron_score?: number | null;
  feedback?: string | null;
}

/** Log EVERY turn (raw STT, confidence, latency, pronunciation score) — it powers the learner model. */
export function logTurn(t: TurnLog) {
  db.runSync(
    "INSERT INTO turns (attempt_id, pass, speaker, text, stt_raw, stt_confidence, response_ms, pron_score, feedback, at) VALUES (?,?,?,?,?,?,?,?,?,?)",
    t.attempt_id, t.pass, t.speaker, t.text, t.stt_raw ?? null, t.stt_confidence ?? null, t.response_ms ?? null, t.pron_score ?? null, t.feedback ?? null, new Date().toISOString(),
  );
}

export function unsyncedTurns(): (TurnLog & { id: number; at: string })[] {
  return db.getAllSync("SELECT * FROM turns WHERE synced = 0 ORDER BY id LIMIT 500");
}
export function markSynced(ids: number[]) {
  if (!ids.length) return;
  db.runSync(`UPDATE turns SET synced = 1 WHERE id IN (${ids.map(() => "?").join(",")})`, ...ids);
}

export function avgResponseMs(attemptId: number): number | null {
  const r = db.getFirstSync<{ avg: number | null }>("SELECT AVG(response_ms) AS avg FROM turns WHERE attempt_id = ? AND speaker = 'you' AND response_ms IS NOT NULL", attemptId);
  return r?.avg != null ? Math.round(r.avg) : null;
}

export function attempts(): { id: number; episode_id: string; date: string; self_comprehension: number | null; success_line: string | null; freezes: number; avg_response_ms: number | null }[] {
  return db.getAllSync("SELECT id, episode_id, date, self_comprehension, success_line, freezes, avg_response_ms FROM attempts ORDER BY id DESC LIMIT 50");
}

/** Consecutive days (ending today or yesterday) with at least one session. */
export function streakDays(now = new Date()): number {
  const days = new Set(db.getAllSync<{ d: string }>("SELECT DISTINCT substr(date,1,10) AS d FROM attempts").map((r) => r.d));
  let n = 0;
  const cur = new Date(now);
  if (!days.has(cur.toISOString().slice(0, 10))) cur.setUTCDate(cur.getUTCDate() - 1);
  while (days.has(cur.toISOString().slice(0, 10))) {
    n++;
    cur.setUTCDate(cur.getUTCDate() - 1);
  }
  return n;
}

// ---------- catch box ----------
export function catchAdd(item: Omit<CatchBoxItem, "sightings" | "used" | "anchor"> & { anchor?: string | null }) {
  db.runSync(
    `INSERT INTO catch_box (word, source_sentence, speaker, moment, anchor) VALUES (?,?,?,?,?)
     ON CONFLICT(word) DO UPDATE SET sightings = sightings + 1, source_sentence = excluded.source_sentence`,
    item.word, item.source_sentence, item.speaker, item.moment, item.anchor ?? null,
  );
}
export function catchBox(onlyUnused = false): CatchBoxItem[] {
  return db
    .getAllSync<Omit<CatchBoxItem, "used"> & { used: number }>(`SELECT * FROM catch_box ${onlyUnused ? "WHERE used = 0" : ""} ORDER BY rowid DESC`)
    .map((r) => ({ ...r, used: !!r.used }));
}
export function catchUsed(word: string, anchor: string | null) {
  db.runSync("UPDATE catch_box SET used = 1, anchor = COALESCE(?, anchor) WHERE word = ?", anchor, word);
}
