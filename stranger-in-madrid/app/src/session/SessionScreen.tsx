// Session state machine (SPEC §3): RECALL → CORRIDOR → PASS1 → PASS2 → PASS3 + twist → DEBRIEF → SAVE.
import React, { useEffect, useMemo, useRef, useState } from "react";
import { Text, View } from "react-native";
import { PHASE_LABEL_AR, firstPhase, nextPhase, pickDue, type Phase } from "../../../shared/src";
import type { EpisodeBundle } from "../api";
import { syncTurns } from "../api";
import { Btn, LocationCard } from "../components/ui";
import { allLearnerChunks, avgResponseMs, getSettings, knownChunkIds, startAttempt, updateAttempt } from "../db";
import { mixer } from "../audio/mixer";
import { setCharacters, setVoiceSpeed, stopSpeaking } from "../audio/voices";
import { s } from "../theme";
import type { SessionCtx } from "./ctx";
import { Corridor } from "./Corridor";
import { Debrief } from "./Debrief";
import { LiveScene } from "./LiveScene";
import { Pass1 } from "./Pass1";
import { Pass2 } from "./Pass2";
import { Recall } from "./Recall";

export function SessionScreen({ bundle, offline, onExit }: { bundle: EpisodeBundle; offline: boolean; onExit: () => void }) {
  const settings = useMemo(getSettings, []);
  const ctx = useMemo<SessionCtx>(() => {
    const ep = bundle.episode;
    const newIds = ep.target_chunks.slice(0, 5);
    const known = new Set([...knownChunkIds(), ...ep.known_chunks_required]);
    for (const id of newIds) known.delete(id);
    return {
      bundle,
      attemptId: 0,
      settings,
      chars: bundle.characters,
      chunkById: new Map(bundle.chunks.map((c) => [c.id, c])),
      newIds,
      knownIds: [...known],
      twist: ep.twists_pass3[Math.floor(Math.random() * ep.twists_pass3.length)] ?? "",
      stats: { freezes: 0, askedMeaning: 0, passes: [], successLine: null, unaidedChunks: new Set() },
      reviewed: new Set(),
    };
  }, [bundle, settings]);

  const dueIds = useMemo(() => {
    const withPrompt = new Set(bundle.chunks.filter((c) => c.recall_prompt).map((c) => c.id));
    const due = pickDue(allLearnerChunks(), new Date(), 10).filter((id) => !ctx.newIds.includes(id));
    return [...due.filter((id) => withPrompt.has(id)), ...due.filter((id) => !withPrompt.has(id))].slice(0, 3);
  }, [bundle, ctx]);

  const flow = { skipCorridor: settings.skipCorridor || !bundle.script.corridor.length, hasRecall: dueIds.length > 0 };
  const [phase, setPhase] = useState<Phase>(() => firstPhase(flow));
  const attemptRef = useRef(0);

  useEffect(() => {
    attemptRef.current = startAttempt(bundle.episode.id, ctx.twist);
    ctx.attemptId = attemptRef.current;
    setCharacters(bundle.characters);
    setVoiceSpeed(settings.voiceSpeed);
    mixer.setNoise(settings.noise);
    mixer.playAmbience(bundle.location?.ambience);
    return () => {
      stopSpeaking();
      mixer.stopAmbience();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (phase === "DEBRIEF") mixer.playAmbience("cafe_ambience");
  }, [phase]);

  function advance() {
    stopSpeaking();
    ctx.stats.passes.push(phase);
    updateAttempt(ctx.attemptId, { passes_done: ctx.stats.passes });
    setPhase(nextPhase(phase, flow));
  }

  function save(selfComprehension: number) {
    ctx.stats.passes.push("DEBRIEF");
    updateAttempt(ctx.attemptId, {
      passes_done: ctx.stats.passes,
      self_comprehension: selfComprehension,
      asked_meaning: ctx.stats.askedMeaning,
      freezes: ctx.stats.freezes,
      avg_response_ms: avgResponseMs(ctx.attemptId),
      success_line: ctx.stats.successLine,
    });
    void syncTurns();
    setPhase("DONE");
  }

  let body: React.ReactNode = null;
  switch (phase) {
    case "RECALL":
      body = <Recall ctx={ctx} dueIds={dueIds} onDone={advance} />;
      break;
    case "CORRIDOR":
      body = <Corridor ctx={ctx} onDone={advance} />;
      break;
    case "PASS1_LISTEN":
      body = <Pass1 ctx={ctx} onDone={advance} />;
      break;
    case "PASS2_GUIDED":
      body = <Pass2 ctx={ctx} onDone={advance} />;
      break;
    case "PASS3_SOLO_TWIST":
      body = offline ? (
        <View style={{ padding: 16, gap: 10 }}>
          <Text style={s.arText}>المرحلة ٣ تحتاج اتصال بالسيرفر. نكمل الخلاصة لاحقاً.</Text>
          <Btn label="رجوع" onPress={onExit} />
        </View>
      ) : (
        <LiveScene ctx={ctx} mode="pass3" title="المرحلة ٣ — لحالك + مفاجأة" onDone={advance} />
      );
      break;
    case "DEBRIEF":
      body = <Debrief ctx={ctx} onDone={save} />;
      break;
    default:
      body = (
        <View style={{ padding: 16, gap: 12 }}>
          <Text style={s.h1}>انحفظت الجلسة ✔</Text>
          <Text style={s.arText}>{ctx.stats.successLine}</Text>
          <Btn label="رجوع للرئيسية" onPress={onExit} />
        </View>
      );
  }

  return (
    <View style={s.screen}>
      <View style={{ padding: 16, paddingBottom: 0, gap: 8 }}>
        <LocationCard location={phase === "DEBRIEF" ? { id: "pacos_cafe", name: "Bar de Paco", name_ar: "قهوة باكو", ambience: "cafe_ambience", sfx: [] } : bundle.location} phaseLabel={PHASE_LABEL_AR[phase]} />
        <View style={s.rowRtl}>
          <Text style={[s.arMuted, { flex: 1 }]}>المهمة: {bundle.episode.mission_ar ?? bundle.episode.mission}</Text>
          <Btn ghost label="خروج" onPress={onExit} style={{ paddingVertical: 4 }} />
        </View>
      </View>
      <View style={{ flex: 1 }}>{body}</View>
    </View>
  );
}
