// Ears: device speech recognition LOCKED to es-ES, hold-to-talk (no automatic end-of-turn cut-off).
import { useCallback, useRef, useState } from "react";
import { ExpoSpeechRecognitionModule, useSpeechRecognitionEvent } from "expo-speech-recognition";
import { stopSpeaking } from "./audio/voices";

export interface Utterance {
  transcript: string;
  /** 0..1, or null when the recognizer doesn't report it. */
  confidence: number | null;
  /** From the moment the floor was handed over to the moment he pressed the mic. */
  responseMs: number | null;
  durationMs: number;
}

export function useHoldToTalk(onUtterance: (u: Utterance) => void) {
  const [listening, setListening] = useState(false);
  const [partial, setPartial] = useState("");
  const finals = useRef<string[]>([]);
  const lastConfidence = useRef<number | null>(null);
  const latest = useRef("");
  const pressedAt = useRef(0);
  const floorAt = useRef<number | null>(null);
  const responseMs = useRef<number | null>(null);
  const cb = useRef(onUtterance);
  cb.current = onUtterance;

  useSpeechRecognitionEvent("result", (ev) => {
    const r = ev.results[0];
    if (!r) return;
    if (ev.isFinal) {
      finals.current.push(r.transcript);
      lastConfidence.current = r.confidence >= 0 ? r.confidence : null;
      latest.current = "";
    } else latest.current = r.transcript;
    setPartial([...finals.current, latest.current].filter(Boolean).join(" "));
  });

  useSpeechRecognitionEvent("end", () => {
    setListening(false);
    const transcript = [...finals.current, latest.current].filter(Boolean).join(" ").trim();
    const u: Utterance = { transcript, confidence: lastConfidence.current, responseMs: responseMs.current, durationMs: Date.now() - pressedAt.current };
    finals.current = [];
    latest.current = "";
    setPartial("");
    cb.current(u);
  });

  useSpeechRecognitionEvent("error", (ev) => {
    if (ev.error === "no-speech" || ev.error === "aborted") return;
    console.warn("STT error", ev.error, ev.message);
  });

  /** Call when a character hands him the floor; starts the response-time clock. */
  const markFloor = useCallback(() => {
    floorAt.current = Date.now();
  }, []);

  const pressIn = useCallback(async () => {
    stopSpeaking();
    const perm = await ExpoSpeechRecognitionModule.requestPermissionsAsync();
    if (!perm.granted) return;
    pressedAt.current = Date.now();
    responseMs.current = floorAt.current ? pressedAt.current - floorAt.current : null;
    floorAt.current = null;
    finals.current = [];
    latest.current = "";
    lastConfidence.current = null;
    setListening(true);
    ExpoSpeechRecognitionModule.start({
      lang: "es-ES", // locked: stops Spanish being written in Arabic letters
      interimResults: true,
      continuous: true,
      maxAlternatives: 1,
      addsPunctuation: false,
    });
  }, []);

  const pressOut = useCallback(() => {
    ExpoSpeechRecognitionModule.stop();
  }, []);

  return { listening, partial, pressIn, pressOut, markFloor };
}
