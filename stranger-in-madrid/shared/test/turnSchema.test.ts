import { describe, expect, it } from "vitest";
import { lengthGuard, validateTurn } from "../src/turnSchema";
import type { ClaudeTurn } from "../src/types";

export function goodTurn(over: Partial<ClaudeTurn> = {}): ClaudeTurn {
  return {
    lines: [
      { speaker: "paco", es: "¿Qué tal hoy, crack?", street: "ketaloy krak", meaning_ar: "كيف اليوم يا بطل؟", sound_ar: "كِتا**لوي** كْراك", new_chunk_ids: [], sfx: "espresso_machine" },
    ],
    await_learner: true,
    expected_intents: ["tell_day_positive", "tell_day_negative"],
    feedback: { type: "none", wrong: "", right: "", say_again: false },
    choices: [
      { es: "¡Muy bien! Les dije: ¡Venga, chicos!", street: "muibien lesdije bengachikos" },
      { es: "Bien, pero estoy cansao.", street: "bien pero estoikansao" },
      { es: "Pues… a ver… ¡muy bien!", street: "pues aber muibien" },
    ],
    hint: { first_words: "Muy…", full: "¡Muy bien!", street: "muibien" },
    catch_box_add: [],
    events: [],
    debrief: null,
    end_scene: false,
    ...over,
  };
}

describe("validateTurn", () => {
  it("accepts the SPEC example shape", () => {
    const r = validateTurn(goodTurn());
    expect(r.errors).toEqual([]);
    expect(r.ok).toBe(true);
  });

  it("rejects non-objects and missing fields", () => {
    expect(validateTurn(null).ok).toBe(false);
    expect(validateTurn("x").ok).toBe(false);
    const { lines, ...rest } = goodTurn();
    void lines;
    const r = validateTurn(rest);
    expect(r.ok).toBe(false);
    expect(r.errors.join()).toMatch(/lines/);
  });

  it("rejects bad feedback type and empty right on a correction", () => {
    const bad = goodTurn({ feedback: { type: "scold" as never, wrong: "", right: "", say_again: false } });
    expect(validateTurn(bad).ok).toBe(false);
    const empty = goodTurn({ feedback: { type: "correct_now", wrong: "Es muy bien", right: "", say_again: true } });
    expect(validateTurn(empty).errors.join()).toMatch(/feedback.right/);
  });

  it("rejects unexpected keys (UI depends on the exact shape)", () => {
    const r = validateTurn({ ...goodTurn(), mood: "happy" });
    expect(r.ok).toBe(false);
    expect(r.errors[0]).toMatch(/unexpected key "mood"/);
  });

  it("requires 3 choices (never 1 right + 2 wrong; always 3 or none)", () => {
    expect(validateTurn(goodTurn({ choices: [{ es: "Vale", street: "bale" }] })).ok).toBe(false);
    expect(validateTurn(goodTurn({ choices: [] })).ok).toBe(true);
  });

  it("checks line field types", () => {
    const t = goodTurn();
    (t.lines[0] as unknown as Record<string, unknown>).sfx = 5;
    (t.lines[0] as unknown as Record<string, unknown>).new_chunk_ids = "x";
    const r = validateTurn(t);
    expect(r.errors).toEqual(expect.arrayContaining(["lines[0].sfx: must be string or null", "lines[0].new_chunk_ids: must be string[]"]));
  });

  it("limits debrief next_time to 2 items", () => {
    const r = validateTurn(goodTurn({ debrief: { success_line_ar: "قلتها لحالك!", next_time_ar: ["a", "b", "c"] } }));
    expect(r.ok).toBe(false);
  });
});

describe("lengthGuard", () => {
  it("trims to 3 lines", () => {
    const l = goodTurn().lines[0];
    const r = lengthGuard(goodTurn({ lines: [l, l, l, l, l] }));
    expect(r.trimmed).toBe(true);
    expect(r.turn.lines).toHaveLength(3);
  });
  it("flags very long lines", () => {
    const l = { ...goodTurn().lines[0], es: Array(25).fill("vale").join(" ") };
    expect(lengthGuard(goodTurn({ lines: [l] })).tooLong).toEqual([0]);
  });
});
