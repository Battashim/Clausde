// Server side of the coach prompt: loads METHOD.md + content and delegates to the shared builders.
import { buildSessionContext, buildSystemPrompt, buildTranscript, type Episode, type LiveTurnRequest } from "@sim/shared";
import * as content from "./content";

let cachedSystem: string | null = null;

export function systemPrompt(): string {
  return (cachedSystem ??= buildSystemPrompt(content.method(), content.characters()));
}

export function sessionContext(req: LiveTurnRequest, ep: Episode, allowedWords: string[]): string {
  return buildSessionContext(req, ep, content.chunks(), content.locations()[ep.location], allowedWords);
}

export const transcriptBlock = buildTranscript;
