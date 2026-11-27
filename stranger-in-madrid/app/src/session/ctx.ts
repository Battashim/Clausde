// Session context shared by all phases.
import { containsChunk, type Character, type Chunk } from "../../../shared/src";
import type { EpisodeBundle } from "../api";
import { chunkEvent, chunkReview, logTurn, type Settings } from "../db";
import { todayKey } from "../../../shared/src";

export interface SessionCtx {
  bundle: EpisodeBundle;
  attemptId: number;
  settings: Settings;
  chars: Record<string, Character>;
  chunkById: Map<string, Chunk>;
  newIds: string[];
  knownIds: string[];
  twist: string;
  stats: { freezes: number; askedMeaning: number; passes: string[]; successLine: string | null; unaidedChunks: Set<string> };
  /** One FSRS review per chunk per session. */
  reviewed: Set<string>;
}

const clean = (t: string) => t.replace(/…/g, "").trim();

/**
 * Credits every known/new chunk found in what he said: said_alone (unaided) or said_helped,
 * plus one FSRS review per chunk per session. Returns the chunk ids found.
 */
export function creditChunks(ctx: SessionCtx, transcript: string, aided: boolean, responseMs?: number | null): string[] {
  const found: string[] = [];
  for (const id of [...ctx.newIds, ...ctx.knownIds]) {
    const c = ctx.chunkById.get(id);
    if (!c) continue;
    const forms = [clean(c.es_written), ...c.examples.map((e) => clean(e.es))];
    if (!forms.some((f) => f.split(/\s+/).length <= 4 && containsChunk(transcript, f)) && !containsChunk(transcript, clean(c.es_written))) continue;
    found.push(id);
    if (aided) chunkEvent(id, { kind: "said_helped" });
    else {
      chunkEvent(id, { kind: "said_alone", day: todayKey(new Date()), episodeId: ctx.bundle.episode.id });
      ctx.stats.unaidedChunks.add(id);
    }
    if (!ctx.reviewed.has(id)) {
      chunkReview(id, aided ? "helped" : "unaided", responseMs ?? undefined);
      ctx.reviewed.add(id);
    }
  }
  return found;
}

export function logCharacterLine(ctx: SessionCtx, pass: string, speaker: string, text: string) {
  logTurn({ attempt_id: ctx.attemptId, pass, speaker, text });
}
