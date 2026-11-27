import { describe, expect, it, vi } from "vitest";
import type { ClaudeTurn, LiveTurnRequest } from "@sim/shared";
import { runLiveTurn } from "../src/turnEngine";
import { mockLiveTurn } from "../src/mockBrain";
import { checkScript } from "../src/scriptGen";
import * as content from "../src/content";
import type { LiveCall } from "../src/claude";

const ep = content.episode("s1e6")!;
const req = (over: Partial<LiveTurnRequest> = {}): LiveTurnRequest => ({
  mode: "pass3",
  episode_id: "s1e6",
  twist: ep.twists_pass3[0],
  history: [],
  learner_utterance: null,
  stt_confidence: null,
  known_chunk_ids: content.defaultKnownChunkIds(ep),
  new_chunk_ids: ep.target_chunks,
  error_patterns: [{ wrong: "Es muy bien", right: "¡Muy bien!", count: 3 }],
  life_facts: ["Tiene hijos", "Es madridista"],
  catch_box: [],
  ...over,
});

const turn = (es: string, over: Partial<ClaudeTurn> = {}): ClaudeTurn => ({
  lines: [{ speaker: "iker", es, street: "x", meaning_ar: "x", sound_ar: "**x**", new_chunk_ids: [], sfx: null }],
  await_learner: true,
  expected_intents: [],
  feedback: { type: "none", wrong: "", right: "", say_again: false },
  choices: [],
  hint: null,
  catch_box_add: [],
  events: [],
  debrief: null,
  end_scene: false,
  ...over,
});

describe("runLiveTurn guards", () => {
  it("passes a clean turn through without regenerating", async () => {
    const brain = vi.fn(async () => turn("Na', míster… estoy cansao."));
    const out = await runLiveTurn(req(), brain);
    expect(brain).toHaveBeenCalledTimes(1);
    expect(out.guard.regenerated).toBe(false);
    expect(out.turn.lines[0].es).toMatch(/cansao/);
  });

  it("regenerates once with a hint naming the unknown words", async () => {
    const calls: LiveCall[] = [];
    const brain = vi.fn(async (c: LiveCall) => {
      calls.push(c);
      return calls.length === 1 ? turn("El lateral izquierdo tiene una lesión muscular grave.") : turn("Na', míster.");
    });
    const out = await runLiveTurn(req(), brain);
    expect(brain).toHaveBeenCalledTimes(2);
    expect(calls[1].retry?.problem).toMatch(/lesion, muscular, grave/);
    expect(out.guard.regenerated).toBe(true);
    expect(out.guard.unknown_words).toEqual([]);
  });

  it("regenerates on schema errors and falls back if still invalid", async () => {
    const brain = vi.fn(async () => ({ lines: "nope" }));
    const out = await runLiveTurn(req(), brain);
    expect(brain).toHaveBeenCalledTimes(2);
    expect(out.turn.events).toContain("fallback");
    expect(out.turn.await_learner).toBe(true);
  });

  it("never lets an unwholesome U15 turn through", async () => {
    const brain = vi.fn(async () => turn("¿Una cerveza, míster?"));
    const out = await runLiveTurn(req(), brain);
    expect(out.turn.events).toContain("fallback");
  });

  it("trims to 3 lines", async () => {
    const t = turn("Vale.");
    t.lines = [t.lines[0], t.lines[0], t.lines[0], t.lines[0]];
    const out = await runLiveTurn(req(), async () => t);
    expect(out.turn.lines).toHaveLength(3);
    expect(out.guard.trimmed).toBe(true);
  });

  it("puts METHOD.md in the cached system prompt and the allowed list in the context", async () => {
    let seen: LiveCall | null = null;
    await runLiveTurn(req({ learner_utterance: "iker que te pasa", stt_confidence: 0.82 }), async (c) => ((seen = c), turn("Vale.")));
    expect(seen!.system).toMatch(/Sound key for Arabic letters/);
    expect(seen!.context).toMatch(/Allowed words/);
    expect(seen!.context).toMatch(/Es muy bien/);
    expect(seen!.transcript).toMatch(/iker que te pasa/);
  });

  it("rejects bad requests", async () => {
    await expect(runLiveTurn(req({ mode: "chat" as never }), async () => turn("Vale."))).rejects.toThrow(/mode/);
    await expect(runLiveTurn(req({ episode_id: "../../etc" }), async () => turn("Vale."))).rejects.toThrow(/unknown episode/);
  });

  it("the mock brain plays a full pass 3 and debrief through the real guards", async () => {
    const r1 = await runLiveTurn(req(), mockLiveTurn);
    expect(r1.guard.unknown_words).toEqual([]);
    expect(r1.turn.choices).toHaveLength(3);
    const r2 = await runLiveTurn(req({ history: r1.turn.lines.map((l) => ({ speaker: l.speaker, text: l.es })), learner_utterance: "Iker, ¿qué te pasa?" }), mockLiveTurn);
    expect(r2.guard.unknown_words).toEqual([]);
    const d = await runLiveTurn(req({ mode: "debrief", twist: null }), mockLiveTurn);
    expect(d.guard.unknown_words).toEqual([]);
    const d2 = await runLiveTurn(req({ mode: "debrief", twist: null, learner_utterance: "le dije tranqui iker" }), mockLiveTurn);
    expect(d2.turn.debrief?.success_line_ar).toBeTruthy();
    expect(d2.turn.end_scene).toBe(true);
  });
});

describe("script check", () => {
  it("accepts the seed script", () => {
    const s = content.script(ep)!;
    expect(s.cards.map((c) => c.id).sort()).toEqual([...ep.target_chunks].sort());
    expect(checkScript(ep, s, content.defaultKnownChunkIds(ep))).toEqual({ ok: true, problems: [] });
  });
  it("flags a missing gloss and an unknown speaker", () => {
    const s = content.script(ep)!;
    const bad = { ...s, lines: [{ ...s.lines[0], speaker: "messi", new_chunk_ids: [] }] };
    const r = checkScript(ep, bad, content.defaultKnownChunkIds(ep));
    expect(r.ok).toBe(false);
    expect(r.problems.join()).toMatch(/unknown speaker messi/);
    expect(r.problems.join()).toMatch(/never glossed/);
  });
});
