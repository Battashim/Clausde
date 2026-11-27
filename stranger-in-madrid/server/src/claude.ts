// The brain. Claude via the official SDK, structured output (output_config.format) so every turn is JSON.
// Live turns: fast model. Script generation: stronger model, once per episode, cached on disk.
import Anthropic from "@anthropic-ai/sdk";
import { TURN_JSON_SCHEMA } from "@sim/shared";

export const LIVE_MODEL = process.env.LIVE_MODEL ?? "claude-haiku-5-5";
export const SCRIPT_MODEL = process.env.SCRIPT_MODEL ?? "claude-opus-5-5";

let client: Anthropic | null = null;
const getClient = () => (client ??= new Anthropic());

export class BrainRefusal extends Error {}

export interface LiveCall {
  system: string;
  context: string;
  transcript: string;
  /** Present on the single regeneration attempt after a guard failure. */
  retry?: { previous: string; problem: string };
}

/** One live turn. Returns the raw parsed JSON (validated by the caller). */
export async function liveTurn(call: LiveCall): Promise<unknown> {
  const messages: Anthropic.MessageParam[] = [
    {
      role: "user",
      content: [
        // Session context changes per learner/episode but not per turn: cache it as a second breakpoint.
        { type: "text", text: call.context, cache_control: { type: "ephemeral" } },
        { type: "text", text: call.transcript },
      ],
    },
  ];
  if (call.retry) {
    messages.push({ role: "assistant", content: call.retry.previous });
    messages.push({ role: "user", content: `That turn failed the server guard: ${call.retry.problem}\nRewrite the whole turn as JSON, fixing only that.` });
  }

  const response = await getClient().messages.create({
    model: LIVE_MODEL,
    max_tokens: 4000,
    system: [{ type: "text", text: call.system, cache_control: { type: "ephemeral" } }],
    messages,
    output_config: { effort: "low", format: { type: "json_schema", schema: TURN_JSON_SCHEMA as unknown as Record<string, unknown> } },
  });

  if (response.stop_reason === "refusal") throw new BrainRefusal(response.stop_details?.explanation ?? "refused");
  if (response.stop_reason === "max_tokens") throw new Error("live turn hit max_tokens");
  const text = response.content.flatMap((b) => (b.type === "text" ? [b.text] : [])).join("");
  return JSON.parse(text);
}

/**
 * Script generation (Pass 1–2), streamed because the output is long. Uses the stronger model with
 * server-side refusal fallbacks enabled ("default" routes by refusal category).
 */
export async function generateScriptJson(system: string, prompt: string, schema: Record<string, unknown>): Promise<unknown> {
  const stream = getClient().beta.messages.stream({
    model: SCRIPT_MODEL,
    max_tokens: 64000,
    betas: ["server-side-fallback-2026-07-01"],
    fallbacks: "default",
    system: [{ type: "text", text: system, cache_control: { type: "ephemeral" } }],
    messages: [{ role: "user", content: prompt }],
    output_config: { effort: "high", format: { type: "json_schema", schema } },
  });
  const message = await stream.finalMessage();
  if (message.stop_reason === "refusal") throw new BrainRefusal("script generation refused");
  if (message.stop_reason === "max_tokens") throw new Error("script generation hit max_tokens");
  const text = message.content.flatMap((b) => (b.type === "text" ? [b.text] : [])).join("");
  return JSON.parse(text);
}
