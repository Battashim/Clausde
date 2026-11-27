// Tiny DOM helpers + shared widgets (Arabic RTL shell, Spanish LTR content).
import type { Character, Chunk } from "../../shared/src";
import { caps } from "./platform";
import { stopSpeaking } from "./voice";
import type { SubtitleMode } from "./store";

type Child = Node | string | null | undefined | false;
export function h<K extends keyof HTMLElementTagNameMap>(tag: K, attrs: Record<string, unknown> = {}, ...children: Child[]): HTMLElementTagNameMap[K] {
  const el = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (v === undefined || v === null || v === false) continue;
    if (k.startsWith("on") && typeof v === "function") el.addEventListener(k.slice(2).toLowerCase(), v as EventListener);
    else if (k === "class") el.className = String(v);
    else if (k === "text") el.textContent = String(v);
    else el.setAttribute(k, v === true ? "" : String(v));
  }
  for (const c of children) if (c !== null && c !== undefined && c !== false) el.append(c instanceof Node ? c : document.createTextNode(c));
  return el;
}

/** Spanish text: always LTR inside the RTL page. */
export const es = (text: string, cls = "es") => h("p", { class: cls, dir: "ltr", lang: "es", text });
export const ar = (text: string, cls = "ar") => h("p", { class: cls, dir: "rtl", lang: "ar", text });

/** "سِ**دي**ثِ" → stressed syllable highlighted. */
export function stress(text: string, cls = "sound") {
  const p = h("p", { class: cls, dir: "rtl", lang: "ar" });
  text.split(/\*\*(.+?)\*\*/g).forEach((part, i) => p.append(i % 2 ? h("b", { text: part }) : document.createTextNode(part)));
  return p;
}

export function btn(label: string, onClick: (e: MouseEvent) => void, cls = "btn") {
  return h("button", { class: cls, type: "button", onClick }, label);
}

export function nameTag(c: Character | undefined) {
  if (!c) return h("div");
  const dot = h("span", { class: "dot", text: c.initials });
  dot.style.background = c.color;
  const name = h("span", { class: "who", text: c.id === "you" ? "أنت" : c.name });
  name.style.color = `color-mix(in oklab, ${c.color} 70%, var(--fg))`;
  return h("div", { class: "tag" }, dot, name);
}

export interface ShownLine {
  speaker: string;
  es: string;
  street: string;
  meaning_ar: string;
}

export function lineCard(l: ShownLine, chars: Record<string, Character>, mode: SubtitleMode, o: { dim?: boolean; onReplay?: () => void; onZoom?: () => void; force?: boolean } = {}) {
  const show = o.force ? "street_meaning" : mode;
  const card = h("div", { class: `line${o.dim ? " dim" : ""}${l.speaker === "you" ? " mine" : ""}`, role: "button", tabindex: "0", title: "اضغط لإعادة السماع" });
  card.append(nameTag(chars[l.speaker]));
  if (show === "off") card.append(ar("اضغط لإعادة السماع · ضغطتين للتقطيع", "muted"));
  else {
    card.append(es(l.es, "es big"));
    if (l.street) card.append(es(l.street, "street"));
    if (show === "street_meaning" && l.meaning_ar) card.append(ar(l.meaning_ar));
  }
  card.addEventListener("click", () => o.onReplay?.());
  card.addEventListener("dblclick", (e) => {
    e.preventDefault();
    o.onZoom?.();
  });
  return card;
}

/** 4-layer chunk card as a bottom sheet; resolves when closed. */
export function chunkSheet(c: Chunk, onPlay: (slow: boolean) => void): Promise<void> {
  return new Promise((resolve) => {
    const close = () => {
      wrap.remove();
      resolve();
    };
    const sheet = h(
      "div",
      { class: "sheet", role: "dialog", "aria-label": c.es_written },
      ar("قطعة جديدة", "eyebrow"),
      es(c.es_written, "es huge"),
      ar(c.meaning_ar, "ar strong"),
      es(c.meaning_en, "muted"),
      es(c.street_spelling, "street big"),
      stress(c.sound_ar, "sound big"),
      c.notes_ar ? ar(`ملاحظة: ${c.notes_ar}`, "muted") : null,
      ...c.examples.slice(0, 2).map((e) => h("div", { class: "example" }, es(e.es), es(e.street, "street"), ar(e.ar, "muted"))),
      h("div", { class: "row" }, btn("▶ واضح", () => onPlay(true), "btn ghost"), btn("▶ شارع", () => onPlay(false), "btn ghost"), btn("تمام", close)),
    );
    const wrap = h("div", { class: "scrim", onClick: (e: Event) => e.target === wrap && close() }, sheet);
    document.body.append(wrap);
  });
}

export function banner(tone: "ok" | "warn" | "info", ...children: Child[]) {
  return h("div", { class: `banner ${tone}` }, ...children);
}

// ---------------- microphone ----------------
export interface Utterance {
  transcript: string;
  confidence: number | null;
  responseMs: number | null;
  typed: boolean;
}

