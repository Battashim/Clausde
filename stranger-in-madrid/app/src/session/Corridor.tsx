// CORRIDOR (2–3 min, optional): build today's mission sentences piece by piece. Skippable.
import React, { useEffect, useState } from "react";
import { ScrollView, Text, View } from "react-native";
import { matchLine } from "../../../shared/src";
import { Banner, Btn, HoldToTalk, StressText } from "../components/ui";
import { logTurn } from "../db";
import { speak } from "../audio/voices";
import { useHoldToTalk, type Utterance } from "../stt";
import { colors, s } from "../theme";
import type { SessionCtx } from "./ctx";

export function Corridor({ ctx, onDone }: { ctx: SessionCtx; onDone: () => void }) {
  const steps = ctx.bundle.script.corridor;
  const [g, setG] = useState(0);
  const [k, setK] = useState(0);
  const [ok, setOk] = useState<boolean | null>(null);
  const group = steps[g] ?? [];
  const step = group[k];
  const talk = useHoldToTalk(onUtterance);

  useEffect(() => {
    if (!step) return void onDone();
    setOk(null);
    void speak(step.es, "you").then(talk.markFloor);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [g, k]);

  function onUtterance(u: Utterance) {
    const m = matchLine(u.transcript, [step.es]);
    logTurn({ attempt_id: ctx.attemptId, pass: "corridor", speaker: "you", text: u.transcript, stt_raw: u.transcript, stt_confidence: u.confidence, response_ms: u.responseMs, feedback: m.pass ? "ok" : "retry" });
    setOk(m.pass);
    if (!m.pass) void speak(step.es, "you", { slow: true });
  }

  function next() {
    if (k + 1 < group.length) setK(k + 1);
    else if (g + 1 < steps.length) {
      setG(g + 1);
      setK(0);
    } else onDone();
  }

  if (!step) return null;
  return (
    <ScrollView contentContainerStyle={{ gap: 12, padding: 16 }}>
      <Text style={s.h2}>الممر · جملة {g + 1}/{steps.length}</Text>
      <Text style={s.arMuted}>نبني الجملة قطعة قطعة. اسمع، وقلها بصوتك.</Text>
      {group.slice(0, k).map((p, i) => (
        <Text key={i} style={[s.esText, { color: colors.muted }]}>{p.es}</Text>
      ))}
      <View style={[s.card, { gap: 6 }]}>
        <Text style={[s.esBig, { fontSize: 26 }]}>{step.es}</Text>
        <Text style={s.street}>{step.street}</Text>
        <StressText text={step.sound_ar} />
        <Text style={s.arText}>{step.meaning_ar}</Text>
      </View>
      {ok === true ? <Banner tone="ok"><Text style={s.arText}>تمام!</Text></Banner> : ok === false ? <Banner tone="warn"><Text style={s.arText}>اسمعها مرة ثانية وجرّب — أو كمّل.</Text></Banner> : null}
      <HoldToTalk listening={talk.listening} partial={talk.partial} onPressIn={talk.pressIn} onPressOut={talk.pressOut} />
      <View style={s.rowRtl}>
        <Btn label="التالي" onPress={next} style={{ flex: 1 }} />
        <Btn ghost label="▶ اسمع" onPress={() => void speak(step.es, "you")} style={{ flex: 1 }} />
        <Btn ghost label="تخطَّ الممر" onPress={onDone} style={{ flex: 1 }} />
      </View>
    </ScrollView>
  );
}
