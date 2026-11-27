// Live Claude turns (Pass 3 solo + twist, debrief, catch-box review) via our backend.
// Buttons: Hint · Choices · Rewind · سؤال (catch). Corrections ask him to say the whole right sentence once.
import React, { useEffect, useRef, useState } from "react";
import { Modal, Pressable, ScrollView, Text, View, type ScrollViewInstance } from "react-native";
import { matchLine, normalizeWord, type ClaudeTurn, type LiveTurnRequest } from "../../../shared/src";
import { liveTurn } from "../api";
import { ActionRow, Banner, Btn, HoldToTalk, LineView } from "../components/ui";
import { catchAdd, catchBox, errorPatterns, guessErrorTag, logTurn, recordError } from "../db";
import { mixer } from "../audio/mixer";
import { soundZoom, speak, stopSpeaking } from "../audio/voices";
import { useHoldToTalk, type Utterance } from "../stt";
import { colors, es as esDir, s } from "../theme";
import { creditChunks, logCharacterLine, type SessionCtx } from "./ctx";

const MAX_LEARNER_TURNS = 8;
const STALL_MS = 3500;

interface HistItem {
  speaker: string;
  es: string;
  street: string;
  meaning_ar: string;
}

export function LiveScene({ ctx, mode, title, onDone }: { ctx: SessionCtx; mode: LiveTurnRequest["mode"]; title: string; onDone: (last: ClaudeTurn | null) => void }) {
  const [history, setHistory] = useState<HistItem[]>([]);
  const [turn, setTurn] = useState<ClaudeTurn | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hintLevel, setHintLevel] = useState(0);
  const [showChoices, setShowChoices] = useState(false);
  const [sayAgain, setSayAgain] = useState<{ wrong: string; right: string } | null>(null);
  const [catchOpen, setCatchOpen] = useState(false);
  const [note, setNote] = useState<string | null>(null);
  const learnerTurns = useRef(0);
  const stall = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastUtterance = useRef<string | null>(null);
  const scroll = useRef<ScrollViewInstance>(null);
  const talk = useHoldToTalk(onUtterance);

  useEffect(() => {
    void request(null, null);
    return () => {
      stopSpeaking();
      if (stall.current) clearTimeout(stall.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function buildRequest(utterance: string | null, confidence: number | null, hist: HistItem[]): LiveTurnRequest {
    return {
      mode,
      episode_id: ctx.bundle.episode.id,
      twist: mode === "pass3" ? ctx.twist : null,
      // The displayed history ends with his utterance; the API gets it separately as learner_utterance.
      history: (utterance !== null && hist[hist.length - 1]?.speaker === "you" ? hist.slice(0, -1) : hist).map((h) => ({ speaker: h.speaker, text: h.es })),
      learner_utterance: utterance,
      stt_confidence: confidence,
      known_chunk_ids: ctx.knownIds,
      new_chunk_ids: ctx.newIds,
      error_patterns: errorPatterns().map(({ wrong, right, count }) => ({ wrong, right, count })),
      life_facts: ctx.settings.lifeFacts,
      catch_box: mode === "catchbox" ? catchBox(true).slice(0, 3).map((c) => ({ word: c.word, source_sentence: c.source_sentence })) : [],
    };
  }

  async function request(utterance: string | null, confidence: number | null, hist = history) {
    setBusy(true);
    setError(null);
    try {
      const res = await liveTurn(buildRequest(utterance, confidence, hist));
      const t = res.turn;
      setTurn(t);
      setHintLevel(0);
      setShowChoices(false);
      const newHist = [...hist];
      for (const l of t.lines) {
        mixer.playSfx(l.sfx);
        newHist.push({ speaker: l.speaker, es: l.es, street: l.street, meaning_ar: l.meaning_ar });
        setHistory([...newHist]);
        await speak(l.es, l.speaker);
        logCharacterLine(ctx, mode, l.speaker, l.es);
      }
      if (t.feedback.type === "correct_now" && t.feedback.right) {
        recordError(t.feedback.wrong, t.feedback.right, guessErrorTag(t.feedback.wrong, t.feedback.right));
        if (t.feedback.say_again) setSayAgain({ wrong: t.feedback.wrong, right: t.feedback.right });
      }
      for (const w of t.catch_box_add) catchAdd({ word: w, source_sentence: lastUtterance.current ?? t.lines[0]?.es ?? "", speaker: t.lines[0]?.speaker ?? "", moment: `${ctx.bundle.episode.id}:${mode}` });
      if (t.end_scene || learnerTurns.current >= MAX_LEARNER_TURNS) return onDone(t);
      if (t.await_learner) {
        talk.markFloor();
        if (mode === "pass3") {
          if (stall.current) clearTimeout(stall.current);
          stall.current = setTimeout(() => {
            // Stalled ~3 s: offer the 3 choices (a freeze is never a mistake).
            ctx.stats.freezes++;
            setShowChoices(true);
          }, STALL_MS);
        }
      }
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  function onUtterance(u: Utterance) {
    if (stall.current) clearTimeout(stall.current);
    const text = u.transcript.trim();
    if (!text) return setNote("ما سمعتك — اضغط مطولاً وتكلّم.");
    setNote(null);

    // Catch word said aloud (set it to a Spanish word, e.g. «pregunta», for the es-ES recognizer).
    const cw = normalizeWord(ctx.settings.catchWord);
    if (cw && text.split(/\s+/).map(normalizeWord).includes(cw)) {
      setCatchOpen(true);
      return;
    }

    if (sayAgain) {
      const m = matchLine(text, [sayAgain.right]);
      logTurn({ attempt_id: ctx.attemptId, pass: mode, speaker: "you", text, stt_raw: u.transcript, stt_confidence: u.confidence, response_ms: u.responseMs, feedback: m.pass ? "say_again_ok" : "say_again_try" });
      setNote(m.pass ? "تمام 👌 نكمل." : `الصح: ${sayAgain.right} — نكمل.`);
      creditChunks(ctx, text, true, u.responseMs);
      setSayAgain(null);
      talk.markFloor();
      return;
    }

    const aided = hintLevel > 0 || showChoices;
    creditChunks(ctx, text, aided, u.responseMs);
    logTurn({ attempt_id: ctx.attemptId, pass: mode, speaker: "you", text, stt_raw: u.transcript, stt_confidence: u.confidence, response_ms: u.responseMs, feedback: aided ? "aided" : null });
    learnerTurns.current++;
    lastUtterance.current = text;
    const hist = [...history, { speaker: "you", es: text, street: "", meaning_ar: "" }];
    setHistory(hist);
    void request(text, u.confidence, hist);
  }

  async function rewind() {
    // Replay the last exchange with the smallest useful hint.
    const last = turn?.lines ?? [];
    for (const l of last) await speak(l.es, l.speaker);
    setHintLevel((h) => Math.max(h, 1));
    talk.markFloor();
  }

  function addCatch(word: string, line: HistItem) {
    catchAdd({ word, source_sentence: line.es, speaker: line.speaker, moment: `${ctx.bundle.episode.id}:${mode}` });
    ctx.stats.askedMeaning++;
    setCatchOpen(false);
    setNote(`«${word}» في صندوق الأسئلة — نراجعها في الخلاصة.`);
  }

  const lastCharLine = [...history].reverse().find((h) => h.speaker !== "you") ?? null;
  return (
    <View style={{ flex: 1 }}>
      <ScrollView ref={scroll} onContentSizeChange={() => scroll.current?.scrollToEnd({ animated: true })} contentContainerStyle={{ gap: 10, padding: 16 }}>
        <Text style={s.h2}>{title}</Text>
        {mode === "pass3" ? <Text style={s.arMuted}>نفس المهمة، بدون بطاقات، وفيها مفاجأة. المساعدة بس إذا طلبتها.</Text> : null}
        {history.map((h, n) =>
          h.speaker === "you" ? (
            <View key={n} style={{ alignSelf: "flex-start", backgroundColor: colors.okSoft, padding: 10, borderRadius: 12, maxWidth: "85%" }}>
              <Text style={s.esText}>{h.es}</Text>
            </View>
          ) : (
            <LineView key={n} line={h} chars={ctx.chars} mode={ctx.settings.subtitles} onReplay={() => void speak(h.es, h.speaker)} onZoom={() => void soundZoom(h.es, h.speaker)} />
          ),
        )}
        {sayAgain ? (
          <Banner tone="warn">
            <Text style={s.arText}>قلها كاملة مرة وحدة:</Text>
            <Text style={[s.esText, { textDecorationLine: "line-through", color: colors.muted }]}>{sayAgain.wrong}</Text>
            <Text style={s.esBig}>{sayAgain.right}</Text>
          </Banner>
        ) : null}
        {turn?.hint && hintLevel > 0 ? (
          <Banner tone="info">
            <Text style={s.arMuted}>تلميح</Text>
            <Text style={s.esBig}>{hintLevel === 1 ? turn.hint.first_words : turn.hint.full}</Text>
            {hintLevel > 1 ? <Text style={s.street}>{turn.hint.street}</Text> : null}
          </Banner>
        ) : null}
        {showChoices && turn?.choices.length ? (
          <View style={{ gap: 6 }}>
            <Text style={s.arMuted}>اختر وحدة وقلها بصوتك كاملة:</Text>
            {turn.choices.map((c, n) => (
              <Pressable key={n} onPress={() => void speak(c.es, "you")} style={[s.card, { paddingVertical: 10 }]}>
                <Text style={s.esText}>{c.es}</Text>
                <Text style={s.street}>{c.street}</Text>
              </Pressable>
            ))}
          </View>
        ) : null}
        {note ? <Text style={s.arMuted}>{note}</Text> : null}
        {error ? (
          <Banner tone="warn">
            <Text style={s.arText}>ما قدرنا نوصل للسيرفر.</Text>
            <Text style={[s.arMuted, esDir]}>{error}</Text>
            <Btn label="جرّب مرة ثانية" onPress={() => void request(lastUtterance.current, null)} />
          </Banner>
        ) : null}
      </ScrollView>
      <View style={{ padding: 16, gap: 10 }}>
        <HoldToTalk disabled={busy} listening={talk.listening} partial={talk.partial} onPressIn={talk.pressIn} onPressOut={talk.pressOut} />
        <ActionRow
          items={[
            { label: "تلميح", onPress: () => setHintLevel((h) => Math.min(2, h + 1)), disabled: !turn?.hint },
            { label: "خيارات", onPress: () => setShowChoices(true), disabled: !turn?.choices.length, highlight: showChoices },
            { label: "إرجاع", onPress: () => void rewind(), disabled: !turn },
            { label: ctx.settings.catchWord || "سؤال", onPress: () => setCatchOpen(true), disabled: !lastCharLine },
          ]}
        />
        <Btn ghost label="أنهِ المشهد" onPress={() => onDone(turn)} />
      </View>

      <Modal visible={catchOpen} transparent animationType="fade" onRequestClose={() => setCatchOpen(false)}>
        <View style={{ flex: 1, justifyContent: "center", backgroundColor: "rgba(0,0,0,0.35)", padding: 20 }}>
          <View style={[s.card, { gap: 10 }]}>
            <Text style={s.h2}>أي كلمة؟</Text>
            <Text style={s.arMuted}>اضغط على الكلمة اللي ما فهمتها — المشهد يكمل، ونراجعها في الخلاصة.</Text>
            <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6 }}>
              {(lastCharLine?.es ?? "")
                .split(/\s+/)
                .filter(Boolean)
                .map((w, n) => {
                  const clean = w.replace(/[¡!¿?.,;:…«»"]/g, "");
                  return clean ? (
                    <Pressable key={n} onPress={() => lastCharLine && addCatch(clean, lastCharLine)} style={{ paddingHorizontal: 10, paddingVertical: 6, borderRadius: 8, backgroundColor: colors.accentSoft }}>
                      <Text style={s.esText}>{clean}</Text>
                    </Pressable>
                  ) : null;
                })}
            </View>
            <Btn ghost label="إلغاء" onPress={() => setCatchOpen(false)} />
          </View>
        </View>
      </Modal>
    </View>
  );
}
