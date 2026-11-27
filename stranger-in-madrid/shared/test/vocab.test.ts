import { describe, expect, it } from "vitest";
import { buildAllowedSet, checkTurnVocabulary, checkVocabulary, normalizeWord, tokenize } from "../src/vocab";
import type { Chunk, ClaudeTurn } from "../src/types";
import chunksJson from "../../content/chunks.json";

const chunks = chunksJson as Chunk[];
const known = chunks.filter((c) => c.introduced_in !== "s1e6").map((c) => c.id);
const today = ["siete_contra_siete", "que_te_pasa", "tranqui", "en_serio", "al_campo"];
const allowed = buildAllowedSet({ chunks, knownChunkIds: known, newChunkIds: today, extraWords: ["Iker", "Dani", "Sergio", "Álvaro"] });

describe("normalize / tokenize", () => {
  it("strips accents, punctuation and maps street forms", () => {
    expect(normalizeWord("¡Muévete!")).toBe("muevete");
    expect(normalizeWord("cansao")).toBe("cansado");
    expect(normalizeWord("Na',")).toBe("nada");
    expect(tokenize("¿Qué te pasa, tío?")).toEqual(["que", "te", "pasa", "tio"]);
  });
});

describe("checkVocabulary", () => {
  it("passes lines built from known + new chunks", () => {
    const r = checkVocabulary(["Iker, ¿qué te pasa?", "Tranqui. Tú juegas mazo bien.", "¡Venga, al campo!"], allowed);
    expect(r).toEqual({ ok: true, unknown: [], bonus: [] });
  });

  it("tolerates up to 2 bonus words per scene", () => {
    const r = checkVocabulary(["¡Qué caño, Iker!", "Muy bien, crack."], allowed);
    expect(r.ok).toBe(true);
    expect(r.bonus.sort()).toEqual(["cano", "crack"]);
  });

  it("fails beyond the bonus allowance", () => {
    const r = checkVocabulary(["El delantero centro tiene una lesión muscular."], allowed);
    expect(r.ok).toBe(false);
    expect(r.unknown.length).toBeGreaterThan(0);
  });

  it("keeps the allowance per scene via alreadyUsedBonus", () => {
    const r = checkVocabulary(["¡Qué golazo!"], allowed, 2, ["cano", "crack"]);
    expect(r.ok).toBe(false);
    expect(r.unknown).toEqual(["golazo"]);
    const again = checkVocabulary(["¡Qué caño!"], allowed, 2, ["cano", "crack"]);
    expect(again.ok).toBe(true);
  });

  it("does not let a chunk outside the known/new lists in", () => {
    const narrow = buildAllowedSet({ chunks, knownChunkIds: [], newChunkIds: [] });
    expect(checkVocabulary(["Tengo ganas de jugar, mazo, tranqui."], narrow).ok).toBe(false);
  });
});

describe("checkTurnVocabulary", () => {
  const base: ClaudeTurn = {
    lines: [{ speaker: "iker", es: "Na', míster… estoy cansao.", street: "", meaning_ar: "", sound_ar: "", new_chunk_ids: [], sfx: null }],
    await_learner: true,
    expected_intents: [],
    feedback: { type: "none", wrong: "", right: "", say_again: false },
    choices: [
      { es: "Tranqui, Iker.", street: "" },
      { es: "¿En serio?", street: "" },
      { es: "¡Venga, al campo!", street: "" },
    ],
    hint: { first_words: "Tranqui…", full: "Tranqui, Iker.", street: "" },
    catch_box_add: [],
    events: [],
    debrief: null,
    end_scene: false,
  };
  it("passes a clean turn", () => expect(checkTurnVocabulary(base, allowed).ok).toBe(true));
  it("gives choices no bonus allowance (the learner must be able to say them)", () => {
    const t = { ...base, choices: [...base.choices.slice(0, 2), { es: "¡Qué golazo!", street: "" }] };
    expect(checkTurnVocabulary(t, allowed)).toMatchObject({ ok: false, unknown: ["golazo"] });
  });
  it("never guards the learner's own lines", () => {
    const t = { ...base, lines: [...base.lines, { ...base.lines[0], speaker: "you", es: "Supercalifragilístico" }] };
    expect(checkTurnVocabulary(t, allowed).ok).toBe(true);
  });
});
