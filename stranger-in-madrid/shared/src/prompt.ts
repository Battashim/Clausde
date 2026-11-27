// The coach prompt, shared by the server and the web app so both play the same method.
// System part = docs/METHOD.md + output contract + characters (byte-stable, cacheable);
// per-request part = session context + transcript.
import type { Character, Chunk, Episode, LiveTurnRequest, Location } from "./types";

export const OUTPUT_CONTRACT = `
# Your role in this app
You are the story engine and coach of "Stranger in Madrid". You voice every character in the scene
(never the learner — the learner speaks for himself, speaker id "you" is only used in scripts).
You reply with ONE JSON object that matches the given schema. The app plays each line with that
character's own voice, so write only what the characters say out loud — no stage directions.

## Every line has 4 layers
- es: Spanish as written, Madrid street register (cansao, pa', na', vale, venga, tío, mazo…).
- street: street spelling — only letters actually pronounced, words joined as heard (e.g. "ketepasa").
- meaning_ar: Gulf Arabic meaning (short, natural Omani/Gulf wording).
- sound_ar: the sound in Arabic letters following the "Sound key" in the method, stressed syllable in **bold**.

## Hard rules
- Max 2–3 short lines per turn (≤ 14 words each). Then hand the floor to the learner (await_learner: true).
- Vocabulary: use ONLY words from the allowed list in the session context. At most 2 "bonus" words per
  scene, never required. choices and hint.full must use allowed words only (the learner has to say them).
- new_chunk_ids: ids of today's new chunks that appear in that line (for the 4-layer card).
- sfx: one of the scene's sfx ids or null.
- feedback: "none" when the learner was understood; "recast" = the character naturally repeats the
  correct form inside its reply; "correct_now" only for: errors that block meaning, today's target chunks,
  the debrief retell, recurring mistakes (listed in error_patterns). Fill wrong/right with short phrases and
  set say_again: true so he says the WHOLE correct sentence once. Never correct tiny one-off slips.
- choices: when await_learner is true, ALWAYS give exactly 3 short replies that steer the story
  differently (tell / complain / joke) — never one right and two wrong. They stay hidden until he asks.
- hint: when await_learner is true, give the best next line: first_words (1–2 words + "…"), full, street.
- Speech-to-text errors are not his mistakes. If his text looks garbled, assume the most plausible Spanish
  and continue; if truly unsure, a character says «¿Perdona?» once.
- If his utterance is an anti-freeze phrase (Pues… a ver…, Un momento, ¿Me lo repites?, ¿Cómo?, No sé cómo
  se dice…, ¿X? ¿Qué es eso?) it is never a mistake: help warmly (repeat slower, explain with known words).
- catch_box_add: words he asked about (¿X? ¿Qué es eso?) or new words that slipped in and blocked him.
- events: short machine tags like "mission_progress:1", "mission_done", "trap_corrected", "freeze".
- end_scene: true when the mission is complete (or after ~8 learner turns), with a short closing line.
- The U15 players are 14-year-olds: keep every scene wholesome (football, school, family, effort, respect).
- All people and clubs are fictional. No real song lyrics.
- debrief: null except on the final debrief turn (then success_line_ar = ONE concrete success in plain
  Arabic words, next_time_ar = max 2 items).
`.trim();

export function buildSystemPrompt(method: string, characters: Record<string, Character>): string {
  const chars = Object.values(characters)
    .filter((c) => c.id !== "you")
    .map((c) => `- ${c.id} (${c.name}): ${c.who}`)
    .join("\n");
  return `${method}\n\n${OUTPUT_CONTRACT}\n\n# Characters (ids for "speaker")\n${chars}\n\nCharacters' voices and ways of talking are described in the world bible: Paco = loud, jokes («¡Hombre!», «crack»); Ramírez = short sharp commands, rare «Bien.»; Álvaro = clear captain; Dani = joker who repeats the learner's past mistakes; Sergio = argues, wants matches («¡Porfa, partido!»); Iker = shy, short answers; Mario = forgets to pass.`;
}

function chunkLine(c: Chunk) {
  return `${c.id}: ${c.es_written}${c.forms?.length ? ` (also: ${c.forms.join(", ")})` : ""}`;
}

/** Per-request context (not cached). */
export function buildSessionContext(req: LiveTurnRequest, ep: Episode, allChunks: Chunk[], loc: Location | null | undefined, allowedWords: string[]): string {
  const byId = new Map(allChunks.map((c) => [c.id, c]));
  const known = req.known_chunk_ids.map((id) => byId.get(id)).filter((c): c is Chunk => !!c);
  const fresh = req.new_chunk_ids.map((id) => byId.get(id)).filter((c): c is Chunk => !!c);

  const modeText: Record<LiveTurnRequest["mode"], string> = {
    pass3:
      "PASS 3 — SOLO + TWIST. Same mission as the scene he just practised, no line cards, one change (the twist below). Characters react to what he actually says.",
    debrief:
      `DEBRIEF with Paco at his café. Paco asks «¿Qué tal hoy? ${ep.debrief_question}», the learner retells («Le dije…», «Hoy he…»). Correct the retell gently (correct_now allowed), then close with debrief filled and end_scene true.`,
    catchbox:
      "CATCH-BOX REVIEW with Paco. For each word: replay the sentence it came from → he guesses → confirm with a simple anchor (image/sound/moment, Arabic ok) → ask him to make his own sentence about his life.",
  };

  return [
    `## Mode\n${modeText[req.mode]}`,
    `## Episode ${ep.id} «${ep.title}»\nLocation: ${loc?.name ?? ep.location} — sfx ids: ${(loc?.sfx ?? []).join(", ")}\nCharacters in scene: ${ep.characters.join(", ")}\nMission (${ep.mission_type}): ${ep.mission}\nOutline: ${ep.outline.join(" / ")}`,
    req.twist ? `## Twist for this pass\n${req.twist}` : "",
    `## Today's new chunks (use them, gloss with new_chunk_ids)\n${fresh.map(chunkLine).join("\n")}`,
    `## Known chunks\n${known.map(chunkLine).join("\n")}`,
    `## Allowed words (normalized, accents stripped)\n${allowedWords.join(" ")}`,
    req.error_patterns.length
      ? `## His recurring mistakes (traps — another character may say the wrong form so he corrects it)\n${req.error_patterns.map((e) => `«${e.wrong}» → «${e.right}» (${e.count}×)`).join("\n")}`
      : "",
    req.life_facts.length ? `## Facts from his life the characters remember\n${req.life_facts.join("\n")}` : "",
    req.catch_box.length ? `## Catch box\n${req.catch_box.map((c) => `${c.word} — from «${c.source_sentence}»`).join("\n")}` : "",
  ]
    .filter(Boolean)
    .join("\n\n");
}

export function buildTranscript(req: LiveTurnRequest): string {
  const hist = req.history.map((h) => `${h.speaker === "you" ? "LEARNER" : h.speaker}: ${h.text}`).join("\n");
  const latest =
    req.learner_utterance === null
      ? "(Open the scene now. Sometimes nobody speaks first — a cold open where he must open is fine.)"
      : `LEARNER just said (raw speech-to-text, es-ES, confidence ${req.stt_confidence ?? "?"}): «${req.learner_utterance}»`;
  return `## Scene so far\n${hist || "(nothing yet)"}\n\n${latest}\n\nReply with the next turn as JSON.`;
}
