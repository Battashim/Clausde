// Live turn pipeline: prompt → Claude → schema validator → vocabulary/length/safety guards → (regenerate once) → reply.
import {
  buildAllowedSet,
  checkVocabulary,
  fallbackTurn,
  finishTurn,
  guardTurn,
  type ClaudeTurn,
  type GuardResult,
  type LiveTurnRequest,
  type LiveTurnResponse,
} from "@sim/shared";
import * as content from "./content";
import { sessionContext, systemPrompt, transcriptBlock } from "./prompt";
import { BrainRefusal, type LiveCall } from "./claude";

export type BrainCall = (call: LiveCall) => Promise<unknown>;

export { fallbackTurn };

export class BadRequest extends Error {}

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
  let g: GuardResult | null = null;
  let problems: string[] = [];

  for (let attempt = 0; attempt < 2; attempt++) {
    const call: LiveCall = attempt === 0 || raw === undefined ? base : { ...base, retry: { previous: JSON.stringify(raw), problem: problems.join("; ") } };
    if (attempt === 1) regenerated = true;
    try {
      raw = await brain(call);
    } catch (e) {
      problems = [`brain error: ${(e as Error).message}`];
      g = null;
      if (e instanceof BrainRefusal) break;
      continue;
    }
    g = guardTurn(raw, allowed, earlier, !!ep.minors_present);
    problems = g.problems;
    if (!problems.length) break;
  }

  let turn: ClaudeTurn;
  let trimmed = false;
  let vocab = { unknown: [] as string[], bonus: [] as string[] };
  if (!g?.turn || g.fatal) {
    turn = fallbackTurn(speakerFallback);
  } else {
    // Vocabulary still off after one regeneration: keep the turn (the scene must go on) but report the words.
    ({ turn, trimmed } = finishTurn(g.turn));
    vocab = { unknown: g.unknown, bonus: g.bonus };
  }

  return { turn, guard: { regenerated, unknown_words: vocab.unknown, bonus_words: vocab.bonus, trimmed }, latency_ms: Date.now() - t0 };
}
