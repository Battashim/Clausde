// Claude turn schema (SPEC §4) — JSON Schema for structured output + a dependency-free validator.
import type { ClaudeTurn } from "./types";

export const MAX_LINES_PER_TURN = 3;
export const MAX_WORDS_PER_LINE = 18;

const str = { type: "string" } as const;
const strArr = { type: "array", items: str } as const;

const lineSchema = {
  type: "object",
  additionalProperties: false,
  required: ["speaker", "es", "street", "meaning_ar", "sound_ar", "new_chunk_ids", "sfx"],
  properties: {
    speaker: str,
    es: str,
    street: str,
    meaning_ar: str,
    sound_ar: str,
    new_chunk_ids: strArr,
    sfx: { type: ["string", "null"] },
  },
} as const;

/** JSON Schema passed to the API as output_config.format (structured output). */
export const TURN_JSON_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: [
    "lines",
    "await_learner",
    "expected_intents",
    "feedback",
    "choices",
    "hint",
    "catch_box_add",
    "events",
    "debrief",
    "end_scene",
  ],
  properties: {
    lines: { type: "array", items: lineSchema },
    await_learner: { type: "boolean" },
    expected_intents: strArr,
    feedback: {
      type: "object",
      additionalProperties: false,
      required: ["type", "wrong", "right", "say_again"],
      properties: {
        type: { type: "string", enum: ["none", "recast", "correct_now"] },
        wrong: str,
        right: str,
        say_again: { type: "boolean" },
      },
    },
    choices: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["es", "street"],
        properties: { es: str, street: str },
      },
    },
    hint: {
      anyOf: [
        { type: "null" },
        {
          type: "object",
          additionalProperties: false,
          required: ["first_words", "full", "street"],
          properties: { first_words: str, full: str, street: str },
        },
      ],
    },
    catch_box_add: strArr,
    events: strArr,
    debrief: {
      anyOf: [
        { type: "null" },
        {
          type: "object",
          additionalProperties: false,
          required: ["success_line_ar", "next_time_ar"],
          properties: { success_line_ar: str, next_time_ar: strArr },
        },
      ],
    },
    end_scene: { type: "boolean" },
  },
} as const;

export interface ValidationResult<T> {
  ok: boolean;
  errors: string[];
  value: T | null;
}

const isObj = (v: unknown): v is Record<string, unknown> => typeof v === "object" && v !== null && !Array.isArray(v);
const isStr = (v: unknown): v is string => typeof v === "string";
const isStrArr = (v: unknown): v is string[] => Array.isArray(v) && v.every(isStr);

function checkKeys(o: Record<string, unknown>, allowed: string[], path: string, errors: string[]) {
  for (const k of Object.keys(o)) if (!allowed.includes(k)) errors.push(`${path}: unexpected key "${k}"`);
}

/**
 * Validates a parsed Claude turn. Structural errors make it invalid; the length guard
 * (max lines / words) is reported separately by `lengthGuard` so the server can trim instead of failing.
 */
export function validateTurn(input: unknown): ValidationResult<ClaudeTurn> {
  const errors: string[] = [];
  if (!isObj(input)) return { ok: false, errors: ["turn: not an object"], value: null };
  const t = input;
  checkKeys(t, Object.keys(TURN_JSON_SCHEMA.properties), "turn", errors);

  if (!Array.isArray(t.lines)) errors.push("lines: must be an array");
  else
    t.lines.forEach((l, i) => {
      const p = `lines[${i}]`;
      if (!isObj(l)) return errors.push(`${p}: not an object`);
      checkKeys(l, Object.keys(lineSchema.properties), p, errors);
      for (const k of ["speaker", "es", "street", "meaning_ar", "sound_ar"] as const)
        if (!isStr(l[k])) errors.push(`${p}.${k}: must be a string`);
      if (isStr(l.es) && l.es.trim() === "") errors.push(`${p}.es: empty`);
      if (!isStrArr(l.new_chunk_ids)) errors.push(`${p}.new_chunk_ids: must be string[]`);
      if (!(l.sfx === null || isStr(l.sfx))) errors.push(`${p}.sfx: must be string or null`);
    });

  if (typeof t.await_learner !== "boolean") errors.push("await_learner: must be boolean");
  if (!isStrArr(t.expected_intents)) errors.push("expected_intents: must be string[]");

  if (!isObj(t.feedback)) errors.push("feedback: must be an object");
  else {
    const f = t.feedback;
    checkKeys(f, ["type", "wrong", "right", "say_again"], "feedback", errors);
    if (!["none", "recast", "correct_now"].includes(f.type as string)) errors.push("feedback.type: invalid");
    if (!isStr(f.wrong)) errors.push("feedback.wrong: must be a string");
    if (!isStr(f.right)) errors.push("feedback.right: must be a string");
    if (typeof f.say_again !== "boolean") errors.push("feedback.say_again: must be boolean");
    if (f.type !== "none" && isStr(f.right) && f.right.trim() === "")
      errors.push("feedback.right: required when type is not none");
  }

  if (!Array.isArray(t.choices)) errors.push("choices: must be an array");
  else {
    t.choices.forEach((c, i) => {
      if (!isObj(c) || !isStr(c.es) || !isStr(c.street)) errors.push(`choices[${i}]: needs es + street strings`);
      else checkKeys(c, ["es", "street"], `choices[${i}]`, errors);
    });
    if (t.choices.length > 3) errors.push("choices: at most 3");
    if (t.await_learner === true && t.choices.length !== 3 && t.choices.length !== 0)
      errors.push("choices: give exactly 3 (or none)");
  }

  if (t.hint !== null) {
    if (!isObj(t.hint) || !isStr(t.hint.first_words) || !isStr(t.hint.full) || !isStr(t.hint.street))
      errors.push("hint: must be null or {first_words, full, street}");
  }

  if (!isStrArr(t.catch_box_add)) errors.push("catch_box_add: must be string[]");
  if (!isStrArr(t.events)) errors.push("events: must be string[]");

  if (t.debrief !== null) {
    if (!isObj(t.debrief) || !isStr(t.debrief.success_line_ar) || !isStrArr(t.debrief.next_time_ar))
      errors.push("debrief: must be null or {success_line_ar, next_time_ar[]}");
    else if (t.debrief.next_time_ar.length > 2) errors.push("debrief.next_time_ar: max 2 items");
  }

  if (typeof t.end_scene !== "boolean") errors.push("end_scene: must be boolean");

  return errors.length ? { ok: false, errors, value: null } : { ok: true, errors: [], value: t as unknown as ClaudeTurn };
}

/** Length guard: max 2–3 short lines per turn. Returns a trimmed copy and whether trimming happened. */
export function lengthGuard(turn: ClaudeTurn): { turn: ClaudeTurn; trimmed: boolean; tooLong: number[] } {
  const tooLong: number[] = [];
  turn.lines.forEach((l, i) => {
    if (l.es.split(/\s+/).filter(Boolean).length > MAX_WORDS_PER_LINE) tooLong.push(i);
  });
  if (turn.lines.length <= MAX_LINES_PER_TURN) return { turn, trimmed: false, tooLong };
  return { turn: { ...turn, lines: turn.lines.slice(0, MAX_LINES_PER_TURN) }, trimmed: true, tooLong };
}
