import React from "react";
import { Modal, Pressable, Text, View, type StyleProp, type TextStyle, type ViewStyle } from "react-native";
import type { Character, Chunk, Location } from "../../../shared/src";
import { colors, s, ar, es } from "../theme";
import type { SubtitleMode } from "../db";

export function Btn({ label, onPress, ghost, style, disabled }: { label: string; onPress: () => void; ghost?: boolean; style?: StyleProp<ViewStyle>; disabled?: boolean }) {
  return (
    <Pressable onPress={onPress} disabled={disabled} style={({ pressed }) => [ghost ? s.btnGhost : s.btn, { opacity: disabled ? 0.4 : pressed ? 0.7 : 1 }, style]}>
      <Text style={ghost ? s.btnGhostText : s.btnText}>{label}</Text>
    </Pressable>
  );
}

/** Renders "سِ**دي**ثِ" with the stressed syllable in bold. Arabic-letter sound is read RTL. */
export function StressText({ text, style }: { text: string; style?: StyleProp<TextStyle> }) {
  const parts = text.split(/\*\*(.+?)\*\*/g);
  return (
    <Text style={[{ fontSize: 20, color: colors.ink, ...ar }, style]}>
      {parts.map((p, i) => (
        <Text key={i} style={i % 2 ? { fontWeight: "800", color: colors.accent } : undefined}>
          {p}
        </Text>
      ))}
    </Text>
  );
}

export function LocationCard({ location, phaseLabel }: { location: Location | null; phaseLabel: string }) {
  return (
    <View style={{ backgroundColor: colors.pitch, padding: 14, borderRadius: 14 }}>
      <View style={s.rowRtl}>
        <Text style={{ color: "#fff", fontSize: 18, fontWeight: "700", flex: 1, ...ar }}>{location?.name_ar ?? ""}</Text>
        <Text style={{ color: "#D7F0DC", fontSize: 13, ...ar }}>{phaseLabel}</Text>
      </View>
      <Text style={{ color: "#D7F0DC", fontSize: 13, marginTop: 2, ...es }}>{location?.name ?? ""}</Text>
    </View>
  );
}

export function NameTag({ c }: { c: Character | undefined }) {
  if (!c) return null;
  return (
    <View style={{ flexDirection: "row-reverse", alignItems: "center", gap: 8 }}>
      <View style={{ width: 34, height: 34, borderRadius: 17, backgroundColor: c.color, alignItems: "center", justifyContent: "center" }}>
        <Text style={{ color: "#fff", fontWeight: "800", fontSize: 12 }}>{c.initials}</Text>
      </View>
      <Text style={{ fontWeight: "700", color: c.color, fontSize: 16 }}>{c.id === "you" ? "أنت" : c.name}</Text>
    </View>
  );
}

export interface ShownLine {
  speaker: string;
  es: string;
  street: string;
  meaning_ar: string;
  sound_ar?: string;
}

/** A spoken line with subtitles per the subtitle mode. Tap = replay, long-press = sound zoom. */
export function LineView({ line, chars, mode, onReplay, onZoom, forceShow, dim }: {
  line: ShownLine;
  chars: Record<string, Character>;
  mode: SubtitleMode;
  onReplay?: () => void;
  onZoom?: () => void;
  forceShow?: boolean;
  dim?: boolean;
}) {
  const show = forceShow ? "street_meaning" : mode;
  return (
    <Pressable onPress={onReplay} onLongPress={onZoom} delayLongPress={400} style={[s.card, { gap: 6, opacity: dim ? 0.55 : 1 }]}>
      <NameTag c={chars[line.speaker]} />
      {show === "off" ? (
        <Text style={s.arMuted}>🔊 اضغط لإعادة السماع · اضغط مطولاً للتقطيع</Text>
      ) : (
        <>
          <Text style={s.esBig}>{line.es}</Text>
          <Text style={s.street}>{line.street}</Text>
          {show === "street_meaning" ? <Text style={s.arText}>{line.meaning_ar}</Text> : null}
        </>
      )}
    </Pressable>
  );
}

