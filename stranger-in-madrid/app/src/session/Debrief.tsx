// DEBRIEF (≈2 min): Paco asks «¿Qué tal hoy? ¿Qué le dijiste…?» → retell → catch-box review →
// ONE concrete success in plain words → «¿Cuánto entendiste: 50, 70 o 90?» → next time (max 2).
import React, { useState } from "react";
import { ScrollView, Text, View } from "react-native";
import type { ClaudeTurn } from "../../../shared/src";
import { Banner, Btn } from "../components/ui";
import { catchBox, catchUsed } from "../db";
import { s } from "../theme";
import type { SessionCtx } from "./ctx";
import { LiveScene } from "./LiveScene";

type Step = "retell" | "catchbox" | "summary";

export function Debrief({ ctx, onDone }: { ctx: SessionCtx; onDone: (selfComprehension: number) => void }) {
  const [step, setStep] = useState<Step>("retell");
  const [outcome, setOutcome] = useState<ClaudeTurn["debrief"]>(null);

  if (step === "retell")
    return (
      <LiveScene
        ctx={ctx}
        mode="debrief"
        title="الخلاصة — في قهوة باكو"
        onDone={(t) => {
          setOutcome(t?.debrief ?? null);
          setStep(catchBox(true).length ? "catchbox" : "summary");
        }}
      />
    );

  if (step === "catchbox")
    return (
      <LiveScene
        ctx={ctx}
        mode="catchbox"
        title="صندوق الأسئلة"
        onDone={(t) => {
          for (const c of catchBox(true).slice(0, 3)) catchUsed(c.word, null);
          if (!outcome && t?.debrief) setOutcome(t.debrief);
          setStep("summary");
        }}
      />
    );

  // Fallback success line built from what actually happened, if Claude didn't give one.
  const unaided = [...ctx.stats.unaidedChunks].map((id) => ctx.chunkById.get(id)?.es_written).filter(Boolean);
  const success = outcome?.success_line_ar || (unaided.length ? `قلت «${unaided[0]}» لحالك، بدون مساعدة.` : "كمّلت المشهد كامل للآخر.");
  ctx.stats.successLine = success;

  return (
    <ScrollView contentContainerStyle={{ gap: 14, padding: 16 }}>
      <Text style={s.h1}>خلصنا اليوم</Text>
      <Banner tone="ok">
        <Text style={s.arMuted}>نجاح اليوم</Text>
        <Text style={[s.arText, { fontSize: 18, fontWeight: "700" }]}>{success}</Text>
      </Banner>
      {outcome?.next_time_ar?.length ? (
        <View style={[s.card, { gap: 4 }]}>
          <Text style={s.h2}>المرة الجاية</Text>
          {outcome.next_time_ar.slice(0, 2).map((n, i) => (
            <Text key={i} style={s.arText}>• {n}</Text>
          ))}
        </View>
      ) : null}
      <Text style={s.h2}>¿Cuánto entendiste? — كم فهمت؟</Text>
      <View style={s.rowRtl}>
        {[50, 70, 90].map((p) => (
          <Btn key={p} label={`${p}%`} onPress={() => onDone(p)} style={{ flex: 1 }} />
        ))}
      </View>
    </ScrollView>
  );
}
