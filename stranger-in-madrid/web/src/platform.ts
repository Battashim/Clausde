// Thin wrappers over the claude.ai artifact runtime (window.claude.use). Every capability may be absent.
/* eslint-disable @typescript-eslint/no-explicit-any */
declare global {
  interface Window {
    claude?: { use(name: string): Promise<any> };
  }
}

const cache = new Map<string, Promise<any>>();

export function use<T = any>(name: string): Promise<T | null> {
  if (!cache.has(name)) {
    const p = window.claude?.use
      ? Promise.race([window.claude.use(name).catch(() => null), new Promise((r) => setTimeout(() => r(null), 12000))])
      : Promise.resolve(null);
    cache.set(name, p);
  }
  return cache.get(name)! as Promise<T | null>;
}

// Resolved namespaces, filled in at boot so click handlers can call them synchronously
// (dictation.start must run inside the viewer's gesture with nothing awaited first).
export const caps: { sample: any; dictation: any; db: any; user: any; tts: any } = { sample: null, dictation: null, db: null, user: null, tts: null };

export async function bootCaps() {
  const [sample, dictation, db, user, tts] = await Promise.all(["sample", "dictation", "db", "user", "tts"].map((n) => use(n)));
  Object.assign(caps, { sample, dictation, db, user, tts });
  return caps;
}