/** 4-layer chunk card: written · meaning (Gulf Arabic + English) · street spelling · sound in Arabic letters. */
export function ChunkCard({ chunk, visible, onClose, onPlay }: { chunk: Chunk | null; visible: boolean; onClose: () => void; onPlay: (slow: boolean) => void }) {
  return (
    <Modal visible={visible && !!chunk} transparent animationType="slide" onRequestClose={onClose}>
      <View style={{ flex: 1, justifyContent: "flex-end", backgroundColor: "rgba(0,0,0,0.3)" }}>
        {chunk ? (
          <View style={{ backgroundColor: colors.card, borderTopLeftRadius: 22, borderTopRightRadius: 22, padding: 20, gap: 10 }}>
            <Text style={s.arMuted}>قطعة جديدة</Text>
            <Text style={[s.esBig, { fontSize: 28 }]}>{chunk.es_written}</Text>
            <Text style={s.arText}>{chunk.meaning_ar}</Text>
            <Text style={{ color: colors.muted, ...es }}>{chunk.meaning_en}</Text>
            <Text style={[s.street, { fontSize: 20 }]}>{chunk.street_spelling}</Text>
            <StressText text={chunk.sound_ar} style={{ fontSize: 26 }} />
            {chunk.notes_ar ? <Text style={s.arMuted}>💡 {chunk.notes_ar}</Text> : null}
            {chunk.examples.slice(0, 2).map((e, i) => (
              <View key={i} style={{ borderTopWidth: 1, borderColor: colors.line, paddingTop: 6 }}>
                <Text style={s.esText}>{e.es}</Text>
                <Text style={s.street}>{e.street}</Text>
                <Text style={s.arMuted}>{e.ar}</Text>
              </View>
            ))}
            <View style={[s.rowRtl, { marginTop: 6 }]}>
              <Btn label="▶ واضح" ghost onPress={() => onPlay(true)} style={{ flex: 1 }} />
              <Btn label="▶ شارع" ghost onPress={() => onPlay(false)} style={{ flex: 1 }} />
              <Btn label="تمام" onPress={onClose} style={{ flex: 1 }} />
            </View>
          </View>
        ) : null}
      </View>
    </Modal>
  );
}

/** Big hold-to-talk button (no auto cut-off: he holds as long as he needs). */
export function HoldToTalk({ listening, partial, onPressIn, onPressOut, disabled }: { listening: boolean; partial: string; onPressIn: () => void; onPressOut: () => void; disabled?: boolean }) {
  return (
    <View style={{ alignItems: "center", gap: 8 }}>
      {partial ? <Text style={[s.esText, { color: colors.muted, textAlign: "center" }]}>{partial}</Text> : null}
      <Pressable
        disabled={disabled}
        onPressIn={onPressIn}
        onPressOut={onPressOut}
        style={{
          width: 108, height: 108, borderRadius: 54, alignItems: "center", justifyContent: "center",
          backgroundColor: listening ? colors.accent : disabled ? colors.line : colors.ink,
          transform: [{ scale: listening ? 1.08 : 1 }],
        }}
      >
        <Text style={{ color: "#fff", fontSize: 34 }}>🎙</Text>
        <Text style={{ color: "#fff", fontSize: 12, fontWeight: "700" }}>{listening ? "أسمعك…" : "اضغط وتكلّم"}</Text>
      </Pressable>
    </View>
  );
}

export function ActionRow({ items }: { items: { label: string; onPress: () => void; disabled?: boolean; highlight?: boolean }[] }) {
  return (
    <View style={[s.rowRtl, { justifyContent: "space-between" }]}>
      {items.map((it) => (
        <Pressable
          key={it.label}
          disabled={it.disabled}
          onPress={it.onPress}
          style={{ flex: 1, paddingVertical: 10, borderRadius: 10, alignItems: "center", backgroundColor: it.highlight ? colors.warnSoft : colors.card, borderWidth: 1, borderColor: it.highlight ? colors.warn : colors.line, opacity: it.disabled ? 0.4 : 1 }}
        >
          <Text style={{ fontWeight: "700", color: colors.ink }}>{it.label}</Text>
        </Pressable>
      ))}
    </View>
  );
}

export function Banner({ tone, children }: { tone: "ok" | "warn" | "info"; children: React.ReactNode }) {
  const bg = tone === "ok" ? colors.okSoft : tone === "warn" ? colors.warnSoft : colors.accentSoft;
  return <View style={{ backgroundColor: bg, padding: 12, borderRadius: 12, gap: 4 }}>{children}</View>;
}
