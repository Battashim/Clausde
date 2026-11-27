import { describe, expect, it } from "vitest";
import { containsChunk, matchLine, similarity } from "../src/match";
import { applyChunkEvent, emptyLearnerChunk, isEarlierEpisode } from "../src/progress";
import { nextPhase, firstPhase } from "../src/session";
import { checkSafety } from "../src/safety";
import { buildAllowedSet, checkVocabulary } from "../src/vocab";
import type { Character, Chunk, Episode, Script } from "../src/types";
import chunksJson from "../../content/chunks.json";
import charactersJson from "../../content/characters.json";
import episodeJson from "../../content/episodes/s1e6.json";
import scriptJson from "../../content/scripts/s1e6.seed.json";

const chunks = chunksJson as Chunk[];
const episode = episodeJson as Episode;
const script = scriptJson as unknown as Script;
const characters = charactersJson as Record<string, Character>;

describe("matching (tolerant to STT noise)", () => {
  it("accepts small transcription slips and street forms", () => {
    expect(matchLine("iker que te pasa", ["Iker, ¿qué te pasa?"]).pass).toBe(true);
    expect(matchLine("tranqui iker tu juegas maso bien", ["Tranqui, Iker. Tú juegas mazo bien."]).pass).toBe(true);
    expect(similarity("estoy cansao", "Estoy cansado")).toBe(1);
  });
  it("rejects a different sentence", () => {
    expect(matchLine("tengo hambre", ["Iker, ¿qué te pasa?"]).pass).toBe(false);
  });
  it("finds chunks inside a longer utterance", () => {
    expect(containsChunk("vale vale tranqui hombre", "Tranqui")).toBe(true);
    expect(containsChunk("y le dije que te pasa iker", "¿Qué te pasa?")).toBe(true);
    expect(containsChunk("hola buenos dias", "¿Qué te pasa?")).toBe(false);
  });
});

describe("chunk progress", () => {
  const now = new Date("2026-11-01T10:00:00Z");
  it("goes heard → said_helped → said_alone → transferred (other day + other episode)", () => {
    let c = emptyLearnerChunk("tranqui", now);
    c = applyChunkEvent(c, { kind: "heard" });
    expect(c.state).toBe("heard");
    c = applyChunkEvent(c, { kind: "said_helped" });
    expect(c.state).toBe("said_helped");
    c = applyChunkEvent(c, { kind: "said_alone", day: "2026-11-01", episodeId: "s1e6" });
    expect(c.state).toBe("said_alone");
    c = applyChunkEvent(c, { kind: "said_alone", day: "2026-11-01", episodeId: "s1e7" });
    expect(c.state).toBe("said_alone"); // same day ≠ transfer
    c = applyChunkEvent(c, { kind: "said_alone", day: "2026-11-03", episodeId: "s1e6" });
    expect(c.state).toBe("said_alone"); // same situation ≠ transfer
    c = applyChunkEvent(c, { kind: "said_alone", day: "2026-11-03", episodeId: "s1e7" });
    expect(c.state).toBe("transferred");
    c = applyChunkEvent(c, { kind: "heard" });
    expect(c.state).toBe("transferred"); // never goes back down
  });
});

describe("session flow", () => {
  it("follows SPEC §3 and can skip corridor", () => {
    const o = { skipCorridor: false, hasRecall: true };
    expect(firstPhase(o)).toBe("RECALL");
    expect(nextPhase("RECALL", o)).toBe("CORRIDOR");
    expect(nextPhase("RECALL", { ...o, skipCorridor: true })).toBe("PASS1_LISTEN");
    expect(nextPhase("PASS3_SOLO_TWIST", o)).toBe("DEBRIEF");
    expect(firstPhase({ skipCorridor: true, hasRecall: false })).toBe("PASS1_LISTEN");
  });
});

describe("safety guard", () => {
  it("blocks adult topics with minors present", () => {
    expect(checkSafety(["¿Una cerveza, míster?"], true).ok).toBe(false);
    expect(checkSafety(["¿Una cerveza?"], false).ok).toBe(true);
    expect(checkSafety(["¡Qué caño, Iker!"], true).ok).toBe(true);
  });
});

describe("content integrity (seed episode s1e6)", () => {
  const ids = new Set(chunks.map((c) => c.id));
  it("chunk ids are unique and every chunk has all 4 layers", () => {
    expect(ids.size).toBe(chunks.length);
    for (const c of chunks) {
      expect(c.es_written, c.id).toBeTruthy();
      expect(c.meaning_ar, c.id).toBeTruthy();
      expect(c.meaning_en, c.id).toBeTruthy();
      expect(c.street_spelling, c.id).toBeTruthy();
      expect(c.sound_ar, c.id).toMatch(/\*\*.+\*\*/); // stressed syllable marked
    }
  });
  it("episode references existing chunks and characters; 3–5 new chunks", () => {
    for (const id of [...episode.target_chunks, ...episode.known_chunks_required]) expect(ids.has(id), id).toBe(true);
    for (const ch of episode.characters) expect(characters[ch], ch).toBeDefined();
    expect(episode.target_chunks.length).toBeGreaterThanOrEqual(3);
    expect(episode.target_chunks.length).toBeLessThanOrEqual(5);
  });
  it("every script line has 4 layers and a known speaker", () => {
    for (const l of script.lines) {
      expect(l.speaker === "you" || characters[l.speaker] !== undefined, l.speaker).toBe(true);
      for (const k of ["es", "street", "meaning_ar", "sound_ar"] as const) expect(l[k], `${l.es} ${k}`).toBeTruthy();
      for (const id of l.new_chunk_ids) expect(episode.target_chunks).toContain(id);
    }
  });
  it("every target chunk is glossed in the script", () => {
    const glossed = new Set(script.lines.flatMap((l) => l.new_chunk_ids));
    for (const id of episode.target_chunks) expect(glossed.has(id), id).toBe(true);
  });
  it("the seed script passes the vocabulary guard (≤ 2 bonus words)", () => {
    const known = chunks.filter((c) => isEarlierEpisode(c.introduced_in, "s1e6")).map((c) => c.id);
    const extra = Object.values(characters).flatMap((c) => [c.name, ...(c.signature ?? [])]);
    const allowed = buildAllowedSet({ chunks, knownChunkIds: known, newChunkIds: episode.target_chunks, extraWords: extra });
    const r = checkVocabulary(script.lines.filter((l) => l.speaker !== "you").map((l) => l.es), allowed);
    expect(r.unknown).toEqual([]);
    const mine = checkVocabulary(script.lines.filter((l) => l.speaker === "you").map((l) => l.es), allowed, 0);
    expect(mine.unknown).toEqual([]);
  });
});
