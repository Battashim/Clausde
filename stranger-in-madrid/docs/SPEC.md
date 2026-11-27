# Product spec

## 1. What the app is
A voice-first, story-driven Spanish trainer. Each session (~20 min) is one scene of a continuing
story in Madrid, played in 3 passes (listen → guided → solo with a twist), with character voices,
background ambience and sound effects. The app keeps a learner model and builds every scene from
what the learner already knows plus a few new chunks.

## 2. Free-first approach (owner's requirement)
Everything should run at zero or near-zero cost. Priority order: **voices + sound effects** first,
visuals second (simple and optional at first).

| Need | Free option (default) | Upgrade later (paid / free tier) |
|---|---|---|
| Character voices | **Device TTS** (iOS / Android built-in es-ES voices, via expo-speech) — free, offline. Assign a different voice + pitch + rate per character. **Or Piper TTS** (open-source, offline, es_ES voices) to pre-render lines on your own machine/server. | Cloud neural voices (e.g. Azure Neural es-ES free tier, ElevenLabs) for more natural voices |
| Listening to the learner (STT) | **Device speech recognition with locale forced to es-ES** (iOS Speech framework / Android SpeechRecognizer). Free. Forcing es-ES stops Spanish being written in Arabic letters. **Or Whisper** (open-source) with `language=es` on your own machine. | Cloud STT with confidence + word timings |
| Ambience + SFX | **CC0 sound libraries only** (e.g. Freesound filtered to CC0, Pixabay sound effects — check each licence). Store files in the app. | Commission or generate custom sounds |
| Visuals | **Phase 1: none or minimal** — a location card (name + one illustration or icon), character name tags with colour and emoji-free initials. | Phase 2: illustrated backgrounds + character portraits with 3–4 expressions (visual-novel style), made once and stored as assets |
| Pronunciation scoring | Skip in MVP | A pronunciation-assessment API for es-ES |
| Database / auth | Supabase free tier, or local SQLite on device for a single user | Supabase paid |
| App tooling | Expo (free), run on your own phone via Expo Go / dev build | App store accounts (paid) if publishing |
| **The brain (Claude)** | **Not free** — Anthropic API usage is billed. Keep it cheap: Passes 1–2 use a **pre-generated script** (one Claude call per episode, cached); only Pass 3, the debrief and the catch-box review call Claude live. | — |

## 3. Session flow (state machine)
```
RECALL → CORRIDOR (optional) → PASS1_LISTEN → PASS2_GUIDED → PASS3_SOLO_TWIST → DEBRIEF → SAVE
```
- **RECALL:** pick 2–3 due chunks (FSRS). A character asks a question that needs them. Score unaided / helped / missed.
- **CORRIDOR:** coach builds the mission sentences piece by piece (pre-generated, short). Skippable.
- **PASS1_LISTEN:** play the cached script: every line, including the learner's, each with its character
  voice; ambience + SFX on. New chunks show a 4-layer card the first time. Tap any line to replay;
  long-press for **sound zoom** (natural → pieces → natural).
- **PASS2_GUIDED:** characters speak; at learner turns, show the line card (street spelling + Arabic
  sound); learner holds the mic and says it. Fuzzy-match the transcript to the expected line
  (tolerate transcription noise). Light correction only.
- **PASS3_SOLO_TWIST:** live Claude turns with one twist from the episode's twist pool. No line cards.
  Buttons: **Hint · Choices · Rewind · سؤال (catch)**.
- **DEBRIEF:** Paco asks «¿Qué tal hoy? ¿Qué les dijiste?»; learner retells; catch-box review
  (guess → confirm → own sentence); one success line; self-rated comprehension (50/70/90).
- **SAVE:** update learner model, FSRS, error patterns, stats.

