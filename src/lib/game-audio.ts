type AudioWindow = Window & typeof globalThis & { webkitAudioContext?: typeof AudioContext };

const NOTE: Record<string, number> = {
  D3: 146.83, F3: 174.61, A3: 220, C4: 261.63, D4: 293.66, E4: 329.63,
  F4: 349.23, G4: 392, A4: 440, C5: 523.25, D5: 587.33, E5: 659.25,
  F5: 698.46, A5: 880, D6: 1174.66
};

const WALTZ = [
  { bass: 'D3', chord: ['A3', 'D4', 'F4'], melody: ['A4', 'D5', 'F5'] },
  { bass: 'C4', chord: ['A3', 'C4', 'E4'], melody: ['E5', 'D5', 'A4'] },
  { bass: 'F3', chord: ['A3', 'C4', 'F4'], melody: ['A4', 'C5', 'E5'] },
  { bass: 'A3', chord: ['A3', 'D4', 'E4'], melody: ['E5', 'D5', 'A4'] }
] as const;

class GameAudio {
  private context: AudioContext | null = null;
  private musicGain: GainNode | null = null;
  private effectsGain: GainNode | null = null;
  private musicTimer: ReturnType<typeof setTimeout> | null = null;
  private nextBar = 0;
  private barIndex = 0;
  private musicRequested = false;
  private musicVolume = 0.7;
  private effectsVolume = 0.85;
  private musicMuted = false;
  private effectsMuted = false;

  private ensureContext(): AudioContext | null {
    if (typeof window === 'undefined') return null;
    const AudioContextClass = window.AudioContext ?? (window as AudioWindow).webkitAudioContext;
    if (!AudioContextClass) return null;
    if (!this.context) {
      this.context = new AudioContextClass();
      this.musicGain = this.context.createGain();
      this.effectsGain = this.context.createGain();
      this.musicGain.connect(this.context.destination);
      this.effectsGain.connect(this.context.destination);
      this.updateGains();
    }
    return this.context;
  }

  setMix(options: { musicVolume: number; effectsVolume: number; musicMuted: boolean; effectsMuted: boolean }) {
    this.musicVolume = Math.max(0, Math.min(1, options.musicVolume));
    this.effectsVolume = Math.max(0, Math.min(1, options.effectsVolume));
    this.musicMuted = options.musicMuted;
    this.effectsMuted = options.effectsMuted;
    this.updateGains();
    if (this.musicMuted) this.pauseMusicSchedule();
    else if (this.musicRequested) void this.beginMusicSchedule();
  }

  private updateGains() {
    if (!this.context) return;
    const now = this.context.currentTime;
    this.musicGain?.gain.setTargetAtTime(this.musicMuted ? 0 : this.musicVolume, now, 0.02);
    this.effectsGain?.gain.setTargetAtTime(this.effectsMuted ? 0 : this.effectsVolume, now, 0.02);
  }

  async startMusic() {
    this.musicRequested = true;
    await this.beginMusicSchedule();
  }

  private async beginMusicSchedule() {
    if (this.musicMuted) return;
    const context = this.ensureContext();
    if (!context) return;
    if (context.state === 'suspended') await context.resume();
    if (this.musicTimer) return;
    this.nextBar = context.currentTime + 0.08;
    this.scheduleMusic();
  }

  stopMusic() {
    this.musicRequested = false;
    this.pauseMusicSchedule();
  }

  private pauseMusicSchedule() {
    if (this.musicTimer) clearTimeout(this.musicTimer);
    this.musicTimer = null;
  }

  private tone(frequency: number, start: number, duration: number, volume: number, type: OscillatorType = 'sine', channel: 'music' | 'effects' = 'music') {
    const context = this.context;
    if (!context) return;
    const oscillator = context.createOscillator();
    const gain = context.createGain();
    oscillator.type = type;
    oscillator.frequency.setValueAtTime(frequency, start);
    gain.gain.setValueAtTime(0.0001, start);
    gain.gain.exponentialRampToValueAtTime(volume, start + Math.min(0.08, duration / 3));
    gain.gain.exponentialRampToValueAtTime(0.0001, start + duration);
    oscillator.connect(gain).connect(channel === 'music' ? this.musicGain! : this.effectsGain!);
    oscillator.start(start);
    oscillator.stop(start + duration + 0.02);
  }

  private scheduleBar(start: number, index: number) {
    const bar = WALTZ[index % WALTZ.length];
    this.tone(NOTE[bar.bass], start, 2.8, 0.025, 'sine');
    bar.chord.forEach((note, chordIndex) => {
      this.tone(NOTE[note], start + 0.7 + chordIndex * 0.018, 1.25, 0.011, 'triangle');
      this.tone(NOTE[note], start + 1.9 + chordIndex * 0.018, 1.25, 0.009, 'triangle');
    });
    bar.melody.forEach((note, noteIndex) => this.tone(NOTE[note], start + 0.18 + noteIndex * 0.82, 1.15, 0.014, 'sine'));
  }

  private scheduleMusic = () => {
    const context = this.context;
    if (!context || !this.musicRequested || this.musicMuted) return;
    while (this.nextBar < context.currentTime + 8) {
      this.scheduleBar(this.nextBar, this.barIndex);
      this.nextBar += 3.6;
      this.barIndex = (this.barIndex + 1) % WALTZ.length;
    }
    this.musicTimer = setTimeout(this.scheduleMusic, 2000);
  };

  async playPrincessChime() {
    if (this.effectsMuted) return;
    const context = this.ensureContext();
    if (!context) return;
    if (context.state === 'suspended') await context.resume();
    const start = context.currentTime + 0.015;
    ['D5', 'A5', 'D6'].forEach((note, index) => this.tone(NOTE[note], start + index * 0.105, 1.25 - index * 0.12, 0.065 - index * 0.01, index === 1 ? 'triangle' : 'sine', 'effects'));
    this.tone(NOTE.F5, start + 0.24, 1.45, 0.035, 'sine', 'effects');
  }
}

export const gameAudio = new GameAudio();
