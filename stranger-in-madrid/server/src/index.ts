// Backend: the only place that talks to Claude and holds the API key. The app never calls the LLM directly.
import express, { type NextFunction, type Request, type Response } from "express";
import { appendFileSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import type { LiveTurnRequest } from "@sim/shared";
import * as content from "./content";
import { BrainRefusal, LIVE_MODEL, SCRIPT_MODEL, generateScriptJson, liveTurn } from "./claude";
import { mockLiveTurn } from "./mockBrain";
import { BadRequest, runLiveTurn } from "./turnEngine";
import { generateScript } from "./scriptGen";

const MOCK = process.env.BRAIN === "mock";
const APP_TOKEN = process.env.APP_TOKEN ?? "";
const PORT = Number(process.env.PORT ?? 8787);
const DATA_DIR = process.env.DATA_DIR ?? join(content.ROOT, "server/data");
mkdirSync(DATA_DIR, { recursive: true });

const log = (file: string, entry: unknown) => appendFileSync(join(DATA_DIR, file), JSON.stringify({ at: new Date().toISOString(), ...(entry as object) }) + "\n");

export const app = express();
app.use(express.json({ limit: "256kb" }));

// A shared token keeps strangers from spending the owner's API credit through this server.
app.use("/api", (req: Request, res: Response, next: NextFunction) => {
  if (req.path === "/health" || !APP_TOKEN || req.get("x-app-token") === APP_TOKEN) return next();
  res.status(401).json({ error: "bad app token" });
});

app.get("/api/health", (_req, res) => {
  res.json({ ok: true, brain: MOCK ? "mock" : "claude", live_model: LIVE_MODEL, script_model: SCRIPT_MODEL });
});

/** Everything the app needs to play an episode offline (Passes 1–2 never call the LLM). */
app.get("/api/episodes/:id", (req, res) => {
  const ep = content.episode(req.params.id);
  if (!ep) return void res.status(404).json({ error: "unknown episode" });
  const chars = content.characters();
  res.json({
    episode: ep,
    location: content.locations()[ep.location] ?? null,
    characters: Object.fromEntries([...ep.characters, "you", "paco"].map((id) => [id, chars[id]])),
    chunks: content.chunks(),
    default_known_chunk_ids: content.defaultKnownChunkIds(ep),
    script: content.script(ep),
  });
});

/** Generate (once) and cache the Pass 1–2 script with the stronger model. */
app.post("/api/episodes/:id/script", async (req, res, next) => {
  try {
    const ep = content.episode(req.params.id);
    if (!ep) return void res.status(404).json({ error: "unknown episode" });
    if (MOCK) return void res.status(400).json({ error: "script generation needs BRAIN=claude" });
    const known: string[] = Array.isArray(req.body?.known_chunk_ids) ? req.body.known_chunk_ids : content.defaultKnownChunkIds(ep);
    const t0 = Date.now();
    const out = await generateScript(ep, known, generateScriptJson);
    log("scripts.jsonl", { episode_id: ep.id, ok: out.problems.length === 0, problems: out.problems, ms: Date.now() - t0 });
    res.status(out.problems.length ? 422 : 200).json(out);
  } catch (e) {
    next(e);
  }
});

/** Live turn: Pass 3, debrief, catch-box review. */
app.post("/api/turn", async (req, res, next) => {
  try {
    const body = req.body as LiveTurnRequest;
    const out = await runLiveTurn(body, MOCK ? mockLiveTurn : liveTurn);
    log("turns.jsonl", {
      source: "server",
      mode: body.mode,
      episode_id: body.episode_id,
      learner_utterance: body.learner_utterance,
      stt_confidence: body.stt_confidence,
      latency_ms: out.latency_ms,
      guard: out.guard,
      turn: out.turn,
    });
    res.json(out);
  } catch (e) {
    next(e);
  }
});

/** The app mirrors its own turn log here (raw STT text, confidence, response time…). */
app.post("/api/log", (req, res) => {
  const turns = Array.isArray(req.body?.turns) ? req.body.turns.slice(0, 500) : [];
  for (const t of turns) log("turns.jsonl", { source: "app", ...t });
  res.json({ ok: true, n: turns.length });
});

app.use((err: unknown, _req: Request, res: Response, _next: NextFunction) => {
  if (err instanceof BadRequest) return void res.status(400).json({ error: err.message });
  if (err instanceof BrainRefusal) return void res.status(422).json({ error: "refused", detail: err.message });
  console.error(err);
  res.status(500).json({ error: "server error" });
});

if (process.env.NODE_ENV !== "test") {
  app.listen(PORT, "0.0.0.0", () => console.log(`stranger-in-madrid server on :${PORT} (brain: ${MOCK ? "mock" : `claude live=${LIVE_MODEL} script=${SCRIPT_MODEL}`})`));
}
