// RECALL (≈2 min): a character asks a question that needs last session's due chunks — cold.
import React, { useEffect, useRef, useState } from "react";
import { ScrollView, Text, View } from "react-native";
import { matchLine, type Chunk } from "../../../shared/src";
import { Banner, Btn, HoldToTalk, LineView } from "../components/ui";
import { chunkEvent, chunkReview, logTurn } from "../db";
import { speak } from "../audio/voices";
import { useHoldToTalk, type Utterance } from "../stt";
import { s } from "../theme";
import type { SessionCtx } from "./ctx";

type Outcome = "unaided" | "helped" | "missed";

export function Recall({ ctx, dueIds, onDone }: { ctx: SessionCtx; dueIds: string[]; onDone: () => void }) {
  const items = dueIds.map((id) => ctx.chunkById.get(id)).filter((c): c is Chunk => !!c);
  const [i, setI] = useState(0);
  const [hint, setHint] = useState(0); // 0 none · 1 first word · 2 full
  const [result, setResult] = useState<Outcome | null>(null);
  const tries = useRef(0);
  const chunk = items[i];
  const prompt = chunk?.recall_prompt ?? (chunk ? { speaker: "paco", es: "A ver, crack… ¿cómo se dice?", street: "aber krak… komosedize?", meaning_ar: `كيف تقول: «${chunk.meaning_ar}»؟`, sound_ar: "", expect: [] } : null);

  const talk = useHoldToTalk(onUtterance);

  useEffect(() => {
    if (!prompt) return void onDone();
    tries.current = 0;
    setHint(0);
    setResult(null);
    void speak(prompt.es, prompt.speaker).then(talk.markFloor);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [i]);

  function finish(outcome: Outcome, responseMs?: number | null) {
    setResult(outcome);
    chunkReview(chunk.id, outcome, responseMs ?? undefined);
    ctx.reviewed.add(chunk.id);
    if (outcome !== "missed") chunkEvent(chunk.id, outcome === "unaided" ? { kind: "said_alone", day: new Date().toISOString().slice(0, 10), episodeId: `recall:${chunk.id}` } : { kind: "said_helped" });
  }

  function onUtterance(u: Utterance) {
    if (!chunk || result) return;
    tries.current++;
    const accepted = [...(prompt?.expect ?? []), chunk.es_written.replace(/…/g, "")];
    const m = matchLine(u.transcript, accepted, 0.55);
    logTurn({ attempt_id: ctx.attemptId, pass: "recall", speaker: "you", text: u.transcript, stt_raw: u.transcript, stt_confidence: u.confidence, response_ms: u.responseMs, feedback: m.pass ? "ok" : "miss" });
    if (m.pass) finish(hint === 0 && tries.current === 1 ? "unaided" : hint >= 2 ? "missed" : "helped", u.responseMs);
    else if (hint === 0) setHint(1);
    else if (hint === 1) setHint(2);
  }

  function giveUp() {
    finish("missed");
    void speak(chunk.es_written, "you");
  }

  if (!chunk || !prompt) return null;
  const firstWord = chunk.es_written.split(/\s+/)[0];
  return (
    <ScrollView contentContainerStyle={{ gap: 12, padding: 16 }}>
      <Text style={s.h2}>تذكّر · {i + 1}/{items.length}</Text>
      <LineView line={{ speaker: prompt.speaker, es: prompt.es, street: prompt.street, meaning_ar: prompt.meaning_ar }} chars={ctx.chars} mode={ctx.settings.subtitles} onReplay={() => void speak(prompt.es, prompt.speaker)} />
      {hint >= 1 && !result ? <Banner tone="info"><Text style={s.arText}>تلميح: <Text style={s.esText}>{hint === 1 ? `${firstWord}…` : chunk.es_written}</Text></Text></Banner> : null}
      {result ? (
        <Banner tone={result === "missed" ? "warn" : "ok"}>
          <Text style={s.arText}>{result === "unaided" ? "لحالك! 👏" : result === "helped" ? "بمساعدة بسيطة — زين." : "ما عليه — بترجع لك قريب."}</Text>
          <Text style={s.esBig}>{chunk.es_written}</Text>
          <Text style={s.street}>{chunk.street_spelling}</Text>
        </Banner>
      ) : (
        <HoldToTalk listening={talk.listening} partial={talk.partial} onPressIn={talk.pressIn} onPressOut={talk.pressOut} />
      )}
      <View style={s.rowRtl}>
        {!result ? <Btn ghost label="تلميح" onPress={() => setHint((h) => Math.min(2, h + 1))} style={{ flex: 1 }} /> : null}
        {!result ? <Btn ghost label="قل لي" onPress={giveUp} style={{ flex: 1 }} /> : null}
        {result ? <Btn label={i + 1 < items.length ? "التالي" : "يلا للحلقة"} onPress={() => (i + 1 < items.length ? setI(i + 1) : onDone())} style={{ flex: 1 }} /> : null}
      </View>
    </ScrollView>
  );
}
