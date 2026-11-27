// One pass of the server-side guards over a raw Claude turn: schema → vocabulary → safety → length.
// Used by the server and by the web app, which both regenerate once when `problems` is non-empty.
import { checkSafety } from "./safety";
import { lengthGuard, validateTurn } from "./turnSchema";
import type { ClaudeTurn } from "./types";
import { checkTurnVocabulary } from "./vocab";

export interface GuardResult {
  turn: ClaudeTurn | null;
  problems: string[];
  /** Safety or schema failure: never show this turn, even after a retry. */
  fatal: boolean;
  unknown: string[];
  bonus: string[];
}

export function guardTurn(raw: unknown, allowed: Set<string>, earlierBonus: string[], minorsPresent: boolean): GuardResult {
  const v = validateTurn(raw);
  if (!v.ok || !v.value) return { turn: null, problems: v.errors.slice(0, 6), fatal: true, unknown: [], bonus: [] };
  const turn = v.value;
  const problems: string[] = [];
  const voc = checkTurnVocabulary(turn, allowed, earlierBonus);
  if (!voc.ok) problems.push(`words not in the allowed list: ${voc.unknown.join(", ")} — replace them with allowed words`);
  const safe = checkSafety([...turn.lines.map((l) => l.es), ...turn.choices.map((c) => c.es)], minorsPresent);
  if (!safe.ok) problems.push(`not wholesome for a U15 scene: ${safe.hits.join(", ")}`);
  if (turn.lines.length > 3) problems.push("max 3 lines per turn");
  return { turn, problems, fatal: !safe.ok, unknown: voc.unknown, bonus: voc.bonus };
}

/** Safe turn used when Claude fails twice: keeps the scene alive without inventing content. */
export function fallbackTurn(speaker: string): ClaudeTurn {
  return {
    lines: [{ speaker, es: "Un momento… ¿Me lo repites?", street: "unmomento melorrepites", meaning_ar: "لحظة… تعيدها لي؟", sound_ar: "اُنْمُ**مِن**تُ… مِلُرِّ**پي**تِس", new_chunk_ids: [], sfx: null }],
    await_learner: true,
    expected_intents: ["repeat"],
    feedback: { type: "none", wrong: "", right: "", say_again: false },
    choices: [],
    hint: null,
    catch_box_add: [],
    events: ["fallback"],
    debrief: null,
    end_scene: false,
  };
}

/** Final shaping of an accepted turn (trim to 3 lines). */
export function finishTurn(turn: ClaudeTurn): { turn: ClaudeTurn; trimmed: boolean } {
  const lg = lengthGuard(turn);
  return { turn: lg.turn, trimmed: lg.trimmed };
}
