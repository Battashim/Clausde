// The brain for the web app: Claude through the page's `sample` capability (the viewer's own Claude
// account — no server, no API key). Same coach prompt and guards as the server.
import {
  TURN_JSON_SCHEMA,
  buildAllowedSet,
  buildSessionContext,
  buildSystemPrompt,
  buildTranscript,
  checkVocabulary,
  fallbackTurn,
  finishTurn,
  guardTurn,
  type Character,
  type Chunk,
  type ClaudeTurn,
  type Episode,
  type LiveTurnRequest,
  type Location,
} from "../../shared/src";
import { mockLiveTurn } from "../../server/src/mockBrain";
import METHOD from "../../docs/METHOD.md";
import { caps } from "./platform";

export interface World {
  episode: Episode;
  chunks: Chunk[];
  characters: Record<string, Character>;
  locations: Record<string, Location>;
}

export interface BrainResult {
  turn: ClaudeTurn;
  source: "claude" | "practice";
  regenerated: boolean;
  unknown: string[];
  ms: number;
  error?: string;
}

let system: string | null = null;

function sceneWords(w: World, mode: LiveTurnRequest["mode"]): string[] {
  const ids = mode === "pass3" ? [...w.episode.characters, "you"] : ["paco", "you"];
  return ids.flatMap((id) => (w.characters[id] ? [w.characters[id].name, ...(w.characters[id].signature ?? [])] : []));
}

/** Short, plain error copy for the screen. */
export function errorText(code: string | undefined): string {
  switch (code) {
    case "not_granted":
      return "ما سمحت للصفحة تستخدم Claude. نكمل بوضع التدريب.";
    case "rate_limited":
      return "Claude مشغول شوي. انتظر دقيقة وجرّب.";
    case "cancelled":
      return "";
    default:
      return "ما قدرنا نوصل لـ Claude. نكمل بوضع التدريب.";
  }
}

export async function liveTurn(req: LiveTurnRequest, w: World, signal?: AbortSignal): Promise<BrainResult> {
  const t0 = Date.now();
  const allowed = buildAllowedSet({ chunks: w.chunks, knownChunkIds: req.known_chunk_ids, newChunkIds: req.new_chunk_ids, extraWords: sceneWords(w, req.mode) });
  const earlier = checkVocabulary(req.history.filter((h) => h.speaker !== "you").map((h) => h.text), allowed, 99).bonus;
  system ??= buildSystemPrompt(METHOD, w.characters);
  const context = buildSessionContext(req, w.episode, w.chunks, w.locations[w.episode.location], [...allowed].sort());
  const transcript = buildTranscript(req);
  const speakerFallback = req.mode === "pass3" ? w.episode.characters[0] : "paco";

  // No Claude here (capability absent): play the scripted practice brain through the same guards.
  if (!caps.sample) {
    const raw = await mockLiveTurn({ system: "", context, transcript });
    const g = guardTurn(raw, allowed, earlier, !!w.episode.minors_present);
    return { turn: g.turn ? finishTurn(g.turn).turn : fallbackTurn(speakerFallback), source: "practice", regenerated: false, unknown: g.unknown, ms: Date.now() - t0 };
  }

  const schema = JSON.stringify(TURN_JSON_SCHEMA);
  const prompt = (retry?: { previous: string; problem: string }) =>
    `${system}\n\n${context}\n\n${transcript}\n\nOutput format: reply with ONLY one JSON object (no prose, no code fence) that validates against this JSON Schema:\n${schema}` +
    (retry ? `\n\nYour previous reply was:\n${retry.previous}\n\nIt failed the guard: ${retry.problem}\nRewrite the whole turn as JSON, fixing only that.` : "");

  let raw: unknown;
  let problems: string[] = [];
  let g: ReturnType<typeof guardTurn> | null = null;
  let regenerated = false;
  let error: string | undefined;

  for (let attempt = 0; attempt < 2; attempt++) {
    if (attempt === 1) regenerated = true;
    try {
      raw = await caps.sample.json(prompt(attempt === 0 || raw === undefined ? undefined : { previous: JSON.stringify(raw), problem: problems.join("; ") }), {
        modelTier: "quick",
        cache: false,
        signal,
      });
    } catch (e) {
      const code = (e as { code?: string }).code;
      error = code;
      if (code === "not_granted" || code === "cancelled" || code === "rate_limited") break;
      problems = [`invalid reply (${code ?? "error"})`];
      g = null;
      continue;
    }
    g = guardTurn(raw, allowed, earlier, !!w.episode.minors_present);
    problems = g.problems;
    if (!problems.length) {
      error = undefined;
      break;
    }
  }

  if (!g?.turn || g.fatal) {
    if (error === "not_granted" || error === "rate_limited" || (error && !g)) {
      // Keep the scene going with the practice brain rather than leaving him stuck.
      const mock = guardTurn(await mockLiveTurn({ system: "", context, transcript }), allowed, earlier, !!w.episode.minors_present);
      return { turn: mock.turn ? finishTurn(mock.turn).turn : fallbackTurn(speakerFallback), source: "practice", regenerated, unknown: [], ms: Date.now() - t0, error };
    }
    return { turn: fallbackTurn(speakerFallback), source: "claude", regenerated, unknown: [], ms: Date.now() - t0, error };
  }
  return { turn: finishTurn(g.turn).turn, source: "claude", regenerated, unknown: g.unknown, ms: Date.now() - t0 };
}
