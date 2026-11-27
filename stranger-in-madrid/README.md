# Stranger in Madrid

A voice-first app that teaches Madrid street Spanish through an interactive story. Read `CLAUDE.md`
and `docs/` (METHOD, SPEC, CONTENT) first. This repo holds the **MVP**: episode s1e6 «El partido de
Sergio», played end to end.

## Layout

| Path | What |
|---|---|
| `docs/` | METHOD (also the core of the coach's system prompt), SPEC, CONTENT |
| `content/` | Reviewable Spanish content as JSON: characters, locations, chunk cards, episodes, seed scripts |
| `shared/` | TypeScript used by the app and the server: turn schema + validator, vocabulary guard, FSRS, fuzzy STT matching, chunk progress, session state machine, safety guard |
| `server/` | Express backend: the only thing that talks to Claude (the API key lives here) |
| `app/` | Expo / React Native app (Arabic RTL shell, Spanish LTR content) |
| `tools/genSounds.mjs` | Builds the bundled ambience + SFX (synthesized here, CC0) |

## How the pieces fit

- **Brain**: Claude through `server/`. Every live turn uses structured output (`output_config.format`
  with the SPEC §4 JSON schema), then goes through the validator, the **vocabulary guard** (known + new
  chunks + function words, max 2 bonus words per scene), a length guard (≤ 3 lines) and a U15 **safety
  guard**. A failed turn is regenerated once with the problem named, and if it still fails the scene
  continues with a safe fallback line.
  - Live turns (Pass 3, debrief, catch box) use `claude-haiku-5-5`, the fast model, at low effort.
  - The Pass 1–2 script is made by `claude-opus-5-5` **once per episode**, checked, and cached in
    `server/cache/`. Server-side refusal fallbacks (`fallbacks: "default"`) are on for that call.
  - The method sits in a byte-stable system prompt with `cache_control`, so it is prompt-cached.
  - Models are set with `LIVE_MODEL` / `SCRIPT_MODEL`.
- **Voices**: device TTS (`expo-speech`), es-ES, with one fixed voice, pitch and rate per character
  (`content/characters.json`).
- **Ears**: device speech recognition (`expo-speech-recognition`) **locked to es-ES**. You hold the
  button to talk, so there is no automatic cut-off. Response time is measured from the moment the
  character hands you the floor.
- **Sound**: an ambience loop per location, plus SFX from each line's `sfx` field. The ambience ducks
  about 12 dB under speech. A noise dial (off / light / real) controls how loud it is.
- **Learner model**: SQLite on the phone, following the SPEC §6 tables. FSRS-5 schedules the recall at
  session start. Every turn is logged (raw STT text, confidence, response time) and mirrored to
  `server/data/turns.jsonl`.

## Just use it (no install)

The web edition is a single page hosted on claude.ai: https://claude.ai/artifact/YJHyJ51gwcvXonYjSGApoh
It plays the same episode with the same content, prompt and guards. Claude runs on the viewer's own
claude.ai account, so it needs no server and no API key. Voices come from the browser's es-ES speech,
the microphone uses claude.ai dictation in Spanish, the sound is synthesized in the page, and progress
is saved in the artifact's private per-person store. Rebuild it with `npm run build:web`, which writes
`web/dist/stranger-in-madrid.html`.

## Run it

```bash
npm install                 # root: shared + server
npm test                    # validator, vocab guard, FSRS, matching, content integrity, guard pipeline
cp server/.env.example server/.env   # put ANTHROPIC_API_KEY and an APP_TOKEN in it
npm run server              # real Claude
npm run server:mock         # or: scripted turns, no API spend
```

App (on your own phone, no store needed). Speech recognition is a native module, so use a
**development build**. Expo Go will not work.

```bash
cd app && npm install
cp .env.example .env        # EXPO_PUBLIC_SERVER_URL = http://<your computer's LAN IP>:8787, same APP_TOKEN
npx expo run:android        # or: npx expo run:ios  (or build once with EAS and install)
```

You can also change the server address and token in the app under **الإعدادات**. The first time, the
app downloads the episode bundle and caches it, so Passes 1–2 then work offline. Pass 3 and the
debrief need the server.

Optional: generate a fresh Claude script for Passes 1–2 (one billed call, cached until you delete it):

```bash
npm --workspace server run gen-script -- s1e6
```

Review the cached JSON before you use it. Until a generated script exists, the hand-written seed script
`content/scripts/s1e6.seed.json` is served.

## MVP acceptance status (SPEC §9)

| Item | Status |
|---|---|
| s1e6 plays all 3 passes + debrief | Built. Not yet run on a real phone |
| ≥ 4 distinct character voices, consistent | Per-character voice/pitch/rate. How distinct they sound depends on the es-ES voices on the device |
| Pitch ambience + whistle + ball + «¡Uuuh!» with ducking | Built. The sounds are synthesized placeholders, so swap in CC0 recordings with the same file names |
| Hold-to-talk STT forced to es-ES, transcript shown, response time | Built |
| Pass 1–2 from cached script, Pass 3 live with the validated schema | Built. Covered by tests with a fake brain and with the mock brain |
| Hint, Choices, Rewind, catch word | Built. Choices also open by themselves after a stall of about 3.5 s. The catch word works as a button. To say it aloud, set it to a Spanish word, because the recognizer only listens for Spanish |
| 4-layer chunk cards, RTL/LTR | Built |
| Session saved (attempt, turns, chunk states, catch box) | Built |

## Content rules

All people and clubs are fictional. The U15 players are minors, so scenes stay wholesome. The app
uses no real song lyrics. Spanish content lives in `content/` so it can be reviewed, and
`npm test` checks it: every chunk has all 4 layers, every target chunk is glossed, and the seed script
passes the vocabulary guard.
