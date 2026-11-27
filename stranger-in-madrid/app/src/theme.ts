import { StyleSheet } from "react-native";

export const colors = {
  bg: "#F6F1E7",
  card: "#FFFFFF",
  ink: "#1D1B16",
  muted: "#6B6558",
  line: "#E3DCCB",
  accent: "#C8102E",
  accentSoft: "#FBE3E6",
  ok: "#2E7D32",
  okSoft: "#E3F2E5",
  warn: "#B26A00",
  warnSoft: "#FFF1DC",
  pitch: "#2F6B3B",
};

/** Arabic UI text: right-to-left. */
export const ar = { writingDirection: "rtl" as const, textAlign: "right" as const };
/** Spanish content: always left-to-right, even inside the RTL shell. */
export const es = { writingDirection: "ltr" as const, textAlign: "left" as const };

export const s = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  pad: { padding: 16 },
  card: { backgroundColor: colors.card, borderRadius: 14, padding: 14, borderWidth: 1, borderColor: colors.line },
  rowRtl: { flexDirection: "row-reverse", alignItems: "center", gap: 8 },
  h1: { fontSize: 24, fontWeight: "700", color: colors.ink, ...ar },
  h2: { fontSize: 18, fontWeight: "700", color: colors.ink, ...ar },
  arText: { fontSize: 16, color: colors.ink, lineHeight: 26, ...ar },
  arMuted: { fontSize: 14, color: colors.muted, lineHeight: 22, ...ar },
  esBig: { fontSize: 22, fontWeight: "600", color: colors.ink, ...es },
  esText: { fontSize: 17, color: colors.ink, ...es },
  street: { fontSize: 15, color: colors.accent, fontFamily: "monospace", ...es },
  btn: { backgroundColor: colors.ink, paddingVertical: 12, paddingHorizontal: 18, borderRadius: 12, alignItems: "center" },
  btnText: { color: "#fff", fontSize: 16, fontWeight: "700" },
  btnGhost: { borderWidth: 1, borderColor: colors.ink, paddingVertical: 10, paddingHorizontal: 14, borderRadius: 12, alignItems: "center" },
  btnGhostText: { color: colors.ink, fontSize: 15, fontWeight: "600" },
});
