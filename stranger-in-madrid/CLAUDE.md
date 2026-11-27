# Stranger in Madrid — build guide for Claude Code

A voice-first app that teaches **conversational street Spanish from Spain (Madrid)** through an
interactive story where the learner is the hero: a coaching student who arrives in Madrid, trains
under a head coach and soon coaches a U15 team. Visual-novel visuals, a different voice for every
character, and real background sound.

The first learner (and design partner) is an Omani Gulf-Arabic speaker who also speaks English.
Every rule in `docs/METHOD.md` comes from weeks of real sessions with him — treat it as the
product's core, not as decoration.

## Read these first
1. `docs/METHOD.md` — the teaching method. It is also the core of the coach's system prompt.
2. `docs/SPEC.md` — product, session flow, data model, Claude turn schema, audio/visual design, MVP.
3. `docs/CONTENT.md` — world bible: characters, voices, locations, episode spine, seed episode.

## Non-negotiables
- **Brain ≠ voice ≠ ears.** Claude (via the Anthropic API) is the brain. Text-to-speech is a separate
  service (one voice per character). Speech-to-text is a separate service **locked to Spanish (es-ES)**.
  Never use an all-in-one voice agent as the brain.
- **Every Claude turn is structured JSON** matching the schema in `docs/SPEC.md` (use tool use /
  structured output). The UI and the learner model depend on it.
- **Vocabulary is controlled.** Scenes are built from the learner's known chunks + at most 3–5 new
  chunks per session. The server passes the allowed list into every prompt and validates output.
- **Street form first.** Every phrase has 4 layers: Spanish as written · meaning (Gulf Arabic + English) ·
  street spelling (letters that are actually pronounced) · sound in Arabic letters (key in METHOD.md).
- **Hold-to-talk** microphone by default (no auto end-of-turn cut-offs).
- **Arabic UI is right-to-left**; Spanish text is left-to-right inside it.
- **Fictional world.** Fictional club, players, coaches. No real song lyrics (original songs only).
  The U15 players are minors: keep every scene wholesome (football, school, family, effort, respect).

## Stack — FREE FIRST (owner's requirement; see the table in SPEC.md §2)
- App: Expo / React Native (iOS + Android), TypeScript. Run on the owner's phone (no store needed).
- Voices: **device TTS** (expo-speech, es-ES voices, per-character voice/pitch/rate) or **Piper TTS**
  (open-source, offline, es_ES) to pre-render lines. Cloud neural voices only as a later upgrade.
- Listening: **device speech recognition forced to es-ES**, or open-source Whisper with `language=es`.
- Ambience + SFX: **CC0-licensed files only**, bundled in the app; mixed on device with ducking.
- Visuals: minimal in the MVP (location card + name tags); illustrated art is a later phase.
- Data: SQLite on device for one learner, or Supabase free tier.
- Brain: Anthropic API (billed — the only unavoidable cost). Keep it low: one cached script call per
  episode for Passes 1–2; live calls only for Pass 3, debrief and catch-box review. Check current
  model IDs in the Anthropic docs; a fast model for live turns, a stronger one for script generation.
- Spaced repetition: FSRS (open-source implementations exist for TS/Python).
- Pronunciation scoring: later, optional.

## Build order
1. **MVP (one episode, end to end)** — see "MVP acceptance" in SPEC.md.
2. Learner model + FSRS scheduling + recall at session start.
3. Pronunciation scoring, response-time measurement, progress notebook + roadmap screen.
4. More episodes (season 1 = 5 episodes), songs, weekly report, season exam.

## Working rules
- Keep secrets (API keys) server-side only. The app talks to your backend, never directly to the LLM.
- Log every turn (raw STT text, confidence, latency, pronunciation score) — it powers the learner model.
- Write tests for the turn-schema validator, the vocabulary guard and the FSRS update.
- Keep Spanish content reviewable: scripts and chunk cards live in the database/JSON, not hard-coded.

## Repository map (MVP)
- `content/` — Spanish content as JSON (reviewable). `shared/` — logic used by app + server (turn schema
  validator, vocabulary guard, FSRS, matching, progress, safety). `server/` — the only Claude caller.
  `app/` — Expo app. See README.md for commands.
- `npm test` must stay green: it covers the turn-schema validator, the vocabulary guard, the FSRS update
  and the content integrity of every episode.
