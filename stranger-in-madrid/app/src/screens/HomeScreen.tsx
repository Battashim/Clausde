import React, { useEffect, useState } from "react";
import { ScrollView, Text, View } from "react-native";
import { health, loadEpisode, type EpisodeBundle } from "../api";
import { Banner, Btn } from "../components/ui";
import { attempts, seedKnownChunks, streakDays } from "../db";
import { voiceCount } from "../audio/voices";
import { colors, s } from "../theme";

export function HomeScreen({ onPlay, onNotebook, onSettings }: { onPlay: (b: EpisodeBundle, offline: boolean) => void; onNotebook: () => void; onSettings: () => void }) {
  const [bundle, setBundle] = useState<EpisodeBundle | null>(null);
  const [offline, setOffline] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [brain, setBrain] = useState<string | null>(null);
  const last = attempts()[0];

  async function load() {
    setErr(null);
    try {
      const r = await loadEpisode("s1e6");
      seedKnownChunks(r.bundle.default_known_chunk_ids);
      setBundle(r.bundle);
      setOffline(r.offline);
      health().then((h) => setBrain(h.brain)).catch(() => setBrain(null));
    } catch (e) {
      setErr((e as Error).message);
    }
  }

  useEffect(() => {
    void load();
  }, []);

  return (
    <ScrollView style={s.screen} contentContainerStyle={{ padding: 16, gap: 14 }}>
      <Text style={[s.h1, { fontSize: 28 }]}>غريب في مدريد</Text>
      <Text style={[s.arMuted, { marginTop: -8 }]}>Stranger in Madrid · إسباني شوارع مدريد</Text>

      <View style={[s.card, { gap: 4 }]}>
        <View style={s.rowRtl}>
          <Text style={[s.arText, { flex: 1 }]}>🔥 أيام متتالية: {streakDays()}</Text>
          <Text style={s.arMuted}>أصوات es-ES على الجهاز: {voiceCount()}</Text>
        </View>
        {last?.success_line ? <Text style={s.arMuted}>آخر نجاح: {last.success_line}</Text> : null}
      </View>

      {err ? (
        <Banner tone="warn">
          <Text style={s.arText}>ما قدرنا نوصل للسيرفر ولا في نسخة محفوظة.</Text>
          <Text style={s.arMuted}>{err}</Text>
          <Btn label="جرّب مرة ثانية" onPress={() => void load()} />
          <Btn ghost label="الإعدادات (عنوان السيرفر)" onPress={onSettings} />
        </Banner>
      ) : null}

      {bundle ? (
        <View style={[s.card, { gap: 8, borderColor: colors.accent }]}>
          <Text style={s.arMuted}>الموسم {bundle.episode.season} · الحلقة {bundle.episode.n}</Text>
          <Text style={[s.esBig, { fontSize: 24 }]}>{bundle.episode.title}</Text>
          <Text style={s.arText}>{bundle.episode.mission_ar ?? bundle.episode.mission}</Text>
          <Text style={s.arMuted}>~٢٠ دقيقة · تذكّر ← الممر ← استمع ← بمساعدة ← لحالك + مفاجأة ← الخلاصة</Text>
          {offline ? <Text style={[s.arMuted, { color: colors.warn }]}>بدون اتصال: المرحلة ١ و٢ تشتغل، والمرحلة ٣ تحتاج السيرفر.</Text> : null}
          {brain === "mock" ? <Text style={[s.arMuted, { color: colors.warn }]}>السيرفر في وضع التجربة (mock) — بدون Claude.</Text> : null}
          <Btn label="ابدأ الحلقة" onPress={() => onPlay(bundle, offline)} />
        </View>
      ) : !err ? (
        <Text style={s.arMuted}>نحمّل الحلقة…</Text>
      ) : null}

      <View style={s.rowRtl}>
        <Btn ghost label="الدفتر" onPress={onNotebook} style={{ flex: 1 }} />
        <Btn ghost label="الإعدادات" onPress={onSettings} style={{ flex: 1 }} />
      </View>
    </ScrollView>
  );
}
