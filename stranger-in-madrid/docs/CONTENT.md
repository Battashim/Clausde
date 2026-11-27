# World bible

All people, clubs and places-of-work are fictional. Real Madrid locations (Sol, Retiro, Plaza Mayor,
Gran Vía, metro/Cercanías) can be used as public settings.

## The club
**CF Las Encinas** (fictional), a club in the south of Madrid with an academy. Rename freely, but do
not use a real club's name, crest or colours in a public release.

## The story
The learner arrives at Madrid-Barajas as a **student learning to coach** under the head coach,
**el míster Ramírez**. After a few days, Ramírez gives him the **U15 team** to coach under his
supervision. Outside the club, his friends keep asking how it's going.

Season 1 (Arriving): airport → taxi → hotel → Paco's café → first day at the club → rondo →
Ramírez offers the U15 → weekend in the Retiro → first days with the U15.
Season 2 (Life): first match, parents, a player who wants to quit, half-time talks, past tense.
Season 3 (Friends): leading conversations, group talk, Andalusian accent, opinions, plans.
Season 4 (Street): tactics, persuasion, a radio interview, a tournament, real speed.

## Characters (voice fingerprint = how they talk; TTS settings are starting points)

| Character | Who | How they talk | Voice / speed |
|---|---|---|---|
| **Paco** | Café owner by the hotel; Barça fan (father from Barcelona), club member | Loud, cheerful, joke every two lines: «¡Hombre!», «¡Anda ya!», «¡Qué fuerte!», «¡Marchando!», «crack», «chaval». Tells bad puns. | Male 50s, warm, normal-fast |
| **Doña Carmen** | Widow at the hotel, room 220, dog **Toby** | Slow, gentle, long sentences with pauses, «hijo», «¡Ay!», memories of her husband | Female 70s, slow — easiest listening |
| **Ramírez** | Head coach, the learner's mentor | Short, sharp commands, no small talk: «¡Venga! ¡Rápido!», «Bien.» (rare praise) | Male 50s, firm, fast |
| **Pablo** | Young academy player, friend | Gen-Z, messy, fast: «bro», «en plan», «literal», «mazo», «me mola», laughs | Male 19, very fast |
| **Hugo** | Academy player | Friendly, late, curious | Male 18, normal |
| **Lucía** | Fellow coaching student from Sevilla | Andalusian: drops s/d («pa'», «cansao», «illo») | Female 25, fast (season 3) |
| **Luis** | Taxi driver, Atlético fan | Grumbly, football and traffic, teases Madridistas | Male 45, fast |
| **Rosa** | Neighbour with a small dog, met in the Retiro | Kind, chatty, «hijo» | Female 60s, normal |
| **Officials** | Border police, hotel reception | Formal «usted», correct, quick, no slang | Neutral |

**U15 squad (14-year-olds; keep scenes wholesome):**
| Kid | Trait | How they talk |
|---|---|---|
| **Álvaro** | Captain, responsible | Clear, helps «translate» the coach for others |
| **Dani** | Joker, cap backwards | Teases, asks cheeky questions («¿Omán? ¿Eso dónde está?») |
| **Sergio** | Always argues, wants matches | «¡Porfa, partido!», «¿Pero por qué, míster?» |
| **Iker** | Shy, very talented | Short answers, gets nervous, does a caño |
| **Mario** | Runs with the ball, forgets to pass | «¡Pero si ya me muevo, míster!» |

## Locations (background art + ambience bed)
| Location | Visual | Ambience (loop) | Event SFX |
|---|---|---|---|
| Barajas airport | Passport hall | PA announcements, rolling suitcases, crowd murmur | stamp, beep |
| Taxi | Dashboard, Madrid traffic | engine, traffic, sports radio low | indicator click, horn |
| Hotel lobby | Reception desk, sofa | soft lobby murmur, phone | bell, keycard beep, small dog |
| Paco's café | Bar counter, TV with football | cups, coffee machine hiss, chatter, TV | espresso machine, spoon, door bell |
| Club pitch | Training pitch, cones | wind, distant shouts, ball kicks | whistle, ball hit, kids' «¡Uuuh!» |
| Dressing room | Benches, lockers | echo, lockers, showers far | locker door |
| Sol / metro | Station, screens | train arrivals, announcements | doors closing beep |
| Retiro | Lake with boats, trees | birds, kids playing, guitarist far | dog bark, oars |

Mixing rule: ambience ducks ~12 dB under speech; a **noise dial** (off / light / real) lets difficulty
grow toward real-life listening.

## Episode JSON (seed example — season 1, episode 6)
```json
{
  "id": "s1e6",
  "title": "El partido de Sergio",
  "location": "club_pitch",
  "characters": ["alvaro", "sergio", "dani", "iker", "ramirez"],
  "mission": "Organise a 7-a-side match and get shy Iker to play.",
  "mission_type": "lead",
  "target_chunks": ["siete_contra_siete", "que_te_pasa", "tranqui", "en_serio", "al_campo"],
  "known_chunks_required": ["venga_chicos", "muevete", "pasalo_otra_vez", "muy_bien"],
  "outline": [
    "Sergio insists on a match; Álvaro asks how to make teams.",
    "Learner sets 7 vs 7.",
    "Trap: Dani says «Es muy bien, míster» — learner corrects him.",
    "Match starts; Iker stands still, looking at the ground.",
    "Learner: «Iker, ¿qué te pasa?» — Iker: «Na', míster… es que estoy nervioso.»",
    "Learner encourages him: «Tranqui, Iker. Tú juegas mazo bien.» — «¿En serio?» — «En serio. ¡Venga, al campo!»"
  ],
  "twists_pass3": [
    "Iker says he's tired instead of nervous.",
    "Ramírez interrupts: «¿Por qué está parado ese chico?» — learner must explain.",
    "Sergio wants to swap teams."
  ],
  "debrief_question": "¿Qué le dijiste a Iker?",
  "bad_joke": null
}
```

## Chunk card JSON (example)
```json
{
  "id": "tengo_ganas_de",
  "es_written": "Tengo ganas de…",
  "meaning_ar": "ودّي… / متحمس لـ…",
  "meaning_en": "I feel like… / I can't wait to…",
  "street_spelling": "tengoganade",
  "sound_ar": "**تِن**گُ**غا**ناذِ",
  "examples": [
    { "es": "Tengo ganas de verte.", "street": "tengoganadeberte", "ar": "مشتاق أشوفك" },
    { "es": "¡Tengo unas ganas de ver el partido!", "street": "tengounasganadeberelpartido", "ar": "تايق أشوف الماتش" }
  ],
  "notes_ar": "للطلب في القهوة لا تستخدمها: قل ¿Me pones…?",
  "frequency_band": "core",
  "audio": { "paco": "…url…", "carmen": "…url…" }
}
```
