// Live turn pipeline: prompt → Claude → schema validator → vocabulary/length/safety guards → (regenerate once) → reply.
import {
  buildAllowedSet,
  checkSafety,
  checkTurnVocabulary,
  checkVocabulary,
  lengthGuard,
  validateTurn,
  type ClaudeTurn,
  type LiveTurnRequest,
  type LiveTurnResponse,
} from "@sim/shared";
import * as content from "./content";
import { sessionContext, systemPrompt, transcriptBlock } from "./prompt";
import { BrainRefusal, type LiveCall } from "./claude";

export type BrainCall = (call: LiveCall) => Promise<unknown>;

export class BadRequest extends Error {}

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

function validateRequest(req: LiveTurnRequest) {
  if (!req || typeof req !== "object") throw new BadRequest("body must be JSON");
  if (!["pass3", "debrief", "catchbox"].includes(req.mode)) throw new BadRequest("mode must be pass3 | debrief | catchbox");
  if (!Array.isArray(req.history) || req.history.length > 60) throw new BadRequest("history must be an array (≤ 60)");
  if (!Array.isArray(req.known_chunk_ids) || !Array.isArray(req.new_chunk_ids)) throw new BadRequest("chunk id lists required");
  if (req.new_chunk_ids.length > 5) throw new BadRequest("at most 5 new chunks per session");
  req.error_patterns ??= [];
  req.life_facts ??= [];
  req.catch_box ??= [];
  req.twist ??= null;
  req.stt_confidence ??= null;
}

export async function runLiveTurn(req: LiveTurnRequest, brain: BrainCall): Promise<LiveTurnResponse> {
  validateRequest(req);
  const ep = content.episode(req.episode_id);
  if (!ep) throw new BadRequest(`unknown episode ${req.episode_id}`);
  const t0 = Date.now();

  const extra = req.mode === "pass3" ? content.sceneExtraWords(ep) : [...content.sceneExtraWords(ep), "Paco", "crack", "hombre", "anda", "chaval"];
  const allowed = buildAllowedSet({ chunks: content.chunks(), knownChunkIds: req.known_chunk_ids, newChunkIds: req.new_chunk_ids, extraWords: extra });
  // Bonus allowance is per scene: words already tolerated earlier in this pass count against it.
  const earlier = checkVocabulary(req.history.filter((h) => h.speaker !== "you").map((h) => h.text), allowed, 99).bonus;

  const base = { system: systemPrompt(), context: sessionContext(req, ep, [...allowed].sort()), transcript: transcriptBlock(req) };
  const speakerFallback = req.mode === "pass3" ? ep.characters[0] : "paco";

  let regenerated = false;
  let raw: unknown;
  let problems: string[] = [];
  let turn: ClaudeTurn | null = null;
  let vocab = { unknown: [] as string[], bonus: [] as string[] };

  for (let attempt = 0; attempt < 2; attempt++) {
    const call: LiveCall = attempt === 0 || raw === undefined ? base : { ...base, retry: { previous: JSON.stringify(raw), problem: problems.join("; ") } };
    if (attempt === 1) regenerated = true;
    try {
      raw = await brain(call);
    } catch (e) {
      problems = [`brain error: ${(e as Error).message}`];
      if (e instanceof BrainRefusal) break;
      continue;
    }
    const v = validateTurn(raw);
    if (!v.ok || !v.value) {
      problems = v.errors.slice(0, 6);
      turn = null;
      continue;
    }
    turn = v.value;
    problems = [];
    const voc = checkTurnVocabulary(turn, allowed, earlier);
    vocab = { unknown: voc.unknown, bonus: voc.bonus };
    if (!voc.ok) problems.push(`words not in the allowed list: ${voc.unknown.join(", ")} — replace them with allowed words`);
    const safe = checkSafety([...turn.lines.map((l) => l.es), ...turn.choices.map((c) => c.es)], !!ep.minors_present);
    if (!safe.ok) problems.push(`not wholesome for a U15 scene: ${safe.hits.join(", ")}`);
    if (turn.lines.length > 3) problems.push("max 3 lines per turn");
    if (!problems.length) break;
  }

  let trimmed = false;
  if (!turn || problems.some((p) => p.startsWith("not wholesome") || p.startsWith("brain error"))) {
    turn = fallbackTurn(speakerFallback);
    vocab = { unknown: [], bonus: [] };
  } else {
    // Vocabulary still off after one regeneration: keep the turn (the scene must go on) but report the words.
    const lg = lengthGuard(turn);
    turn = lg.turn;
    trimmed = lg.trimmed;
  }

  return { turn, guard: { regenerated, unknown_words: vocab.unknown, bonus_words: vocab.bonus, trimmed }, latency_ms: Date.now() - t0 };
}
