// Fuzzy matching of STT transcripts against expected lines (Pass 2, recall).
// Transcription noise is not the learner's mistake, so the match is deliberately tolerant.
import { tokenize } from "./vocab";

/** Folds sounds that es-ES STT often confuses or that street speech drops. */
function phoneticFold(word: string): string {
  return word
    .replace(/^h/, "")
    .replace(/v/g, "b")
    .replace(/ll/g, "y")
    .replace(/qu/g, "k")
    .replace(/c([aou])/g, "k$1")
    .replace(/z/g, "s")
    .replace(/c([ei])/g, "s$1")
    .replace(/ado$/, "ao")
    .replace(/s$/, "");
}

export function foldText(text: string): string[] {
  return tokenize(text).map(phoneticFold).filter(Boolean);
}

export function levenshtein(a: string, b: string): number {
  if (a === b) return 0;
  const m = a.length;
  const n = b.length;
  if (!m) return n;
  if (!n) return m;
  let prev = Array.from({ length: n + 1 }, (_, j) => j);
  for (let i = 1; i <= m; i++) {
    const cur = [i];
    for (let j = 1; j <= n; j++) cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
    prev = cur;
  }
  return prev[n];
}

/** Similarity 0..1 between a transcript and an expected line (joined-letters comparison, like street spelling). */
export function similarity(transcript: string, expected: string): number {
  const a = foldText(transcript).join("");
  const b = foldText(expected).join("");
  if (!a.length && !b.length) return 1;
  return 1 - levenshtein(a, b) / Math.max(a.length, b.length);
}

export interface LineMatch {
  score: number;
  best: string;
  pass: boolean;
}

/** Best match among accepted alternatives. Threshold 0.6 tolerates STT noise and street forms. */
export function matchLine(transcript: string, accepted: string[], threshold = 0.6): LineMatch {
  let best = accepted[0] ?? "";
  let score = 0;
  for (const a of accepted) {
    const s = similarity(transcript, a);
    if (s > score) {
      score = s;
      best = a;
    }
  }
  return { score, best, pass: score >= threshold };
}

/** Does the transcript contain the chunk (as a contiguous run of folded words, allowing one small slip)? */
export function containsChunk(transcript: string, chunkText: string): boolean {
  const t = foldText(transcript);
  const c = foldText(chunkText);
  if (!c.length) return false;
  const target = c.join("");
  for (let i = 0; i + c.length <= t.length; i++) {
    const window = t.slice(i, i + c.length).join("");
    const dist = levenshtein(window, target);
    if (dist <= Math.floor(target.length / 6)) return true;
  }
  return false;
}
