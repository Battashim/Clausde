// BRAIN=mock: a scripted stand-in for Claude so the whole app can be exercised without API spend.
// It goes through the same validator and guards as real turns.
import type { ClaudeTurn, TurnLine } from "@sim/shared";
import type { LiveCall } from "./claude";

const L = (speaker: string, es: string, street: string, meaning_ar: string, sound_ar: string, sfx: string | null = null, new_chunk_ids: string[] = []): TurnLine => ({
  speaker, es, street, meaning_ar, sound_ar, new_chunk_ids, sfx,
});

const base = (over: Partial<ClaudeTurn>): ClaudeTurn => ({
  lines: [],
  await_learner: true,
  expected_intents: [],
  feedback: { type: "none", wrong: "", right: "", say_again: false },
  choices: [],
  hint: null,
  catch_box_add: [],
  events: [],
  debrief: null,
  end_scene: false,
  ...over,
});

const PASS3: ClaudeTurn[] = [
  base({
    lines: [
      L("alvaro", "Míster, siete contra siete. ¡Venga!", "mister sietekontrasiete. benga!", "كوتش، سبعة ضد سبعة. يلا!", "**ميس**تِر سيِتِكُنترا**سيِ**تِ. **بِن**گا!", "whistle"),
      L("alvaro", "Míster… mira a Iker.", "mister… miraiker", "كوتش… شوف إيكر.", "**ميس**تِر… ميرا**إي**كِر"),
    ],
    expected_intents: ["ask_what_wrong"],
    choices: [
      { es: "Iker, ¿qué te pasa?", street: "iker ketepasa" },
      { es: "¡Iker, muévete!", street: "iker muebete" },
      { es: "Iker, ¿estás cansado?", street: "iker estakansao" },
    ],
    hint: { first_words: "Iker, ¿qué…", full: "Iker, ¿qué te pasa?", street: "iker ketepasa" },
    events: ["mission_progress:1"],
  }),
  base({
    lines: [L("iker", "Na', míster… es que estoy cansao.", "na mister… eskestoikansao", "ولا شي يا كوتش… السالفة إني تعبان.", "نا **ميس**تِر… إسْكِسْتُيْكان**ساو**")],
    expected_intents: ["encourage", "let_rest"],
    choices: [
      { es: "Tranqui, Iker. Un momento y al campo.", street: "tranki iker unmomento ialkampo" },
      { es: "¿En serio? ¡Venga, al campo!", street: "enserio benga alkampo" },
      { es: "Tranqui. Tú juegas mazo bien.", street: "tranki tujuegamazobien" },
    ],
    hint: { first_words: "Tranqui…", full: "Tranqui, Iker. Un momento y al campo.", street: "tranki iker unmomento ialkampo" },
    events: ["twist:tired"],
  }),
  base({
    lines: [
      L("iker", "Vale, míster. ¡Al campo!", "bale mister. alkampo!", "زين يا كوتش. على الملعب!", "**با**لِ **ميس**تِر. ال**كام**پُ!", "ball_kick"),
      L("ramirez", "Bien.", "bien.", "زين.", "**بيِن**", "whistle"),
    ],
    await_learner: false,
    events: ["mission_done"],
    end_scene: true,
  }),
];

const DEBRIEF: ClaudeTurn[] = [
  base({
    lines: [L("paco", "¡Hombre, crack! ¿Qué tal hoy? ¿Qué le dijiste a Iker?", "ombre krak! ketaloy? keledijiste aiker?", "هلا يا بطل! كيف اليوم؟ شو قلت لإيكر؟", "**اُم**برِ كْراك! كِتا**لوي**؟ كِلِدي**خيس**تِ اإيكِر؟", "espresso_machine")],
    expected_intents: ["retell"],
    choices: [
      { es: "Le dije: «Tranqui, Iker».", street: "ledije tranki iker" },
      { es: "Le dije: «¿Qué te pasa?».", street: "ledije ketepasa" },
      { es: "Pues… a ver… le dije: «¡Al campo!».", street: "pues aber ledije alkampo" },
    ],
    hint: { first_words: "Le dije…", full: "Le dije: «Tranqui, Iker».", street: "ledije tranki iker" },
  }),
  base({
    lines: [L("paco", "¡Anda ya! ¡Muy bien, crack!", "anda ya! muibien krak!", "لا والله! ممتاز يا بطل!", "**ان**دا يا! موي**بيِن** كْراك!")],
    await_learner: false,
    end_scene: true,
    debrief: { success_line_ar: "حكيت لباكو شو قلت لإيكر بجملة كاملة: «Le dije: Tranqui».", next_time_ar: ["قل «le dije» مو «yo dije»."] },
  }),
];

const CATCHBOX: ClaudeTurn[] = [
  base({
    lines: [L("paco", "A ver, crack… ¿«mazo»? ¿Qué es eso?", "aber krak… mazo? keseso?", "خلنا نشوف يا بطل… «ماثو»؟ شو معناها؟", "ا**بِر** كْراك… **ما**ثُ؟ كِ**سِ**سُ؟")],
    expected_intents: ["guess"],
    choices: [
      { es: "Mazo es «muy».", street: "mazo es mui" },
      { es: "No sé cómo se dice…", street: "nosekomosedize" },
      { es: "¿Me lo repites?", street: "melorrepites" },
    ],
    hint: { first_words: "Mazo es…", full: "Mazo es «muy».", street: "mazo es mui" },
  }),
  base({ lines: [L("paco", "¡Muy bien! Mazo bien.", "muibien! mazobien.", "ممتاز! زين وايد.", "موي**بيِن**! ماثُ**بيِن**")], await_learner: false, end_scene: true }),
];

export async function mockLiveTurn(call: LiveCall): Promise<unknown> {
  const mode = /PASS 3/.test(call.context) ? PASS3 : /DEBRIEF/.test(call.context) ? DEBRIEF : CATCHBOX;
  const learnerTurns = (call.transcript.match(/^LEARNER:/gm) ?? []).length + (/LEARNER just said/.test(call.transcript) ? 1 : 0);
  const t = structuredClone(mode[Math.min(learnerTurns, mode.length - 1)]);
  // React lightly to a recurring mistake, like the real coach would.
  if (/es muy bien/i.test(call.transcript)) t.feedback = { type: "correct_now", wrong: "Es muy bien", right: "¡Muy bien!", say_again: true };
  return t;
}
