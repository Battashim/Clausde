// Talks to OUR backend only (never to the LLM directly).
import type { Character, Chunk, Episode, LiveTurnRequest, LiveTurnResponse, Location, Script } from "../../shared/src";
import { getSettings, kvGet, kvSet, markSynced, unsyncedTurns } from "./db";

export interface EpisodeBundle {
  episode: Episode;
  location: Location | null;
  characters: Record<string, Character>;
  chunks: Chunk[];
  default_known_chunk_ids: string[];
  script: Script;
}

async function call<T>(path: string, init?: RequestInit, timeoutMs = 20000): Promise<T> {
  const { serverUrl, appToken } = getSettings();
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const res = await fetch(`${serverUrl.replace(/\/$/, "")}${path}`, {
      ...init,
      signal: ctrl.signal,
      headers: { "content-type": "application/json", "x-app-token": appToken, ...(init?.headers ?? {}) },
    });
    if (!res.ok) throw new Error(`${res.status} ${await res.text()}`);
    return (await res.json()) as T;
  } finally {
    clearTimeout(timer);
  }
}

export const health = () => call<{ ok: boolean; brain: string }>("/api/health", undefined, 5000);

/** Fetches the episode bundle and caches it, so Passes 1–2 work offline afterwards. */
export async function loadEpisode(id: string): Promise<{ bundle: EpisodeBundle; offline: boolean }> {
  try {
    const bundle = await call<EpisodeBundle>(`/api/episodes/${id}`);
    kvSet(`bundle:${id}`, bundle);
    return { bundle, offline: false };
  } catch (e) {
    const cached = kvGet<EpisodeBundle>(`bundle:${id}`);
    if (cached) return { bundle: cached, offline: true };
    throw e;
  }
}

export const liveTurn = (req: LiveTurnRequest) => call<LiveTurnResponse>("/api/turn", { method: "POST", body: JSON.stringify(req) }, 30000);

/** Mirrors the local turn log to the server (best effort). */
export async function syncTurns() {
  const turns = unsyncedTurns();
  if (!turns.length) return;
  try {
    await call("/api/log", { method: "POST", body: JSON.stringify({ turns }) });
    markSynced(turns.map((t) => t.id));
  } catch {
    // offline: try again next session
  }
}
