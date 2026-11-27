// Stranger in Madrid — web edition. Opens in the browser; nothing to install.
import {
  PHASE_LABEL_AR,
  containsChunk,
  firstPhase,
  isEarlierEpisode,
  matchLine,
  nextPhase,
  normalizeWord,
  pickDue,
  todayKey,
  type Character,
  type Chunk,
  type ChunkState,
  type ClaudeTurn,
  type Episode,
  type LiveTurnRequest,
  type Location,
  type Phase,
  type Script,
} from "../../shared/src";
import charactersJson from "../../content/characters.json";
import chunksJson from "../../content/chunks.json";
import locationsJson from "../../content/locations.json";
import episodeJson from "../../content/episodes/s1e6.json";
import scriptJson from "../../content/scripts/s1e6.seed.json";
import { errorText, liveTurn, type World } from "./brain";
import { bootCaps, caps } from "./platform";
import * as sound from "./sound";
import * as store from "./store";
import { MicBar, ar, banner, btn, chunkSheet, es, h, lineCard, stress, type Utterance } from "./ui";
import { initVoices, setCharacters, setSpeed, soundZoom, speak, stopSpeaking, unlockSpeech, voiceSummary } from "./voice";

const chars = charactersJson as unknown as Record<string, Character>;
const chunks = chunksJson as unknown as Chunk[];
const locations = locationsJson as unknown as Record<string, Location>;
const episode = episodeJson as unknown as Episode;
const script = scriptJson as unknown as Script;
const chunkById = new Map(chunks.map((c) => [c.id, c]));
if (!script.cards.length) script.cards = episode.target_chunks.map((id) => chunkById.get(id)!).filter(Boolean);
const world: World = { episode, chunks, characters: chars, locations };
const defaultKnown = chunks.filter((c) => isEarlierEpisode(c.introduced_in, episode.id)).map((c) => c.id);

const root = document.getElementById("app")!;
const cafe: Location = { id: "pacos_cafe", name: "Bar de Paco", name_ar: "قهوة باكو", ambience: "cafe_ambience", sfx: ["espresso_machine", "spoon", "door_bell"] };

class Exit extends Error {}

// ============================== Session ==============================
interface Session {
  attempt: store.Attempt;
  newIds: string[];
  knownIds: string[];
  twist: string;
  unaided: Set<string>;
  reviewed: Set<string>;
  alive: boolean;
  mic: MicBar;
  body: HTMLElement;
  foot: HTMLElement;
  phaseEl: HTMLElement;
  locEl: HTMLElement;
}
let S: Session | null = null;

const live = () => {
  if (!S?.alive) throw new Exit();
};
const subs = () => store.settings().subtitles;
const say = async (text: string, speaker: string, slow = false) => {
  await speak(text, speaker, { slow });
  live();
};
const scrollEnd = () => S?.body.lastElementChild?.scrollIntoView({ block: "end", behavior: "smooth" });

function logTurn(pass: string, speaker: string, text: string, u?: Utterance, feedback?: string | null) {
  if (!S) return;
  store.logTurn(S.attempt.id, { pass, speaker, text, stt_raw: u?.typed ? null : (u?.transcript ?? null), stt_confidence: u?.confidence ?? null, response_ms: u?.responseMs ?? null, typed: u?.typed, feedback: feedback ?? null });
}

/** Credit every known/new chunk found in what he said (said_alone / said_helped + one FSRS review per session). */
function creditChunks(text: string, aided: boolean, responseMs?: number | null) {
  if (!S) return;
  const clean = (t: string) => t.replace(/…/g, "").trim();
  for (const id of [...S.newIds, ...S.knownIds]) {
    const c = chunkById.get(id);
    if (!c || !containsChunk(text, clean(c.es_written))) continue;
    if (aided) store.chunkEvent(id, { kind: "said_helped" });
    else {
      store.chunkEvent(id, { kind: "said_alone", day: todayKey(new Date()), episodeId: episode.id });
      S.unaided.add(id);
    }
    if (!S.reviewed.has(id)) {
      store.chunkReview(id, aided ? "helped" : "unaided", responseMs ?? undefined);
      S.reviewed.add(id);
    }
  }
}

function setStage(title: string, sub?: string) {
  S!.body.replaceChildren(h("h2", { class: "stage", text: title }), sub ? ar(sub, "muted") : "");
  S!.foot.replaceChildren();
}

function waitFor<T>(register: (resolve: (v: T) => void) => void): Promise<T> {
  return new Promise<T>((resolve) => register(resolve)).then((v) => {
    live();
    return v;
  });
}

