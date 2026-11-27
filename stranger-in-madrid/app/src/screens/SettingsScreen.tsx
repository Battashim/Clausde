import React, { useState } from "react";
import { ScrollView, Switch, Text, TextInput, View } from "react-native";
import { Btn } from "../components/ui";
import { getSettings, saveSettings, type NoiseDial, type Settings, type SubtitleMode } from "../db";
import { health } from "../api";
import { colors, es, s } from "../theme";

function Choice<T extends string | number>({ value, options, onChange }: { value: T; options: { v: T; label: string }[]; onChange: (v: T) => void }) {
  return (
    <View style={s.rowRtl}>
      {options.map((o) => (
        <Btn key={String(o.v)} ghost={o.v !== value} label={o.label} onPress={() => onChange(o.v)} style={{ flex: 1 }} />
      ))}
    </View>
  );
}

const input = { borderWidth: 1, borderColor: colors.line, borderRadius: 10, padding: 10, backgroundColor: colors.card, ...es };

export function SettingsScreen({ onBack }: { onBack: () => void }) {
  const [st, setSt] = useState<Settings>(getSettings());
  const [status, setStatus] = useState<string | null>(null);
  const set = (p: Partial<Settings>) => {
    const next = { ...st, ...p };
    setSt(next);
    saveSettings(p);
  };

  return (
    <ScrollView style={s.screen} contentContainerStyle={{ padding: 16, gap: 14 }}>
      <View style={s.rowRtl}>
        <Text style={[s.h1, { flex: 1 }]}>الإعدادات</Text>
        <Btn ghost label="رجوع" onPress={onBack} />
      </View>

      <Text style={s.h2}>الترجمة على الشاشة</Text>
      <Choice<SubtitleMode> value={st.subtitles} onChange={(v) => set({ subtitles: v })} options={[{ v: "off", label: "بدون" }, { v: "street", label: "شارع" }, { v: "street_meaning", label: "شارع + معنى" }]} />

      <Text style={s.h2}>الضجة (صعوبة السماع)</Text>
      <Choice<NoiseDial> value={st.noise} onChange={(v) => set({ noise: v })} options={[{ v: "off", label: "بدون" }, { v: "light", label: "خفيفة" }, { v: "real", label: "حقيقية" }]} />

      <Text style={s.h2}>سرعة الأصوات</Text>
      <Choice<number> value={st.voiceSpeed} onChange={(v) => set({ voiceSpeed: v })} options={[{ v: 0.8, label: "أبطأ" }, { v: 1, label: "عادي" }, { v: 1.15, label: "شارع" }]} />

      <View style={s.rowRtl}>
        <Text style={[s.arText, { flex: 1 }]}>تخطَّ الممر دايماً</Text>
        <Switch value={st.skipCorridor} onValueChange={(v) => set({ skipCorridor: v })} />
      </View>

      <Text style={s.h2}>كلمة السؤال</Text>
      <Text style={s.arMuted}>الزر «سؤال» يشتغل دايماً. لو تبي تقولها بصوتك، اختر كلمة إسبانية (مثل pregunta) لأن الميكروفون مقفول على الإسباني.</Text>
      <TextInput style={input} value={st.catchWord} onChangeText={(v) => set({ catchWord: v })} />

      <Text style={s.h2}>أشياء من حياتك تتذكرها الشخصيات</Text>
      <TextInput
        style={[input, { minHeight: 90, textAlignVertical: "top" }]}
        multiline
        value={st.lifeFacts.join("\n")}
        onChangeText={(v) => set({ lifeFacts: v.split("\n").map((x) => x.trim()).filter(Boolean) })}
      />

      <Text style={s.h2}>السيرفر</Text>
      <TextInput style={input} autoCapitalize="none" value={st.serverUrl} onChangeText={(v) => set({ serverUrl: v })} placeholder="http://192.168.1.20:8787" />
      <TextInput style={input} autoCapitalize="none" secureTextEntry value={st.appToken} onChangeText={(v) => set({ appToken: v })} placeholder="APP_TOKEN" />
      <Btn ghost label="جرّب الاتصال" onPress={() => health().then((h) => setStatus(`✔ متصل (${h.brain})`)).catch((e) => setStatus(`✘ ${(e as Error).message}`))} />
      {status ? <Text style={s.arMuted}>{status}</Text> : null}
    </ScrollView>
  );
}
