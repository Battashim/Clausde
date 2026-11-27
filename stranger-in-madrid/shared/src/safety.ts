// Safety guard (SPEC §4): scenes with U15 players stay wholesome — football, school, family, effort, respect.
import { tokenize } from "./vocab";

/** Topics that never appear in scenes with minors. Accent-free, normalized forms. */
const BLOCKED_WITH_MINORS = [
  "cerveza", "cervezas", "cana", "canas", "vino", "copa", "copas", "alcohol", "borracho", "borracha",
  "fumar", "tabaco", "cigarro", "porro", "droga", "drogas", "apuesta", "apuestas", "apostar",
  "novia", "novio", "beso", "besos", "sexy", "guapa", "guapo", "tonto", "tonta", "idiota", "imbecil",
  "gordo", "gorda", "inutil", "callate", "mierda", "joder", "hostia", "cono", "puta", "puto", "gilipollas",
];

/** Words blocked in every scene (the app stays family-friendly). */
const BLOCKED_ALWAYS = ["joder", "hostia", "cono", "puta", "puto", "gilipollas", "mierda"];

export interface SafetyCheck {
  ok: boolean;
  hits: string[];
}

export function checkSafety(texts: string[], minorsPresent: boolean): SafetyCheck {
  const blocked = new Set(minorsPresent ? BLOCKED_WITH_MINORS : BLOCKED_ALWAYS);
  const hits = new Set<string>();
  for (const t of texts) for (const w of tokenize(t)) if (blocked.has(w)) hits.add(w);
  return { ok: hits.size === 0, hits: [...hits] };
}
