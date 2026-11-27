// Chunk state progression (SPEC §6 "Progress rules").
import type { ChunkState, LearnerChunk } from "./types";
import { newCard } from "./fsrs";

const ORDER: ChunkState[] = ["unseen", "heard", "said_helped", "said_alone", "transferred"];
const rank = (s: ChunkState) => ORDER.indexOf(s);
const maxState = (a: ChunkState, b: ChunkState) => (rank(a) >= rank(b) ? a : b);

export function emptyLearnerChunk(chunkId: string, now: Date): LearnerChunk {
  return {
    chunk_id: chunkId,
    state: "unseen",
    fsrs: newCard(now),
    sightings: 0,
    last_error: null,
    first_alone_day: null,
    first_alone_episode: null,
  };
}

export type ChunkEvent =
  | { kind: "heard" }
  | { kind: "said_helped" }
  | { kind: "said_alone"; day: string; episodeId: string }
  | { kind: "error"; text: string };

/**
 * - heard: played/heard in a scene.
 * - said_helped: said with a line card / hint.
 * - said_alone: unaided use in a session.
 * - transferred: unaided use on ANOTHER day in a NEW situation (different episode).
 */
export function applyChunkEvent(lc: LearnerChunk, ev: ChunkEvent): LearnerChunk {
  switch (ev.kind) {
    case "heard":
      return { ...lc, state: maxState(lc.state, "heard"), sightings: lc.sightings + 1 };
    case "said_helped":
      return { ...lc, state: maxState(lc.state, "said_helped") };
    case "said_alone": {
      if (lc.first_alone_day === null)
        return { ...lc, state: maxState(lc.state, "said_alone"), first_alone_day: ev.day, first_alone_episode: ev.episodeId };
      const isTransfer = ev.day !== lc.first_alone_day && ev.episodeId !== lc.first_alone_episode;
      return { ...lc, state: maxState(lc.state, isTransfer ? "transferred" : "said_alone") };
    }
    case "error":
      return { ...lc, last_error: ev.text };
  }
}

export function todayKey(d: Date): string {
  return d.toISOString().slice(0, 10);
}

/** Orders episode ids like "s1e6" < "s1e10" < "s2e1". */
export function episodeOrder(id: string): number {
  const m = /^s(\d+)e(\d+)$/.exec(id);
  return m ? Number(m[1]) * 1000 + Number(m[2]) : Number.MAX_SAFE_INTEGER;
}

/** Chunks introduced before this episode count as known by default (until the learner model says otherwise). */
export function isEarlierEpisode(a: string, b: string): boolean {
  return episodeOrder(a) < episodeOrder(b);
}