// ---------- RECALL ----------
async function phaseRecall(due: string[]) {
  for (let i = 0; i < due.length; i++) {
    const c = chunkById.get(due[i])!;
    const p = c.recall_prompt ?? { speaker: "paco", es: "A ver, crack… ¿cómo se dice?", street: "aber krak… komosedize?", meaning_ar: `كيف تقول: «${c.meaning_ar}»؟`, sound_ar: "", expect: [] };
    setStage(`تذكّر · ${i + 1}/${due.length}`, "سؤال بارد من آخر مرة — جاوب بدون مساعدة لو تقدر.");
    S!.body.append(lineCard({ speaker: p.speaker, es: p.es, street: p.street, meaning_ar: p.meaning_ar }, chars, subs(), { onReplay: () => void speak(p.es, p.speaker) }));
    const hintBox = h("div");
    S!.body.append(hintBox);
    let hint = 0;
    let tries = 0;
    const outcome = await waitFor<"unaided" | "helped" | "missed">((resolve) => {
      const showHint = () => {
        hint = Math.min(2, hint + 1);
        hintBox.replaceChildren(banner("info", ar("تلميح:", "muted"), es(hint === 1 ? `${c.es_written.split(/\s+/)[0]}…` : c.es_written, "es big")));
      };
      S!.mic.onUtterance = (u) => {
        tries++;
        const m = matchLine(u.transcript, [...p.expect, c.es_written.replace(/…/g, "")], 0.55);
        logTurn("recall", "you", u.transcript, u, m.pass ? "ok" : "miss");
        if (m.pass) resolve(hint === 0 && tries === 1 ? "unaided" : hint >= 2 ? "missed" : "helped");
        else if (hint < 2) showHint();
      };
      S!.foot.append(S!.mic.el, h("div", { class: "row" }, btn("تلميح", showHint, "btn ghost"), btn("قل لي", () => resolve("missed"), "btn ghost")));
      void speak(p.es, p.speaker).then(() => S?.mic.markFloor());
    });
    store.chunkReview(c.id, outcome);
    S!.reviewed.add(c.id);
    if (outcome !== "missed") store.chunkEvent(c.id, outcome === "unaided" ? { kind: "said_alone", day: todayKey(new Date()), episodeId: `recall:${c.id}` } : { kind: "said_helped" });
    hintBox.replaceChildren(
      banner(outcome === "missed" ? "warn" : "ok", ar(outcome === "unaided" ? "لحالك! زين." : outcome === "helped" ? "بمساعدة بسيطة — زين." : "ما عليه — بترجع لك قريب."), es(c.es_written, "es big"), es(c.street_spelling, "street")),
    );
    if (outcome === "missed") await say(c.es_written.replace(/…/g, ""), "you");
    S!.foot.replaceChildren();
    await waitFor<void>((r) => S!.foot.append(btn(i + 1 < due.length ? "التالي" : "يلا للحلقة", () => r())));
  }
}

// ---------- CORRIDOR ----------
async function phaseCorridor() {
  let skip = false;
  for (let g = 0; g < script.corridor.length && !skip; g++) {
    const group = script.corridor[g];
    for (let k = 0; k < group.length && !skip; k++) {
      const st = group[k];
      setStage(`الممر · جملة ${g + 1}/${script.corridor.length}`, "نبني الجملة قطعة قطعة. اسمع، وقلها بصوتك.");
      group.slice(0, k).forEach((p) => S!.body.append(es(p.es, "es faint")));
      S!.body.append(h("div", { class: "card focus" }, es(st.es, "es huge"), es(st.street, "street"), stress(st.sound_ar), ar(st.meaning_ar)));
      const fb = h("div");
      S!.body.append(fb);
      const action = await waitFor<"next" | "skip">((resolve) => {
        S!.mic.onUtterance = (u) => {
          const m = matchLine(u.transcript, [st.es]);
          logTurn("corridor", "you", u.transcript, u, m.pass ? "ok" : "retry");
          fb.replaceChildren(m.pass ? banner("ok", ar("تمام!")) : banner("warn", ar("اسمعها مرة ثانية وجرّب — أو كمّل.")));
          if (!m.pass) void speak(st.es, "you", { slow: true });
        };
        S!.foot.append(
          S!.mic.el,
          h("div", { class: "row" }, btn("التالي", () => resolve("next")), btn("▶ اسمع", () => void speak(st.es, "you"), "btn ghost"), btn("تخطَّ الممر", () => resolve("skip"), "btn ghost")),
        );
        void speak(st.es, "you").then(() => S?.mic.markFloor());
      });
      stopSpeaking();
      if (action === "skip") skip = true;
    }
  }
}