## 4. Claude turn schema (live turns, Pass 3 and debrief)
Use tool use / structured output and validate every response.
```json
{
  "lines": [
    {
      "speaker": "paco",
      "es": "¿Qué tal hoy, crack?",
      "street": "ketaloy krak",
      "meaning_ar": "كيف اليوم يا بطل؟",
      "sound_ar": "كِتا**لوي** كْراك",
      "new_chunk_ids": [],
      "sfx": "espresso_machine"
    }
  ],
  "await_learner": true,
  "expected_intents": ["tell_day_positive", "tell_day_negative"],
  "feedback": {
    "type": "none | recast | correct_now",
    "wrong": "Es muy bien",
    "right": "¡Muy bien!",
    "say_again": true
  },
  "choices": [
    { "es": "¡Muy bien! Les dije: ¡Venga, chicos!", "street": "muibien lesdije bengachikos" }
  ],
  "catch_box_add": ["callado"],
  "events": ["mission_progress:1"],
  "end_scene": false
}
```
Server-side guards:
- **Vocabulary guard:** every word in `es` must be in the allowed set (known chunks + today's new
  chunks + function words + bonus allowance ≤ 2 per scene). If not, regenerate once with a hint.
- **Length guard:** max 2–3 short lines per turn.
- **Safety guard:** U15 scenes stay wholesome.

## 5. Script generation (one Claude call per episode, cached)
Input: episode JSON (CONTENT.md), learner state, allowed chunks. Output: the full Pass-1 script
(ordered lines with speaker, es, street, meaning_ar, sound_ar, sfx cues, which lines are the
learner's), the corridor build-up steps, and the 4-layer cards for the new chunks. Store it; render
TTS for every line once and cache the audio.

## 6. Learner model (database)
- `chunks` — id, es_written, street_spelling, sound_ar, meaning_ar, meaning_en, frequency_band, examples, audio.
- `learner_chunks` — chunk_id, state (`unseen | heard | said_helped | said_alone | transferred`),
  FSRS fields (stability, difficulty, due), sightings, last_error.
- `error_patterns` — tag (`person_ending`, `ser_estar`, `gender`, `soundalike`, `past_retell`), wrong, right, count, last_seen.
- `episodes` — id, season, n, title, outline, location, characters, mission, target_chunks, twists.
- `attempts` — episode_id, date, passes done, self_comprehension, asked_meaning, freezes, avg_response_ms, success_line.
- `turns` — attempt_id, pass, speaker, text, stt_raw, stt_confidence, response_ms, feedback.
- `catch_box` — word, source_sentence, speaker, moment, anchor, sightings, used.
- `settings` — catch word (default «سؤال»), noise dial, subtitle mode (off / street / street+meaning), voice speed.

**Progress rules:** a chunk becomes `said_alone` after unaided use in a session; `transferred` after
unaided use on another day in a new situation. Show "real progress" = transfers, not raw counts.

## 7. Audio design
- Each character: fixed voice + rate + pitch (see CONTENT.md). Keep them consistent forever.
- Learner's own lines in Pass 1: a distinct, calm "you" voice.
- Ambience loop per location; event SFX from the turn's `sfx` field; ducking under speech (~ −12 dB).
- **Noise dial:** off / light / real (real = no ducking, louder chatter) — a difficulty setting for listening.
- Subtitles toggle: off · street spelling · street + meaning.

## 8. UI (Arabic RTL shell, Spanish LTR content)
- Scene screen: location card (or background art later), speaking character's name tag + colour,
  current line (subtitle mode), big **hold-to-talk** button, row of: Hint · Choices · Rewind · سؤال.
- Chunk card (4 layers) slides up for new chunks; tap ▶ to hear it in two speeds (clear / street).
- Notebook: chunks by state, catch box, error traps, streak, roadmap phase.
- Debrief screen: success line, comprehension slider, next-time (max 2 items).

## 9. MVP acceptance (one episode, end to end)
- [ ] Episode s1e6 (CONTENT.md) plays all 3 passes plus debrief on a real phone.
- [ ] At least 4 distinct character voices (device TTS or Piper), consistent across passes.
- [ ] Pitch ambience loop + whistle + ball + «¡Uuuh!» SFX, with ducking.
- [ ] Hold-to-talk STT forced to es-ES; transcript shown; response time measured.
- [ ] Pass 1–2 from a cached generated script; Pass 3 live with the turn schema, validated.
- [ ] Hint, Choices, Rewind and the catch word all work.
- [ ] Chunk cards show all 4 layers with RTL/LTR correct.
- [ ] Session saved: attempt, turns, chunk state changes, catch box.

## 10. Later
FSRS recall at session start · weekly report · song moments (original songs only) · bad-joke moments ·
illustrated art and portraits · pronunciation scoring · season exam · multiple learners.
