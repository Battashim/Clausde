// Notebook: chunks by state, catch box, error traps, streak, and "real progress" = transfers.
import React, { useMemo, useState } from "react";
import { ScrollView, Text, View } from "react-native";
import type { Chunk, ChunkState } from "../../../shared/src";
import { kvGet, allLearnerChunks, attempts, catchBox, errorPatterns, streakDays } from "../db";
import type { EpisodeBundle } from "../api";
import { Btn, ChunkCard } from "../components/ui";
import { speak } from "../audio/voices";
import { colors, s } from "../theme";

const STATE_AR: Record<ChunkState, string> = {
  transferred: "انتقلت (تقدّم حقيقي)",
  said_alone: "قلتها لحالك",
  said_helped: "قلتها بمساعدة",
  heard: "سمعتها",
  unseen: "ما شفتها",
};

export function NotebookScreen({ onBack }: { onBack: () => void }) {
  const bundle = kvGet<EpisodeBundle>("bundle:s1e6");
  const byId = useMemo(() => new Map((bundle?.chunks ?? []).map((c) => [c.id, c])), [bundle]);
  const lcs = allLearnerChunks();
  const [card, setCard] = useState<Chunk | null>(null);
  const transfers = lcs.filter((c) => c.state === "transferred").length;
  const recent = attempts().slice(0, 5);

  return (
    <View style={s.screen}>
      <ScrollView contentContainerStyle={{ padding: 16, gap: 14 }}>
        <View style={s.rowRtl}>
          <Text style={[s.h1, { flex: 1 }]}>الدفتر</Text>
          <Btn ghost label="رجوع" onPress={onBack} />
        </View>

        <View style={[s.card, { gap: 4 }]}>
          <Text style={s.h2}>تقدّم حقيقي: {transfers}</Text>
          <Text style={s.arMuted}>قطعة تنحسب «منتقلة» لما تقولها لحالك في يوم ثاني وموقف جديد.</Text>
          <Text style={s.arText}>🔥 أيام متتالية: {streakDays()}</Text>
        </View>

        {(["transferred", "said_alone", "said_helped", "heard"] as ChunkState[]).map((st) => {
          const list = lcs.filter((c) => c.state === st);
          if (!list.length) return null;
          return (
            <View key={st} style={{ gap: 6 }}>
              <Text style={s.h2}>{STATE_AR[st]} ({list.length})</Text>
              <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6 }}>
                {list.map((lc) => {
                  const c = byId.get(lc.chunk_id);
                  return (
                    <Text key={lc.chunk_id} onPress={() => c && setCard(c)} style={{ backgroundColor: colors.card, borderWidth: 1, borderColor: colors.line, borderRadius: 8, paddingHorizontal: 10, paddingVertical: 6, ...s.esText }}>
                      {c?.es_written ?? lc.chunk_id}
                    </Text>
                  );
                })}
              </View>
            </View>
          );
        })}

        <View style={[s.card, { gap: 6 }]}>
          <Text style={s.h2}>صندوق الأسئلة</Text>
          {catchBox().length ? (
            catchBox().map((c) => (
              <View key={c.word} style={{ borderTopWidth: 1, borderColor: colors.line, paddingTop: 6 }}>
                <Text style={s.esBig}>{c.word}{c.used ? " ✓" : ""}</Text>
                <Text style={[s.esText, { color: colors.muted }]}>«{c.source_sentence}»</Text>
              </View>
            ))
          ) : (
            <Text style={s.arMuted}>فاضي. في المشهد اضغط «سؤال» على أي كلمة ما فهمتها.</Text>
          )}
        </View>

        <View style={[s.card, { gap: 6 }]}>
          <Text style={s.h2}>الفخاخ (أغلاط تتكرر)</Text>
          {errorPatterns().length ? (
            errorPatterns().map((e) => (
              <View key={e.wrong + e.right} style={s.rowRtl}>
                <Text style={s.arMuted}>{e.count}×</Text>
                <Text style={[s.esText, { flex: 1 }]}>
                  <Text style={{ textDecorationLine: "line-through", color: colors.muted }}>{e.wrong}</Text> → {e.right}
                </Text>
              </View>
            ))
          ) : (
            <Text style={s.arMuted}>ما في شي للحين.</Text>
          )}
        </View>

        <View style={[s.card, { gap: 6 }]}>
          <Text style={s.h2}>آخر الجلسات</Text>
          {recent.map((a) => (
            <Text key={a.id} style={s.arMuted}>
              {a.date.slice(0, 10)} · {a.episode_id} · فهمت {a.self_comprehension ?? "–"}% · تجمّد {a.freezes} · رد {a.avg_response_ms ? `${(a.avg_response_ms / 1000).toFixed(1)} ث` : "–"}
            </Text>
          ))}
        </View>

        <View style={[s.card, { gap: 4 }]}>
          <Text style={s.h2}>الطريق</Text>
          <Text style={s.arText}>الموسم ١ (الوصول) ← الموسم ٢ (الحياة) ← الموسم ٣ (الأصحاب) ← الموسم ٤ (الشارع)</Text>
          <Text style={s.arMuted}>أنت الحين في الموسم ١.</Text>
        </View>
      </ScrollView>
      <ChunkCard chunk={card} visible={!!card} onClose={() => setCard(null)} onPlay={(slow) => card && void speak(card.es_written.replace(/…/g, ""), "you", { slow })} />
    </View>
  );
}