// ---------- PASS 1 — LISTEN ----------
async function phasePass1() {
  setStage("المرحلة ١ — استمع بس", "اسمع المشهد كامل، حتى جملك أنت. اضغط على أي جملة لتعيدها، وضغطتين لتقطيعها.");
  const seen = new Set<string>();
  let paused = false;
  let resume: (() => void) | null = null;
  const pauseBtn = btn("⏸ وقف", () => {
    paused = !paused;
    pauseBtn.textContent = paused ? "▶ كمّل" : "⏸ وقف";
    if (paused) stopSpeaking();
    else resume?.();
  }, "btn ghost");
  S!.foot.append(h("div", { class: "row" }, pauseBtn));
  for (let i = 0; i < script.lines.length; i++) {
    const l = script.lines[i];
    S!.body.querySelectorAll(".line").forEach((n) => n.classList.add("dim"));
    S!.body.append(lineCard(l, chars, subs(), { onReplay: () => void speak(l.es, l.speaker), onZoom: () => void soundZoom(l.es, l.speaker) }));
    scrollEnd();
    for (;;) {
      if (paused) await waitFor<void>((r) => (resume = r));
      sound.playSfx(l.sfx);
      await say(l.es, l.speaker);
      if (!paused) break;
    }
    logTurn("pass1", l.speaker, l.es);
    for (const id of l.new_chunk_ids) {
      if (seen.has(id)) continue;
      seen.add(id);
      store.chunkEvent(id, { kind: "heard" });
      const c = chunkById.get(id);
      if (c) {
        await chunkSheet(c, (slow) => void speak(c.es_written.replace(/…/g, ""), "you", { slow }));
        live();
      }
    }
  }
  S!.foot.replaceChildren();
  await waitFor<void>((r) => S!.foot.append(btn("يلا للمرحلة ٢", () => r())));
}

// ---------- PASS 2 — GUIDED ----------
async function phasePass2() {
  setStage("المرحلة ٢ — بمساعدة", "الشخصيات تتكلم، ولما يجي دورك تشوف جملتك وتقولها.");
  let trap: { wrong: string; right: string } | null = null;
  for (const l of script.lines) {
    S!.body.querySelectorAll(".line, .card.focus").forEach((n) => n.classList.add("dim"));
    if (l.speaker !== "you") {
      S!.body.append(lineCard(l, chars, subs(), { onReplay: () => void speak(l.es, l.speaker), onZoom: () => void soundZoom(l.es, l.speaker) }));
      scrollEnd();
      sound.playSfx(l.sfx);
      await say(l.es, l.speaker);
      logTurn("pass2", l.speaker, l.es);
      if (l.trap) trap = l.trap;
      continue;
    }
    if (trap) S!.body.append(banner("warn", ar("في غلط في كلام اللاعب! صحّحه له.")));
    const card = h("div", { class: "card focus" }, ar("دورك — قل:", "eyebrow"), es(l.es, "es huge"), es(l.street, "street"), stress(l.sound_ar), ar(l.meaning_ar));
    const fb = h("div");
    S!.body.append(card, fb);
    scrollEnd();
    let tries = 0;
    await waitFor<void>((resolve) => {
      S!.mic.onUtterance = (u) => {
        tries++;
        const m = matchLine(u.transcript, [l.es, ...(l.accept ?? [])]);
        logTurn("pass2", "you", u.transcript, u, m.pass ? "ok" : "retry");
        if (m.pass) {
          creditChunks(u.transcript, true, u.responseMs);
          fb.replaceChildren(banner("ok", ar(trap ? `صححت له: «${trap.right}» — زين.` : "زين!")));
          trap = null;
          resolve();
        } else if (tries < 2) {
          fb.replaceChildren(banner("warn", ar("قريبة — اسمعها وقلها مرة ثانية.")));
          void speak(l.es, "you").then(() => S?.mic.markFloor());
        } else {
          if (trap) store.recordError(trap.wrong, trap.right, "other");
          fb.replaceChildren(banner("warn", ar("ما عليه، نكمل. بترجع لك في المرحلة ٣.")));
          trap = null;
          resolve();
        }
      };
      S!.foot.replaceChildren(S!.mic.el, h("div", { class: "row" }, btn("▶ اسمع جملتي", () => void speak(l.es, "you"), "btn ghost")));
      S!.mic.markFloor();
    });
    S!.foot.replaceChildren();
    await new Promise((r) => setTimeout(r, 500));
    live();
  }
  await waitFor<void>((r) => S!.foot.replaceChildren(btn("يلا للمرحلة ٣ — لحالك", () => r())));
}

// ---------- Live scenes (PASS 3, DEBRIEF, CATCH BOX) ----------
const MAX_LEARNER_TURNS = 8;

