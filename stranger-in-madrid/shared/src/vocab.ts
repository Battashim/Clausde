// Vocabulary guard (SPEC §4): every word a character says must come from the allowed set
// = known chunks + today's new chunks + function words + character names, with a small "bonus" allowance.
import type { Chunk, ClaudeTurn } from "./types";

export const BONUS_ALLOWANCE_PER_SCENE = 2;

/** Street spellings → written words, so «cansao», «pa'», «na'» count as their written word. */
export const STREET_TO_WRITTEN: Record<string, string> = {
  "pa'": "para",
  pa: "para",
  "na'": "nada",
  na: "nada",
  "to'": "todo",
  to: "todo",
  "'ta": "esta",
  ta: "esta",
  cansao: "cansado",
  partio: "partido",
};

/**
 * Function words + basic forms every learner has from day one (the "glue" of sentences).
 * Kept accent-free because `normalizeWord` strips accents.
 */
export const FUNCTION_WORDS: string[] = (
  "a al de del el la los las lo le les un una unos unas y e o u ni que qué como cuando donde por para con sin " +
  "en entre sobre hasta desde mas pero si no ya muy mas menos tan tambien tampoco aqui ahi alli " +
  "yo tu el ella usted nosotros vosotros ellos ellas ustedes me te se nos os mi mis tu tus su sus " +
  "este esta esto ese esa eso estos estas esos esas " +
  "soy eres es somos sois son estoy estas esta estamos estais estan " +
  "tengo tienes tiene tenemos teneis tienen voy vas va vamos vais van he has ha hemos habeis han " +
  "hay bien mal bueno buena vale venga pues bueno hola adios gracias porfa perdona perdon " +
  "si sí vale oye mira a ver un momento como cual quien cuanto cuantos por que porque " +
  "uno dos tres cuatro cinco seis siete ocho nueve diez " +
  "mister chicos chico tio tia hombre " +
  "ah eh oh uy ay uuuh jaja"
)
  .split(/\s+/)
  .filter(Boolean);

/** Lowercase, strip accents and punctuation; map street spellings to written words. */
export function normalizeWord(w: string): string {
  const base = w
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[¡!¿?.,;:…«»"“”()\[\]—–-]/g, "")
    .trim();
  if (STREET_TO_WRITTEN[base] !== undefined) return STREET_TO_WRITTEN[base];
  return base.replace(/^'+|'+$/g, "");
}

export function tokenize(text: string): string[] {
  return text
    .split(/\s+/)
    .map(normalizeWord)
    .filter((w) => w.length > 0 && !/^\d+$/.test(w));
}

export interface AllowedSetInput {
  chunks: Chunk[];
  knownChunkIds: string[];
  newChunkIds: string[];
  /** Character names and signature words (always allowed). */
  extraWords?: string[];
}

export function buildAllowedSet({ chunks, knownChunkIds, newChunkIds, extraWords = [] }: AllowedSetInput): Set<string> {
  const ids = new Set([...knownChunkIds, ...newChunkIds]);
  const allowed = new Set<string>(FUNCTION_WORDS.map(normalizeWord));
  for (const c of chunks) {
    if (!ids.has(c.id)) continue;
    for (const w of tokenize(c.es_written)) allowed.add(w);
    for (const f of c.forms ?? []) for (const w of tokenize(f)) allowed.add(w);
  }
  for (const w of extraWords) for (const t of tokenize(w)) allowed.add(t);
  return allowed;
}

export interface VocabCheck {
  ok: boolean;
  /** Words outside the allowed set beyond the bonus allowance. */
  unknown: string[];
  /** Out-of-set words tolerated as "bonus" (never required, never counted against the learner). */
  bonus: string[];
}

/**
 * Checks the Spanish of every character line. The first `bonusAllowance` distinct unknown words
 * are tolerated as bonus; anything beyond fails the guard. Pass `alreadyUsedBonus` to keep the
 * allowance per scene (not per turn).
 */
export function checkVocabulary(
  texts: string[],
  allowed: Set<string>,
  bonusAllowance = BONUS_ALLOWANCE_PER_SCENE,
  alreadyUsedBonus: string[] = [],
): VocabCheck {
  const seen = new Set<string>();
  const outside: string[] = [];
  for (const t of texts)
    for (const w of tokenize(t)) {
      if (allowed.has(w) || seen.has(w)) continue;
      seen.add(w);
      outside.push(w);
    }
  const used = new Set(alreadyUsedBonus);
  const bonus: string[] = [];
  const unknown: string[] = [];
  let remaining = Math.max(0, bonusAllowance - used.size);
  for (const w of outside) {
    if (used.has(w)) bonus.push(w);
    else if (remaining > 0) {
      bonus.push(w);
      remaining--;
    } else unknown.push(w);
  }
  return { ok: unknown.length === 0, unknown, bonus };
}

/** Convenience: run the guard over a Claude turn's character lines (the learner's words are never guarded). */
export function checkTurnVocabulary(turn: ClaudeTurn, allowed: Set<string>, alreadyUsedBonus: string[] = []): VocabCheck {
  const texts = turn.lines.filter((l) => l.speaker !== "you").map((l) => l.es);
  // Choices and hints are lines the learner will SAY, so they must be fully known (no bonus).
  const sayable = [...turn.choices.map((c) => c.es), ...(turn.hint ? [turn.hint.full] : [])];
  const spoken = checkVocabulary(texts, allowed, BONUS_ALLOWANCE_PER_SCENE, alreadyUsedBonus);
  const said = checkVocabulary(sayable, allowed, 0);
  const unknown = [...new Set([...spoken.unknown, ...said.unknown])];
  return { ok: unknown.length === 0, unknown, bonus: spoken.bonus };
}
