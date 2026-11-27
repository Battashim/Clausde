// One Claude call per episode generates the Pass-1 script, corridor and 4-layer cards; the result is cached.
import { buildAllowedSet, checkSafety, checkVocabulary, type Episode, type Script } from "@sim/shared";
import * as content from "./content";
import { systemPrompt } from "./prompt";

const s = { type: "string" } as const;
const sa = { type: "array", items: s } as const;
const step = { type: "object", additionalProperties: false, required: ["es", "street", "sound_ar", "meaning_ar"], properties: { es: s, street: s, sound_ar: s, meaning_ar: s } } as const;

export const SCRIPT_JSON_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["lines", "corridor", "cards"],
  properties: {
    lines: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["speaker", "es", "street", "meaning_ar", "meaning_en", "sound_ar", "new_chunk_ids", "sfx", "accept", "trap"],
        properties: {
          speaker: s, es: s, street: s, meaning_ar: s, meaning_en: s, sound_ar: s,
          new_chunk_ids: sa,
          sfx: { type: ["string", "null"] },
          accept: sa,
          trap: { anyOf: [{ type: "null" }, { type: "object", additionalProperties: false, required: ["wrong", "right"], properties: { wrong: s, right: s } }] },
        },
      },
    },
    corridor: { type: "array", items: { type: "array", items: step } },
    cards: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["id", "es_written", "meaning_ar", "meaning_en", "street_spelling", "sound_ar", "examples", "notes_ar"],
        properties: {
          id: s, es_written: s, meaning_ar: s, meaning_en: s, street_spelling: s, sound_ar: s, notes_ar: s,
          examples: { type: "array", items: { type: "object", additionalProperties: false, required: ["es", "street", "ar"], properties: { es: s, street: s, ar: s } } },
        },
      },
    },
  },
} as const;

export function scriptPrompt(ep: Episode, knownChunkIds: string[]): string {
  const byId = new Map(content.chunks().map((c) => [c.id, c]));
  const fmt = (id: string) => {
    const c = byId.get(id);
    return c ? `${id}: ${c.es_written}${c.forms?.length ? ` (also: ${c.forms.join(", ")})` : ""}` : id;
  };
  const seed = content.script(ep);
  return [
    "Write the cached script for this episode (used for Pass 1 — listen, and Pass 2 — guided).",
    `Episode JSON:\n${JSON.stringify(ep, null, 2)}`,
    `Location sfx ids: ${(content.locations()[ep.location]?.sfx ?? []).join(", ")}`,
    `Today's new chunks:\n${ep.target_chunks.map(fmt).join("\n")}`,
    `Known chunks:\n${knownChunkIds.map(fmt).join("\n")}`,
    "Requirements:",
    "- 10–16 lines following the outline in order. speaker \"you\" = the learner's own lines (he will say them in Pass 2); every other speaker is a character id from the episode.",
    "- Every new chunk is heard at least once in a character's mouth before or right after the learner first needs it; put its id in new_chunk_ids on the line where it first appears.",
    "- Each learner line: accept = 2–3 acceptable shorter/alternative versions. trap: on a character line that repeats a past mistake (from the outline) give {wrong, right}; else null.",
    "- Only words from the known + new chunks and basic function words; at most 2 bonus words in the whole script.",
    "- corridor: for each of the 3–5 mission sentences, 2–5 steps building it piece by piece (Michel Thomas style).",
    "- cards: one 4-layer card per new chunk (id must match), 1–2 examples each, notes_ar a one-line tip or \"\".",
    seed ? `A reviewed example of the expected quality and style (seed script for this episode):\n${JSON.stringify({ lines: seed.lines.slice(0, 6) }, null, 1)}` : "",
  ]
    .filter(Boolean)
    .join("\n\n");
}

export interface ScriptCheck {
  ok: boolean;
  problems: string[];
}

export function checkScript(ep: Episode, script: Pick<Script, "lines" | "cards" | "corridor">, knownChunkIds: string[]): ScriptCheck {
  const problems: string[] = [];
  const speakers = new Set([...ep.characters, "you"]);
  for (const l of script.lines) if (!speakers.has(l.speaker)) problems.push(`unknown speaker ${l.speaker}`);
  const glossed = new Set(script.lines.flatMap((l) => l.new_chunk_ids));
  for (const id of ep.target_chunks) if (!glossed.has(id)) problems.push(`new chunk ${id} never glossed`);
  for (const id of ep.target_chunks) if (!script.cards.some((c) => c.id === id)) problems.push(`missing card ${id}`);
  const allowed = buildAllowedSet({ chunks: content.chunks(), knownChunkIds, newChunkIds: ep.target_chunks, extraWords: content.sceneExtraWords(ep) });
  const voc = checkVocabulary(script.lines.filter((l) => l.speaker !== "you").map((l) => l.es), allowed);
  if (!voc.ok) problems.push(`words outside the allowed set: ${voc.unknown.join(", ")}`);
  const mine = checkVocabulary(script.lines.filter((l) => l.speaker === "you").map((l) => l.es), allowed, 0);
  if (!mine.ok) problems.push(`learner lines use unknown words: ${mine.unknown.join(", ")}`);
  const safe = checkSafety(script.lines.map((l) => l.es), !!ep.minors_present);
  if (!safe.ok) problems.push(`not wholesome: ${safe.hits.join(", ")}`);
  return { ok: problems.length === 0, problems };
}

export type ScriptCall = (system: string, prompt: string, schema: Record<string, unknown>) => Promise<unknown>;

/** Generates, checks (one retry with the problems listed) and caches the script. */
export async function generateScript(ep: Episode, knownChunkIds: string[], call: ScriptCall): Promise<{ script: Script; problems: string[] }> {
  let prompt = scriptPrompt(ep, knownChunkIds);
  let last: { script: Script; problems: string[] } | null = null;
  for (let attempt = 0; attempt < 2; attempt++) {
    const raw = (await call(systemPrompt(), prompt, SCRIPT_JSON_SCHEMA as unknown as Record<string, unknown>)) as Pick<Script, "lines" | "corridor" | "cards">;
    const byId = new Map(content.chunks().map((c) => [c.id, c]));
    const cards = raw.cards.map((c) => ({ ...(byId.get(c.id) ?? {}), ...c })) as Script["cards"];
    const script: Script = { episode_id: ep.id, generated_by: "claude", generated_at: new Date().toISOString(), lines: raw.lines, corridor: raw.corridor, cards };
    const check = checkScript(ep, script, knownChunkIds);
    last = { script, problems: check.problems };
    if (check.ok) break;
    prompt += `\n\nYour previous script failed these checks — fix them:\n- ${check.problems.join("\n- ")}`;
  }
  if (last && last.problems.length === 0) content.saveGeneratedScript(last.script);
  return last!;
}
