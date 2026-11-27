// Minimal FSRS-5 scheduler (public algorithm, default parameters).
// Rating mapping for this app: missed → Again, helped → Hard, unaided → Good, instant+unaided → Easy.
import type { FsrsCard } from "./types";

export enum Rating {
  Again = 1,
  Hard = 2,
  Good = 3,
  Easy = 4,
}

export const DEFAULT_W = [
  0.40255, 1.18385, 3.173, 15.69105, 7.1949, 0.5345, 1.4604, 0.0046, 1.54575, 0.1192, 1.01925, 1.9395, 0.11, 0.29605,
  2.2698, 0.2315, 2.9898, 0.51655, 0.6621,
];

const DECAY = -0.5;
const FACTOR = 19 / 81; // so that R = 0.9 when t = S
const DAY_MS = 86_400_000;

export interface FsrsOptions {
  w?: number[];
  requestRetention?: number;
  maximumInterval?: number;
}

const clamp = (x: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, x));

export function newCard(now: Date): FsrsCard {
  return { stability: 0, difficulty: 0, due: now.toISOString(), last_review: null, reps: 0, lapses: 0 };
}

export function retrievability(elapsedDays: number, stability: number): number {
  if (stability <= 0) return 0;
  return Math.pow(1 + (FACTOR * elapsedDays) / stability, DECAY);
}

function initDifficulty(w: number[], g: Rating) {
  return clamp(w[4] - Math.exp(w[5] * (g - 1)) + 1, 1, 10);
}

function nextDifficulty(w: number[], d: number, g: Rating) {
  const delta = -w[6] * (g - 3);
  const damped = d + (delta * (10 - d)) / 9;
  const reverted = w[7] * initDifficulty(w, Rating.Easy) + (1 - w[7]) * damped;
  return clamp(reverted, 1, 10);
}

function recallStability(w: number[], d: number, s: number, r: number, g: Rating) {
  const hard = g === Rating.Hard ? w[15] : 1;
  const easy = g === Rating.Easy ? w[16] : 1;
  return s * (1 + Math.exp(w[8]) * (11 - d) * Math.pow(s, -w[9]) * (Math.exp(w[10] * (1 - r)) - 1) * hard * easy);
}

function forgetStability(w: number[], d: number, s: number, r: number) {
  const sf = w[11] * Math.pow(d, -w[12]) * (Math.pow(s + 1, w[13]) - 1) * Math.exp(w[14] * (1 - r));
  return Math.min(sf, s);
}

function shortTermStability(w: number[], s: number, g: Rating) {
  return s * Math.exp(w[17] * (g - 3 + w[18]));
}

export function nextIntervalDays(stability: number, requestRetention = 0.9, maximumInterval = 365): number {
  const raw = (stability / FACTOR) * (Math.pow(requestRetention, 1 / DECAY) - 1);
  return clamp(Math.round(raw), 1, maximumInterval);
}

/** Applies one review and returns the updated card (pure). */
export function review(card: FsrsCard, rating: Rating, now: Date, opts: FsrsOptions = {}): FsrsCard {
  const w = opts.w ?? DEFAULT_W;
  const retention = opts.requestRetention ?? 0.9;
  const maxIvl = opts.maximumInterval ?? 365;

  let s: number;
  let d: number;
  if (card.last_review === null || card.stability <= 0) {
    s = w[rating - 1];
    d = initDifficulty(w, rating);
  } else {
    const elapsed = Math.max(0, (now.getTime() - new Date(card.last_review).getTime()) / DAY_MS);
    d = nextDifficulty(w, card.difficulty, rating);
    if (elapsed < 1) {
      s = shortTermStability(w, card.stability, rating);
    } else {
      const r = retrievability(elapsed, card.stability);
      s = rating === Rating.Again ? forgetStability(w, card.difficulty, card.stability, r) : recallStability(w, card.difficulty, card.stability, r, rating);
    }
  }
  s = Math.max(0.01, s);

  // Again → see it again in this or the next session (10 min); otherwise schedule in whole days.
  const dueMs = rating === Rating.Again ? now.getTime() + 10 * 60_000 : now.getTime() + nextIntervalDays(s, retention, maxIvl) * DAY_MS;

  return {
    stability: s,
    difficulty: d,
    due: new Date(dueMs).toISOString(),
    last_review: now.toISOString(),
    reps: card.reps + 1,
    lapses: card.lapses + (rating === Rating.Again && card.reps > 0 ? 1 : 0),
  };
}

/** Maps how the learner produced a chunk to an FSRS rating. */
export function ratingFromOutcome(outcome: "unaided" | "helped" | "missed", responseMs?: number): Rating {
  if (outcome === "missed") return Rating.Again;
  if (outcome === "helped") return Rating.Hard;
  return responseMs !== undefined && responseMs < 1500 ? Rating.Easy : Rating.Good;
}

/** Picks up to `n` due chunk ids, most overdue first. */
export function pickDue<T extends { chunk_id: string; fsrs: FsrsCard }>(items: T[], now: Date, n = 3): string[] {
  return items
    .filter((i) => i.fsrs.last_review !== null && new Date(i.fsrs.due).getTime() <= now.getTime())
    .sort((a, b) => new Date(a.fsrs.due).getTime() - new Date(b.fsrs.due).getTime())
    .slice(0, n)
    .map((i) => i.chunk_id);
}
