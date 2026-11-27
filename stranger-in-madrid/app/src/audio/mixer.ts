// Ambience bed + event SFX, mixed on device. Ambience ducks ~12 dB under speech (×0.25 amplitude).
// Noise dial: off (no ambience) · light (ducked) · real (louder, no ducking — real-life listening).
import { createAudioPlayer, setAudioModeAsync, type AudioPlayer } from "expo-audio";
import type { NoiseDial } from "../db";

/** Bundled sounds (originally synthesized, CC0). Keep names in sync with content/locations.json sfx ids. */
const SOUNDS: Record<string, number> = {
  pitch_ambience: require("../../assets/audio/pitch_ambience.wav"),
  cafe_ambience: require("../../assets/audio/cafe_ambience.wav"),
  whistle: require("../../assets/audio/whistle.wav"),
  ball_kick: require("../../assets/audio/ball_kick.wav"),
  kids_uuuh: require("../../assets/audio/kids_uuuh.wav"),
  espresso_machine: require("../../assets/audio/espresso_machine.wav"),
  spoon: require("../../assets/audio/spoon.wav"),
  door_bell: require("../../assets/audio/door_bell.wav"),
};

const DUCK = 0.25; // ≈ −12 dB
const LEVEL: Record<NoiseDial, number> = { off: 0, light: 0.35, real: 0.8 };

class Mixer {
  private bed: AudioPlayer | null = null;
  private bedName: string | null = null;
  private sfx = new Map<string, AudioPlayer>();
  private noise: NoiseDial = "light";
  private ducked = false;
  private fade: ReturnType<typeof setInterval> | null = null;

  async init() {
    await setAudioModeAsync({ playsInSilentMode: true, allowsRecording: true, shouldPlayInBackground: false });
  }

  setNoise(n: NoiseDial) {
    this.noise = n;
    this.applyVolume(false);
  }

  private target() {
    const base = LEVEL[this.noise];
    return this.ducked && this.noise !== "real" ? base * DUCK : base;
  }

  private applyVolume(ramp = true) {
    if (!this.bed) return;
    const bed = this.bed;
    const to = this.target();
    if (this.fade) clearInterval(this.fade);
    if (!ramp) {
      bed.volume = to;
      return;
    }
    const from = bed.volume;
    let step = 0;
    this.fade = setInterval(() => {
      step++;
      bed.volume = from + ((to - from) * step) / 6;
      if (step >= 6 && this.fade) clearInterval(this.fade);
    }, 25);
  }

  playAmbience(name: string | null | undefined) {
    if (!name || !SOUNDS[name]) return this.stopAmbience();
    if (this.bedName === name && this.bed) return;
    this.stopAmbience();
    this.bed = createAudioPlayer(SOUNDS[name]);
    this.bed.loop = true;
    this.bedName = name;
    this.applyVolume(false);
    this.bed.play();
  }

  stopAmbience() {
    this.bed?.pause();
    this.bed?.remove();
    this.bed = null;
    this.bedName = null;
  }

  duck(on: boolean) {
    if (this.ducked === on) return;
    this.ducked = on;
    this.applyVolume();
  }

  playSfx(name: string | null | undefined) {
    if (!name || !SOUNDS[name]) return;
    let p = this.sfx.get(name);
    if (!p) {
      p = createAudioPlayer(SOUNDS[name]);
      this.sfx.set(name, p);
    }
    p.volume = this.noise === "off" ? 0.6 : 0.9;
    void p.seekTo(0).then(() => p!.play());
  }

  dispose() {
    this.stopAmbience();
    for (const p of this.sfx.values()) p.remove();
    this.sfx.clear();
  }
}

export const mixer = new Mixer();
