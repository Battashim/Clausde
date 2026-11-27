// Loads reviewable content (JSON in /content) and the method (docs/METHOD.md). Nothing Spanish is hard-coded here.
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import type { Character, Chunk, Episode, Location, Script } from "@sim/shared";
import { isEarlierEpisode } from "@sim/shared";

const here = dirname(fileURLToPath(import.meta.url));
export const ROOT = resolve(here, "../..");
const CONTENT = join(ROOT, "content");
export const CACHE_DIR = resolve(process.env.CACHE_DIR ?? join(ROOT, "server/cache"));

const readJson = <T>(p: string): T => JSON.parse(readFileSync(p, "utf8")) as T;

export const method = (): string => readFileSync(join(ROOT, "docs/METHOD.md"), "utf8");
export const characters = (): Record<string, Character> => readJson(join(CONTENT, "characters.json"));
export const locations = (): Record<string, Location> => readJson(join(CONTENT, "locations.json"));
export const chunks = (): Chunk[] => readJson(join(CONTENT, "chunks.json"));

const SAFE_ID = /^s\d+e\d+$/;

export function episode(id: string): Episode | null {
  if (!SAFE_ID.test(id)) return null;
  const p = join(CONTENT, "episodes", `${id}.json`);
  return existsSync(p) ? readJson<Episode>(p) : null;
}

/** Default known chunks = chunks introduced in earlier episodes (the app overrides with its learner model). */
export function defaultKnownChunkIds(ep: Episode): string[] {
  return chunks()
    .filter((c) => isEarlierEpisode(c.introduced_in, ep.id))
    .map((c) => c.id);
}

/** Words always allowed: character names + signature words of the characters in the scene. */
export function sceneExtraWords(ep: Episode): string[] {
  const all = characters();
  return [...ep.characters, "you"].flatMap((id) => (all[id] ? [all[id].name, ...(all[id].signature ?? [])] : []));
}

function withCards(s: Script, ep: Episode): Script {
  if (s.cards.length) return s;
  const byId = new Map(chunks().map((c) => [c.id, c]));
  return { ...s, cards: ep.target_chunks.map((id) => byId.get(id)).filter((c): c is Chunk => !!c) };
}

const generatedPath = (id: string) => join(CACHE_DIR, "scripts", `${id}.json`);

/** Cached Claude-generated script if present, else the hand-written seed script. */
export function script(ep: Episode): Script | null {
  const gen = generatedPath(ep.id);
  if (existsSync(gen)) return withCards(readJson<Script>(gen), ep);
  const seed = join(CONTENT, "scripts", `${ep.id}.seed.json`);
  return existsSync(seed) ? withCards(readJson<Script>(seed), ep) : null;
}

export function saveGeneratedScript(s: Script) {
  const p = generatedPath(s.episode_id);
  mkdirSync(dirname(p), { recursive: true });
  writeFileSync(p, JSON.stringify(s, null, 2));
}
