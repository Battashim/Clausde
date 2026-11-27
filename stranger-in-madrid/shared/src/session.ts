// Session flow (SPEC §3):
// RECALL → CORRIDOR (optional) → PASS1_LISTEN → PASS2_GUIDED → PASS3_SOLO_TWIST → DEBRIEF → SAVE
export type Phase = "RECALL" | "CORRIDOR" | "PASS1_LISTEN" | "PASS2_GUIDED" | "PASS3_SOLO_TWIST" | "DEBRIEF" | "SAVE" | "DONE";

export const PHASE_ORDER: Phase[] = ["RECALL", "CORRIDOR", "PASS1_LISTEN", "PASS2_GUIDED", "PASS3_SOLO_TWIST", "DEBRIEF", "SAVE", "DONE"];

export const PHASE_LABEL_AR: Record<Phase, string> = {
  RECALL: "تذكّر",
  CORRIDOR: "الممر",
  PASS1_LISTEN: "١ · استمع",
  PASS2_GUIDED: "٢ · بمساعدة",
  PASS3_SOLO_TWIST: "٣ · لحالك + مفاجأة",
  DEBRIEF: "الخلاصة",
  SAVE: "حفظ",
  DONE: "خلصنا",
};

export interface FlowOptions {
  skipCorridor: boolean;
  /** No due chunks → nothing to recall. */
  hasRecall: boolean;
}

export function firstPhase(o: FlowOptions): Phase {
  if (o.hasRecall) return "RECALL";
  return o.skipCorridor ? "PASS1_LISTEN" : "CORRIDOR";
}

export function nextPhase(p: Phase, o: FlowOptions): Phase {
  const i = PHASE_ORDER.indexOf(p);
  let n = PHASE_ORDER[Math.min(i + 1, PHASE_ORDER.length - 1)];
  if (n === "CORRIDOR" && o.skipCorridor) n = "PASS1_LISTEN";
  return n;
}
