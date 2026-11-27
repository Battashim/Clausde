// PASS 2 — GUIDED: characters speak; on his turns the line card is shown and he says his line.
// Fuzzy match (STT noise tolerated). Light correction only.
import React, { useEffect, useRef, useState } from "react";
import { ScrollView, Text, View, type ScrollViewInstance } from "react-native";
import { matchLine } from "../../../shared/src";
import { Banner, Btn, HoldToTalk, LineView, StressText } from "../components/ui";
import { logTurn, recordError } from "../db";
import { mixer } from "../audio/mixer";
import { soundZoom, speak, stopSpeaking } from "../audio/voices";
import { useHoldToTalk, type Utterance } from "../stt";
import { colors, s } from "../theme";
import { creditChunks, logCharacterLine, type SessionCtx } from "./ctx";

export function Pass2({ ctx, onDone }: { ctx: SessionCtx; onDone: () => void }) {
  const lines = ctx.bundle.script.lines;
  const [i, setI] = useState(0);
  const [waiting, setWaiting] = useState(false);
  const [msg, setMsg] = useState<{ tone: "ok" | "warn"; text: string } | null>(null);
  const [trap, setTrap] = useState<{ wrong: string; right: string } | null>(null);
  const tries = useRef(0);
  const scroll = useRef<ScrollViewInstance>(null);
  const talk = useHoldToTalk(onUtterance);

  useEffect(() => () => stopSpeaking(), []);

  useEffect(() => {
    if (i >= lines.length) return;
    const l = lines[i];
    let cancelled = false;
    if (l.speaker === "you") {
      tries.current = 0;
      setWaiting(true);
      talk.markFloor();
      return;
    }
    (async () => {
      mixer.playSfx(l.sfx);
      await speak(l.es, l.speaker);
      if (cancelled) return;
      logCharacterLine(ctx, "pass2", l.speaker, l.es);
      if (l.trap) setTrap(l.trap);
      setI((n) => n + 1);
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [i]);

  function onUtterance(u: Utterance) {
    const l = lines[i];
    if (!l || l.speaker !== "you") return;
    tries.current++;
    const m = matchLine(u.transcript, [l.es, ...(l.accept ?? [])]);
    logTurn({ attempt_id: ctx.attemptId, pass: "pass2", speaker: "you", text: u.transcript, stt_raw: u.transcript, stt_confidence: u.confidence, response_ms: u.responseMs, feedback: m.pass ? "ok" : "retry" });
    if (m.pass) {
      creditChunks(ctx, u.transcript, true, u.responseMs);
      if (trap) {
        setMsg({ tone: "ok", text: `صححت لداني: «${trap.right}» 👌` });
        setTrap(null);
      } else setMsg({ tone: "ok", text: "زين!" });
      setWaiting(false);
      setI((n) => n + 1);
    } else if (tries.current < 2) {
      setMsg({ tone: "warn", text: "قريبة — اسمعها وقلها مرة ثانية." });
      void speak(l.es, "you").then(talk.markFloor);
    } else {
      // Light correction: no third attempt, the scene goes on.
      if (trap) recordError(trap.wrong, trap.right, "other");
      setMsg({ tone: "warn", text: "ما عليه، نكمل. بترجع لك في المرحلة ٣." });
      setWaiting(false);
      setI((n) => n + 1);
    }
  }

  const current = lines[i];
  const done = i >= lines.length;
  return (
    <View style={{ flex: 1 }}>
      <ScrollView ref={scroll} onContentSizeChange={() => scroll.current?.scrollToEnd({ animated: true })} contentContainerStyle={{ gap: 10, padding: 16 }}>
        <Text style={s.h2}>المرحلة ٢ — بمساعدة</Text>
        {lines.slice(0, i).map((l, n) => (
          <LineView key={n} line={l} chars={ctx.chars} mode={ctx.settings.subtitles} dim onReplay={() => void speak(l.es, l.speaker)} onZoom={() => void soundZoom(l.es, l.speaker)} />
        ))}
        {trap && waiting ? (
          <Banner tone="warn">
            <Text style={s.arText}>في غلط في كلام اللاعب! صحّحه له.</Text>
          </Banner>
        ) : null}
        {waiting && current ? (
          <View style={[s.card, { gap: 6, borderColor: colors.accent, borderWidth: 2 }]}>
            <Text style={s.arMuted}>دورك — قل:</Text>
            <Text style={[s.esBig, { fontSize: 26 }]}>{current.es}</Text>
            <Text style={s.street}>{current.street}</Text>
            <StressText text={current.sound_ar} />
            <Text style={s.arText}>{current.meaning_ar}</Text>
          </View>
        ) : null}
        {msg ? (
          <Banner tone={msg.tone}>
            <Text style={s.arText}>{msg.text}</Text>
          </Banner>
        ) : null}
      </ScrollView>
      <View style={{ padding: 16, gap: 10 }}>
        {done ? (
          <Btn label="يلا للمرحلة ٣ — لحالك" onPress={onDone} />
        ) : (
          <>
            <HoldToTalk disabled={!waiting} listening={talk.listening} partial={talk.partial} onPressIn={talk.pressIn} onPressOut={talk.pressOut} />
            {waiting && current ? <Btn ghost label="▶ اسمع جملتي" onPress={() => void speak(current.es, "you")} /> : null}
          </>
        )}
      </View>
    </View>
  );
}