async function liveScene(mode: LiveTurnRequest["mode"], title: string, sub: string): Promise<ClaudeTurn | null> {
  setStage(title, sub);
  const hist: { speaker: string; text: string }[] = [];
  let turn: ClaudeTurn | null = null;
  let hintLevel = 0;
  let choicesShown = false;
  let sayAgain: { wrong: string; right: string } | null = null;
  let learnerTurns = 0;
  let stall: ReturnType<typeof setTimeout> | null = null;
  let finish: (t: ClaudeTurn | null) => void = () => {};
  let ctl: AbortController | null = null;
  const extras = h("div", { class: "extras" });
  const status = h("p", { class: "muted thinking", dir: "rtl" });

  const tools = h("div", { class: "tools" });
  const tHint = btn("تلميح", () => {
    hintLevel = Math.min(2, hintLevel + 1);
    paintExtras();
  }, "tool");
  const tChoices = btn("خيارات", () => {
    choicesShown = true;
    paintExtras();
  }, "tool");
  const tRewind = btn("إرجاع", async () => {
    for (const l of turn?.lines ?? []) await speak(l.es, l.speaker);
    hintLevel = Math.max(hintLevel, 1);
    paintExtras();
    S?.mic.markFloor();
  }, "tool");
  const tCatch = btn("سؤال", () => openCatch(), "tool catch");
  tools.append(tHint, tChoices, tRewind, tCatch);
  const endBtn = btn("أنهِ المشهد", () => finish(turn), "btn ghost small");

  function paintExtras() {
    extras.replaceChildren();
    if (sayAgain) extras.append(banner("warn", ar("قلها كاملة مرة وحدة:"), es(sayAgain.wrong, "es strike"), es(sayAgain.right, "es big")));
    if (turn?.hint && hintLevel > 0) extras.append(banner("info", ar("تلميح", "muted"), es(hintLevel === 1 ? turn.hint.first_words : turn.hint.full, "es big"), hintLevel > 1 ? es(turn.hint.street, "street") : null));
    if (choicesShown && turn?.choices.length) {
      extras.append(ar("اختر وحدة وقلها بصوتك كاملة:", "muted"));
      for (const c of turn.choices) extras.append(h("button", { class: "choice", type: "button", onClick: () => void speak(c.es, "you") }, es(c.es), es(c.street, "street")));
    }
    tHint.disabled = !turn?.hint;
    tChoices.disabled = !turn?.choices.length;
    tChoices.classList.toggle("lit", choicesShown);
    scrollEnd();
  }

  function openCatch() {
    const last = [...hist].reverse().find((x) => x.speaker !== "you");
    if (!last) return;
    const words = last.text.split(/\s+/).map((w) => w.replace(/[¡!¿?.,;:…«»"]/g, "")).filter(Boolean);
    const close = () => wrap.remove();
    const wrap = h(
      "div",
      { class: "scrim", onClick: (e: Event) => e.target === wrap && close() },
      h(
        "div",
        { class: "sheet" },
        ar("أي كلمة ما فهمتها؟", "h3"),
        ar("المشهد يكمل، ونراجعها في الخلاصة.", "muted"),
        h(
          "div",
          { class: "chips", dir: "ltr" },
          ...words.map((w) =>
            btn(w, () => {
              store.catchAdd({ word: w, source_sentence: last.text, speaker: last.speaker, moment: `${episode.id}:${mode}` });
              S!.attempt.asked_meaning++;
              status.textContent = `«${w}» في صندوق الأسئلة.`;
              close();
            }, "chip"),
          ),
        ),
        btn("إلغاء", close, "btn ghost"),
      ),
    );
    document.body.append(wrap);
  }

  function buildReq(utterance: string | null): LiveTurnRequest {
    return {
      mode,
      episode_id: episode.id,
      twist: mode === "pass3" ? S!.twist : null,
      history: hist.slice(0, utterance !== null ? -1 : undefined),
      learner_utterance: utterance,
      stt_confidence: null,
      known_chunk_ids: S!.knownIds,
      new_chunk_ids: S!.newIds,
      error_patterns: store.errorPatterns().map(({ wrong, right, count }) => ({ wrong, right, count })),
      life_facts: store.settings().lifeFacts,
      catch_box: mode === "catchbox" ? store.catchBox(true).slice(0, 3).map((c) => ({ word: c.word, source_sentence: c.source_sentence })) : [],
    };
  }

  async function request(utterance: string | null) {
    S!.mic.setEnabled(false);
    status.textContent = "يفكّر…";
    ctl = new AbortController();
    const res = await liveTurn(buildReq(utterance), world, ctl.signal);
    live();
    status.textContent = res.source === "practice" ? errorText(res.error) || "وضع التدريب (بدون Claude)." : "";
    turn = res.turn;
    hintLevel = 0;
    choicesShown = false;
    for (const l of turn.lines) {
      hist.push({ speaker: l.speaker, text: l.es });
      S!.body.insertBefore(lineCard(l, chars, subs(), { onReplay: () => void speak(l.es, l.speaker), onZoom: () => void soundZoom(l.es, l.speaker) }), extras);
      scrollEnd();
      sound.playSfx(l.sfx);
      await say(l.es, l.speaker);
      logTurn(mode, l.speaker, l.es);
    }
    if (turn.feedback.type === "correct_now" && turn.feedback.right) {
      store.recordError(turn.feedback.wrong, turn.feedback.right, store.guessErrorTag(turn.feedback.wrong, turn.feedback.right));
      if (turn.feedback.say_again) sayAgain = { wrong: turn.feedback.wrong, right: turn.feedback.right };
    }
    for (const w of turn.catch_box_add) store.catchAdd({ word: w, source_sentence: utterance ?? turn.lines[0]?.es ?? "", speaker: turn.lines[0]?.speaker ?? "", moment: `${episode.id}:${mode}` });
    paintExtras();
    if (turn.end_scene || learnerTurns >= MAX_LEARNER_TURNS) return finish(turn);
    S!.mic.setEnabled(true);
    S!.mic.markFloor();
    if (mode === "pass3" && turn.await_learner && turn.choices.length) {
      stall = setTimeout(() => {
        // Stalled ~3 s: offer the 3 choices (a freeze is never a mistake).
        S!.attempt.freezes++;
        choicesShown = true;
        paintExtras();
      }, 3500);
    }
  }

  return waitFor<ClaudeTurn | null>((resolve) => {
    finish = (t) => {
      ctl?.abort();
      if (stall) clearTimeout(stall);
      S!.mic.setEnabled(true);
      resolve(t);
    };
    S!.mic.onUtterance = (u) => {
      if (stall) clearTimeout(stall);
      const text = u.transcript.trim();
      if (!text) return;
      if (normalizeWord(text) === "pregunta" || text === "سؤال") return openCatch();
      if (sayAgain) {
        const m = matchLine(text, [sayAgain.right]);
        logTurn(mode, "you", text, u, m.pass ? "say_again_ok" : "say_again_try");
        status.textContent = m.pass ? "تمام، نكمل." : `الصح: ${sayAgain.right} — نكمل.`;
        creditChunks(text, true, u.responseMs);
        sayAgain = null;
        paintExtras();
        S!.mic.markFloor();
        return;
      }
      const aided = hintLevel > 0 || choicesShown;
      creditChunks(text, aided, u.responseMs);
      logTurn(mode, "you", text, u, aided ? "aided" : null);
      learnerTurns++;
      hist.push({ speaker: "you", text });
      S!.body.insertBefore(h("div", { class: "me" }, es(text)), extras);
      request(text).catch((e) => {
        if (!(e instanceof Exit)) status.textContent = "صار خطأ — جرّب مرة ثانية.";
      });
    };
    S!.body.append(extras, status);
    S!.foot.append(S!.mic.el, tools, endBtn);
    paintExtras();
    request(null).catch((e) => {
      if (!(e instanceof Exit)) status.textContent = "صار خطأ — اضغط «أنهِ المشهد» أو ارجع.";
    });
  });
}

// ---------- DEBRIEF ----------
async function phaseDebrief(): Promise<void> {
  S!.locEl.replaceChildren(...locationBits(cafe));
  sound.playAmbience("cafe_ambience");
  const t1 = await liveScene("debrief", "الخلاصة — في قهوة باكو", "باكو يسألك عن يومك. احكِ له بجملك.");
  let outcome = t1?.debrief ?? null;
  if (store.catchBox(true).length) {
    const t2 = await liveScene("catchbox", "صندوق الأسئلة", "نراجع الكلمات اللي سألت عنها.");
    for (const c of store.catchBox(true).slice(0, 3)) store.catchUsed(c.word);
    outcome ??= t2?.debrief ?? null;
  }
  const unaided = [...S!.unaided].map((id) => chunkById.get(id)?.es_written).filter(Boolean);
  const success = outcome?.success_line_ar || (unaided.length ? `قلت «${unaided[0]}» لحالك، بدون مساعدة.` : "كمّلت المشهد كامل للآخر.");
  S!.attempt.success_line = success;
  setStage("خلصنا اليوم");
  S!.body.append(banner("ok", ar("نجاح اليوم", "eyebrow"), ar(success, "ar strong")));
  if (outcome?.next_time_ar?.length) S!.body.append(h("div", { class: "card" }, ar("المرة الجاية", "h3"), ...outcome.next_time_ar.slice(0, 2).map((n) => ar(`• ${n}`))));
  S!.body.append(h("p", { class: "h3", dir: "rtl" }, "كم فهمت؟ ", h("span", { dir: "ltr", lang: "es", text: "¿Cuánto entendiste?" })));
  const pct = await waitFor<number>((r) => S!.foot.append(h("div", { class: "row" }, ...[50, 70, 90].map((p) => btn(`${p}%`, () => r(p))))));
  S!.attempt.self_comprehension = pct;
}

// ---------- Orchestrator ----------
function locationBits(loc: Location | null | undefined) {
  return [h("strong", { text: loc?.name_ar ?? "" }), h("span", { class: "loc-es", dir: "ltr", lang: "es", text: loc?.name ?? "" })];
}

async function runSession() {
  // Called from the Start tap: unlock audio + speech inside the gesture.
  sound.unlockAudio();
  unlockSpeech();
  const st = store.settings();
  sound.setNoise(st.noise);
  setSpeed(st.voiceSpeed);
  setCharacters(chars);

  const newIds = episode.target_chunks.slice(0, 5);
  const known = new Set([...store.knownChunkIds(), ...episode.known_chunks_required]);
  newIds.forEach((id) => known.delete(id));
  const withPrompt = new Set(chunks.filter((c) => c.recall_prompt).map((c) => c.id));
  const dueAll = pickDue(store.allLearnerChunks(), new Date(), 10).filter((id) => !newIds.includes(id) && chunkById.has(id));
  const due = [...dueAll.filter((id) => withPrompt.has(id)), ...dueAll.filter((id) => !withPrompt.has(id))].slice(0, 3);
  const twist = episode.twists_pass3[Math.floor(Math.random() * episode.twists_pass3.length)] ?? "";

  const phaseEl = h("span", { class: "phase" });
  const locEl = h("div", { class: "loc" }, ...locationBits(locations[episode.location]));
  const body = h("main", { class: "stagebody" });
  const foot = h("footer", { class: "foot" });
  const exit = btn("خروج", () => endSession(), "btn ghost small");
  root.replaceChildren(
    h("div", { class: "session" }, h("header", { class: "pitch" }, h("div", { class: "pitch-top" }, locEl, phaseEl), h("div", { class: "pitch-bottom" }, ar(episode.mission_ar ?? episode.mission, "mission"), exit)), body, foot),
  );
  S = { attempt: store.startAttempt(episode.id, twist), newIds, knownIds: [...known], twist, unaided: new Set(), reviewed: new Set(), alive: true, mic: new MicBar(), body, foot, phaseEl, locEl };
  sound.playAmbience(locations[episode.location]?.ambience);

  const flow = { skipCorridor: st.skipCorridor || !script.corridor.length, hasRecall: due.length > 0 };
  let phase: Phase = firstPhase(flow);
  try {
    while (phase !== "SAVE" && phase !== "DONE") {
      phaseEl.textContent = PHASE_LABEL_AR[phase];
      if (phase === "RECALL") await phaseRecall(due);
      else if (phase === "CORRIDOR") await phaseCorridor();
      else if (phase === "PASS1_LISTEN") await phasePass1();
      else if (phase === "PASS2_GUIDED") await phasePass2();
      else if (phase === "PASS3_SOLO_TWIST") await liveScene("pass3", "المرحلة ٣ — لحالك + مفاجأة", "نفس المهمة، بدون بطاقات، وفيها مفاجأة. المساعدة بس إذا طلبتها.");
      else if (phase === "DEBRIEF") await phaseDebrief();
      S.attempt.passes_done.push(phase);
      store.updateAttempt(S.attempt);
      stopSpeaking();
      phase = nextPhase(phase, flow);
    }
    // SAVE
    S.attempt.avg_response_ms = store.avgResponseMs(S.attempt.id);
    store.updateAttempt(S.attempt);
    await store.flushTurns(S.attempt.id);
    phaseEl.textContent = PHASE_LABEL_AR.DONE;
    setStage("انحفظت الجلسة");
    S.body.append(ar(S.attempt.success_line ?? ""), ar(store.storageMode === "cloud" ? "تقدّمك محفوظ في حسابك." : "تقدّمك محفوظ في هذا المتصفح.", "muted"));
    S.foot.append(btn("رجوع للرئيسية", () => endSession()));
  } catch (e) {
    if (!(e instanceof Exit)) {
      console.error(e);
      endSession();
    }
  }
}

function endSession() {
  if (S) {
    S.alive = false;
    S.mic.destroy();
    store.updateAttempt(S.attempt);
    void store.flushTurns(S.attempt.id);
  }
  stopSpeaking();
  sound.stopAmbience();
  document.querySelectorAll(".scrim").forEach((n) => n.remove());
  S = null;
  renderHome();
}

// ============================== Home / Notebook / Settings ==============================
function renderHome() {
  const last = store.attempts().find((a) => a.success_line);
  const v = voiceSummary();
  const checks = [
    { ok: v.count > 0 || !!caps.tts, text: v.count > 0 ? `أصوات إسبانية في المتصفح: ${v.count}` : caps.tts ? "أصوات Claude (ما في صوت إسباني في المتصفح)" : "ما في أصوات إسبانية في هذا المتصفح" },
    { ok: !!caps.dictation, text: caps.dictation ? "الميكروفون (إسباني) متوفر" : "الميكروفون مو متوفر هنا — تقدر تكتب، أو تستخدم مايك الكيبورد" },
    { ok: !!caps.sample, text: caps.sample ? "Claude متصل للمرحلة ٣ والخلاصة" : "بدون Claude — المرحلة ٣ بوضع التدريب" },
  ];
  root.replaceChildren(
    h(
      "div",
      { class: "home" },
      h("header", { class: "hero" }, h("p", { class: "kicker", dir: "ltr", lang: "es", text: "Stranger in Madrid" }), h("h1", { text: "غريب في مدريد" }), ar("إسباني شوارع مدريد، من داخل القصة. أنت المدرّب.", "lede")),
      h(
        "section",
        { class: "episode" },
        h("p", { class: "eyebrow", dir: "rtl" }, `الموسم ${episode.season} · الحلقة ${episode.n}`),
        es(episode.title, "es title"),
        ar(episode.mission_ar ?? episode.mission),
        h("ol", { class: "steps", dir: "rtl" }, ...["تذكّر", "الممر", "استمع", "بمساعدة", "لحالك + مفاجأة", "الخلاصة"].map((s) => h("li", { text: s }))),
        btn("ابدأ الحلقة · ~٢٠ دقيقة", () => void runSession(), "btn primary"),
      ),
      h("section", { class: "stats" }, h("div", {}, h("b", { text: String(store.streakDays()) }), ar("أيام متتالية", "muted")), h("div", {}, h("b", { text: String(store.allLearnerChunks().filter((c) => c.state === "transferred").length) }), ar("تقدّم حقيقي", "muted")), last?.success_line ? h("div", { class: "wide" }, ar("آخر نجاح", "muted"), ar(last.success_line)) : null),
      h("ul", { class: "checks" }, ...checks.map((c) => h("li", { class: c.ok ? "ok" : "no", dir: "rtl", text: c.text }))),
      h("div", { class: "row" }, btn("الدفتر", renderNotebook, "btn ghost"), btn("الإعدادات", renderSettings, "btn ghost")),
    ),
  );
}

const STATE_AR: Record<ChunkState, string> = { transferred: "انتقلت (تقدّم حقيقي)", said_alone: "قلتها لحالك", said_helped: "قلتها بمساعدة", heard: "سمعتها", unseen: "ما شفتها" };

function renderNotebook() {
  const lcs = store.allLearnerChunks();
  const sections = (["transferred", "said_alone", "said_helped", "heard"] as ChunkState[]).map((st) => {
    const list = lcs.filter((c) => c.state === st);
    if (!list.length) return null;
    return h(
      "section",
      { class: "card" },
      ar(`${STATE_AR[st]} (${list.length})`, "h3"),
      h(
        "div",
        { class: "chips", dir: "ltr" },
        ...list.map((lc) => {
          const c = chunkById.get(lc.chunk_id);
          return btn(c?.es_written ?? lc.chunk_id, () => {
            if (!c) return;
            sound.unlockAudio();
            setCharacters(chars);
            void chunkSheet(c, (slow) => void speak(c.es_written.replace(/…/g, ""), "you", { slow }));
          }, "chip");
        }),
      ),
    );
  });
  const cb = store.catchBox();
  const errs = store.errorPatterns();
  root.replaceChildren(
    h(
      "div",
      { class: "page" },
      h("div", { class: "row between" }, h("h1", { text: "الدفتر" }), btn("رجوع", renderHome, "btn ghost small")),
      h("section", { class: "card" }, ar(`تقدّم حقيقي: ${lcs.filter((c) => c.state === "transferred").length}`, "h3"), ar("قطعة تنحسب «منتقلة» لما تقولها لحالك في يوم ثاني وموقف جديد.", "muted"), ar(`أيام متتالية: ${store.streakDays()}`)),
      ...sections,
      h("section", { class: "card" }, ar("صندوق الأسئلة", "h3"), ...(cb.length ? cb.map((c) => h("div", { class: "example" }, es(c.word + (c.used ? " ✓" : ""), "es big"), es(`«${c.source_sentence}»`, "muted"))) : [ar("فاضي. في المشهد اضغط «سؤال» على أي كلمة ما فهمتها.", "muted")])),
      h("section", { class: "card" }, ar("الفخاخ (أغلاط تتكرر)", "h3"), ...(errs.length ? errs.map((e) => h("p", { class: "es", dir: "ltr" }, h("s", { text: e.wrong }), ` → ${e.right}  ·  ${e.count}×`)) : [ar("ما في شي للحين.", "muted")])),
      h("section", { class: "card" }, ar("آخر الجلسات", "h3"), ...store.attempts().slice(0, 6).map((a) => ar(`${a.date.slice(0, 10)} · فهمت ${a.self_comprehension ?? "–"}% · تجمّد ${a.freezes} · رد ${a.avg_response_ms ? (a.avg_response_ms / 1000).toFixed(1) + " ث" : "–"}`, "muted"))),
      h("section", { class: "card" }, ar("الطريق", "h3"), ar("الموسم ١ (الوصول) ← الموسم ٢ (الحياة) ← الموسم ٣ (الأصحاب) ← الموسم ٤ (الشارع)"), ar("أنت الحين في الموسم ١.", "muted")),
    ),
  );
}

function choiceRow<T extends string | number>(id: string, value: T, options: [T, string][], onChange: (v: T) => void) {
  const row = h("div", { class: "seg", role: "radiogroup", id });
  for (const [v, label] of options) {
    const b = btn(label, () => {
      onChange(v);
      row.querySelectorAll("button").forEach((x) => x.setAttribute("aria-checked", String(x === b)));
    }, "segbtn");
    b.setAttribute("role", "radio");
    b.setAttribute("aria-checked", String(v === value));
    row.append(b);
  }
  return row;
}

function renderSettings() {
  const st = store.settings();
  const facts = h("textarea", { id: "life-facts", dir: "ltr", lang: "es", rows: "4" }) as HTMLTextAreaElement;
  facts.value = st.lifeFacts.join("\n");
  facts.addEventListener("change", () => store.saveSettings({ lifeFacts: facts.value.split("\n").map((x) => x.trim()).filter(Boolean) }));
  const skip = h("input", { type: "checkbox", id: "skip-corridor" }) as HTMLInputElement;
  skip.checked = st.skipCorridor;
  skip.addEventListener("change", () => store.saveSettings({ skipCorridor: skip.checked }));
  root.replaceChildren(
    h(
      "div",
      { class: "page" },
      h("div", { class: "row between" }, h("h1", { text: "الإعدادات" }), btn("رجوع", renderHome, "btn ghost small")),
      ar("الترجمة على الشاشة", "h3"),
      choiceRow("subs", st.subtitles, [["off", "بدون"], ["street", "شارع"], ["street_meaning", "شارع + معنى"]], (v) => store.saveSettings({ subtitles: v })),
      ar("الضجة (صعوبة السماع)", "h3"),
      choiceRow("noise", st.noise, [["off", "بدون"], ["light", "خفيفة"], ["real", "حقيقية"]], (v) => store.saveSettings({ noise: v })),
      ar("الصوت الخلفي مصنوع بالكمبيوتر وممكن يطلع آلي — خلّه «بدون» لو أزعجك.", "muted"),
      ar("سرعة الأصوات", "h3"),
      choiceRow("speed", st.voiceSpeed, [[0.8, "أبطأ"], [1, "عادي"], [1.15, "شارع"]], (v) => store.saveSettings({ voiceSpeed: v })),
      h("label", { class: "check", for: "skip-corridor", dir: "rtl" }, skip, " تخطَّ الممر دايماً"),
      ar("أشياء من حياتك تتذكرها الشخصيات (سطر لكل معلومة)", "h3"),
      facts,
      ar("كلمة السؤال: الزر «سؤال» يشتغل دايماً. لو تبي تقولها بصوتك، قل «pregunta».", "muted"),
      btn("▶ جرّب الأصوات", () => {
        sound.unlockAudio();
        unlockSpeech();
        setCharacters(chars);
        void (async () => {
          for (const id of ["paco", "carmen", "ramirez", "iker", "dani"]) await speak(`Hola, soy ${chars[id].name}.`, id);
        })();
      }, "btn ghost"),
    ),
  );
}

// ============================== Boot ==============================
async function boot() {
  root.replaceChildren(h("div", { class: "home" }, h("header", { class: "hero" }, h("h1", { text: "غريب في مدريد" }), ar("نجهّز…", "lede"))));
  await Promise.all([bootCaps(), initVoices()]);
  await store.loadModel();
  store.seedKnownChunks(defaultKnown);
  renderHome();
}
void boot();
