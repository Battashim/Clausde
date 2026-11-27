// PASS 1 — LISTEN: the whole cached script plays (every character + his own lines in the calm "you" voice).
// New chunks get a 4-layer card the first time. Tap a line to replay, long-press for sound zoom.
import React, { useEffect, useRef, useState } from "react";
import { ScrollView, Text, View, type ScrollViewInstance } from "react-native";
import type { Chunk } from "../../../shared/src";
import { Btn, ChunkCard, LineView } from "../components/ui";
import { chunkEvent } from "../db";
import { mixer } from "../audio/mixer";
import { soundZoom, speak, stopSpeaking } from "../audio/voices";
import { s } from "../theme";
import { logCharacterLine, type SessionCtx } from "./ctx";

export function Pass1({ ctx, onDone }: { ctx: SessionCtx; onDone: () => void }) {
  const lines = ctx.bundle.script.lines;
  const [i, setI] = useState(0);
  const [paused, setPaused] = useState(false);
  const [card, setCard] = useState<Chunk | null>(null);
  const seen = useRef(new Set<string>());
  const cardClosed = useRef<(() => void) | null>(null);
  const alive = useRef(true);
  const scroll = useRef<ScrollViewInstance>(null);

  useEffect(() => () => {
    alive.current = false;
    stopSpeaking();
  }, []);

  useEffect(() => {
    if (paused || i >= lines.length) return;
    let cancelled = false;
    (async () => {
      const l = lines[i];
      mixer.playSfx(l.sfx);
      await speak(l.es, l.speaker);
      if (cancelled || !alive.current) return;
      logCharacterLine(ctx, "pass1", l.speaker, l.es);
      for (const id of l.new_chunk_ids) {
        if (seen.current.has(id)) continue;
        seen.current.add(id);
        chunkEvent(id, { kind: "heard" });
        const c = ctx.chunkById.get(id) ?? ctx.bundle.script.cards.find((x) => x.id === id) ?? null;
        if (c) {
          setCard(c);
          await new Promise<void>((r) => (cardClosed.current = r));
        }
      }
      if (!cancelled && alive.current) setI((n) => n + 1);
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [i, paused]);

  const done = i >= lines.length;
  return (
    <View style={{ flex: 1 }}>
      <ScrollView ref={scroll} onContentSizeChange={() => scroll.current?.scrollToEnd({ animated: true })} contentContainerStyle={{ gap: 10, padding: 16 }}>
        <Text style={s.h2}>المرحلة ١ — استمع بس</Text>
        <Text style={s.arMuted}>اسمع المشهد كامل، حتى جملك أنت. اضغط على أي جملة لتعيدها، واضغط مطولاً لتقطيعها.</Text>
        {lines.slice(0, Math.min(i + 1, lines.length)).map((l, n) => (
          <LineView
            key={n}
            line={l}
            chars={ctx.chars}
            mode={ctx.settings.subtitles}
            dim={n < i}
            onReplay={() => void speak(l.es, l.speaker)}
            onZoom={() => void soundZoom(l.es, l.speaker)}
          />
        ))}
      </ScrollView>
      <View style={[s.rowRtl, { padding: 16 }]}>
        {done ? (
          <Btn label="يلا للمرحلة ٢" onPress={onDone} style={{ flex: 1 }} />
        ) : (
          <Btn
            ghost
            label={paused ? "▶ كمّل" : "⏸ وقف"}
            onPress={() => {
              if (!paused) stopSpeaking();
              setPaused(!paused);
            }}
            style={{ flex: 1 }}
          />
        )}
        <Btn ghost label="↺ من الأول" onPress={() => { stopSpeaking(); setI(0); setPaused(false); }} style={{ flex: 1 }} />
      </View>
      <ChunkCard
        chunk={card}
        visible={!!card}
        onPlay={(slow) => card && void speak(card.es_written.replace(/…/g, ""), "you", { slow })}
        onClose={() => {
          setCard(null);
          cardClosed.current?.();
          cardClosed.current = null;
        }}
      />
    </View>
  );
}