/**
 * Talk bar: tap the mic to start, tap again when you're done (no automatic cut-off), plus a typed
 * fallback (also works with the phone keyboard's own dictation). Speech is recognized in Spanish.
 */
export class MicBar {
  el: HTMLElement;
  onUtterance: (u: Utterance) => void = () => {};
  private mic: HTMLButtonElement;
  private live: HTMLElement;
  private input: HTMLInputElement;
  private state: "idle" | "starting" | "listening" | "finishing" = "idle";
  private finals: string[] = [];
  private partial = "";
  private floorAt: number | null = null;
  private pressedAt: number | null = null;
  private enabled = true;
  private unsub: (() => void)[] = [];
  private micOff = !caps.dictation;

  constructor() {
    this.mic = h("button", { class: "mic", type: "button", "aria-label": "تكلّم" }, h("span", { class: "mic-ico", "aria-hidden": "true" }), h("span", { class: "mic-label", text: "اضغط وتكلّم" }));
    this.mic.addEventListener("click", () => this.toggle());
    this.live = h("p", { class: "es partial", dir: "ltr", lang: "es", "aria-live": "polite" });
    this.input = h("input", { class: "type", dir: "ltr", lang: "es", type: "text", placeholder: "أو اكتب بالإسباني…", autocomplete: "off", autocapitalize: "off", id: "typed-reply" }) as HTMLInputElement;
    const send = btn("أرسل", () => this.sendTyped(), "btn small");
    this.input.addEventListener("keydown", (e) => {
      if (e.key === "Enter") this.sendTyped();
    });
    this.el = h("div", { class: "micbar" }, this.live, this.micOff ? null : this.mic, h("div", { class: "typed" }, this.input, send));
    const d = caps.dictation;
    if (d) {
      this.unsub.push(d.onPartial(({ text }: { text: string }) => this.showPartial(text)));
      this.unsub.push(d.onFinal(({ text }: { text: string }) => this.finals.push(text)));
      this.unsub.push(
        d.onState(({ state, reason }: { state: MicBar["state"]; reason?: string }) => {
          this.state = state;
          this.paint();
          if (state === "idle") {
            if (reason === "not_granted" || reason === "unavailable") this.disableMic(reason);
            this.deliver();
          }
        }),
      );
    }
    this.paint();
  }

  private showPartial(text: string) {
    this.partial = text;
    this.live.textContent = [...this.finals, text].join("").trim();
  }

  private paint() {
    const on = this.state !== "idle";
    this.mic.classList.toggle("on", on);
    this.mic.disabled = !this.enabled && !on;
    (this.mic.querySelector(".mic-label") as HTMLElement).textContent = on ? (this.state === "listening" ? "أسمعك… اضغط لما تخلّص" : "لحظة…") : "اضغط وتكلّم";
  }

  private disableMic(reason: string) {
    this.micOff = true;
    this.mic.remove();
    this.live.textContent = reason === "not_granted" ? "الميكروفون مقفول — اكتب ردّك (أو استخدم مايك الكيبورد)." : "التعرّف على الصوت مو متوفر هنا — اكتب ردّك.";
  }

  private toggle() {
    const d = caps.dictation;
    if (!d) return;
    if (this.state === "idle") {
      if (!this.enabled) return;
      stopSpeaking();
      this.finals = [];
      this.partial = "";
      this.live.textContent = "";
      this.pressedAt = Date.now();
      // Called synchronously from the tap, as the platform requires. Spanish only.
      d.start({ language: "es" }).catch((e: { code?: string }) => {
        if (e.code === "not_granted" || e.code === "unavailable") this.disableMic(e.code);
        else if (e.code === "rate_limited") this.live.textContent = "الميكروفون مشغول، جرّب بعد شوي.";
      });
    } else void d.stop();
  }

  private deliver() {
    const text = [...this.finals, this.partial].join("").trim();
    this.finals = [];
    this.partial = "";
    if (!text) return;
    this.emit(text, false);
  }

  private sendTyped() {
    const text = this.input.value.trim();
    if (!text || !this.enabled) return;
    this.input.value = "";
    this.pressedAt = Date.now();
    this.emit(text, true);
  }

  private emit(text: string, typed: boolean) {
    const responseMs = this.floorAt && this.pressedAt ? this.pressedAt - this.floorAt : null;
    this.floorAt = null;
    this.live.textContent = text;
    this.onUtterance({ transcript: text, confidence: null, responseMs, typed });
  }

  /** A character just handed him the floor: start the response-time clock. */
  markFloor() {
    this.floorAt = Date.now();
  }

  setEnabled(on: boolean) {
    this.enabled = on;
    this.input.disabled = !on;
    this.paint();
  }

  setNote(text: string) {
    this.live.textContent = text;
  }

  destroy() {
    if (this.state !== "idle") void caps.dictation?.stop();
    this.unsub.forEach((u) => u());
  }
}
