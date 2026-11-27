// Shared types for app + server. Mirrors docs/SPEC.md §4–§6 and docs/CONTENT.md.

export type CharacterId = string;

export interface Character {
  id: CharacterId;
  name: string;
  who: string;
  /** Hex colour for the name tag. */
  color: string;
  /** Two-letter initials for the name tag (no emoji). */
  initials: string;
  /** Device-TTS starting point. voiceIndex picks among the es-ES voices on the device. */
  tts: { gender: "male" | "female" | "neutral"; pitch: number; rate: number; voiceIndex: number };
  /** Words this character uses that are always allowed in their mouth (names, catchphrases). */
  signature?: string[];
}

export interface ChunkExample {
  es: string;
  street: string;
  ar: string;
}

export type FrequencyBand = "core" | "common" | "bonus";

export interface Chunk {
  id: string;
  es_written: string;
  meaning_ar: string;
  meaning_en: string;
  street_spelling: string;
  /** Sound in Arabic letters; stressed syllable wrapped in **…**. */
  sound_ar: string;
  examples: ChunkExample[];
  notes_ar?: string;
  frequency_band: FrequencyBand;
  /** Episode where the chunk is introduced (e.g. "s1e3"). Chunks of earlier episodes count as known by default. */
  introduced_in: string;
  /** Extra inflected / street forms accepted by the vocabulary guard (e.g. "juego", "juega"). */
  forms?: string[];
  /** Question a character asks at RECALL to check this chunk cold. */
  recall_prompt?: { speaker: CharacterId; es: string; street: string; meaning_ar: string; sound_ar: string; expect: string[] };
  audio?: Record<string, string>;
}

export interface Episode {
  id: string;
  season: number;
  n: number;
  title: string;
  location: string;
  characters: CharacterId[];
  mission: string;
  mission_ar?: string;
  mission_type: "ask" | "lead";
  target_chunks: string[];
  known_chunks_required: string[];
  outline: string[];
  twists_pass3: string[];
  debrief_question: string;
  bad_joke: string | null;
  /** Wholesome-only scene (U15 players present). */
  minors_present?: boolean;
}

export interface Location {
  id: string;
  name: string;
  name_ar: string;
  ambience: string;
  sfx: string[];
}

/** One line of the cached Pass-1 script. */
export interface ScriptLine {
  speaker: CharacterId | "you";
  es: string;
  street: string;
  meaning_ar: string;
  meaning_en?: string;
  sound_ar: string;
  new_chunk_ids: string[];
  sfx?: string | null;
  /** Alternatives accepted at Pass 2 for the learner's own lines. */
  accept?: string[];
  /** A trap line: a past mistake in another mouth the learner should correct. */
  trap?: { wrong: string; right: string } | null;
}

export interface CorridorStep {
  es: string;
  street: string;
  sound_ar: string;
  meaning_ar: string;
}

export interface Script {
  episode_id: string;
  generated_by: "seed" | "claude";
  generated_at: string;
  lines: ScriptLine[];
  corridor: CorridorStep[][];
  /** 4-layer cards for today's new chunks. */
  cards: Chunk[];
}

// ---------- Claude turn schema (SPEC §4) ----------

export type FeedbackType = "none" | "recast" | "correct_now";

export interface TurnLine {
  speaker: string;
  es: string;
  street: string;
  meaning_ar: string;
  sound_ar: string;
  new_chunk_ids: string[];
  sfx: string | null;
}

export interface TurnFeedback {
  type: FeedbackType;
  wrong: string;
  right: string;
  say_again: boolean;
}

export interface TurnChoice {
  es: string;
  street: string;
}

/** Extension to SPEC §4: hint ladder for the Hint button (first words → full line). */
export interface TurnHint {
  first_words: string;
  full: string;
  street: string;
}

/** Extension to SPEC §4: debrief outcome, only on the final debrief turn. */
export interface TurnDebrief {
  success_line_ar: string;
  next_time_ar: string[];
}

export interface ClaudeTurn {
  lines: TurnLine[];
  await_learner: boolean;
  expected_intents: string[];
  feedback: TurnFeedback;
  choices: TurnChoice[];
  hint: TurnHint | null;
  catch_box_add: string[];
  events: string[];
  debrief: TurnDebrief | null;
  end_scene: boolean;
}

// ---------- Learner model (SPEC §6) ----------

export type ChunkState = "unseen" | "heard" | "said_helped" | "said_alone" | "transferred";

export interface FsrsCard {
  stability: number;
  difficulty: number;
  /** ISO date */
  due: string;
  /** ISO date or null if never reviewed */
  last_review: string | null;
  reps: number;
  lapses: number;
}

export interface LearnerChunk {
  chunk_id: string;
  state: ChunkState;
  fsrs: FsrsCard;
  sightings: number;
  last_error: string | null;
  /** Day (YYYY-MM-DD) and episode of the first unaided use; needed for "transferred". */
  first_alone_day: string | null;
  first_alone_episode: string | null;
}

export type ErrorTag = "person_ending" | "ser_estar" | "gender" | "soundalike" | "past_retell" | "other";

export interface CatchBoxItem {
  word: string;
  source_sentence: string;
  speaker: string;
  moment: string;
  anchor: string | null;
  sightings: number;
  used: boolean;
}

/** What the app sends the server for a live turn. */
export interface LiveTurnRequest {
  mode: "pass3" | "debrief" | "catchbox";
  episode_id: string;
  twist: string | null;
  /** Prior exchanges this pass (character lines + learner utterances). */
  history: { speaker: string; text: string }[];
  /** Raw STT text of the learner's latest utterance (null = opening the scene). */
  learner_utterance: string | null;
  stt_confidence: number | null;
  known_chunk_ids: string[];
  new_chunk_ids: string[];
  /** Recurring mistakes to watch for (traps). */
  error_patterns: { wrong: string; right: string; count: number }[];
  /** Life facts characters remember (kids, Madridista, Toby…). */
  life_facts: string[];
  catch_box: { word: string; source_sentence: string }[];
}

export interface LiveTurnResponse {
  turn: ClaudeTurn;
  guard: { regenerated: boolean; unknown_words: string[]; bonus_words: string[]; trimmed: boolean };
  latency_ms: number;
}
