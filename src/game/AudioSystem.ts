export class AudioSystem {
  private ctx: AudioContext | null = null;
  private masterGain: GainNode | null = null;
  private musicGain: GainNode | null = null;
  private volume = 0.7;
  private initialized = false;
  private musicTimer: number | null = null;
  private bossMode = false;

  public init(): void {
    if (this.initialized) {
      if (this.ctx && this.ctx.state === 'suspended') {
        void this.ctx.resume();
      }
      return;
    }

    const AudioCtx =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (!AudioCtx) return;

    this.ctx = new AudioCtx();
    this.masterGain = this.ctx.createGain();
    this.masterGain.gain.value = this.volume;
    this.masterGain.connect(this.ctx.destination);

    this.musicGain = this.ctx.createGain();
    this.musicGain.gain.value = 0.22;
    this.musicGain.connect(this.masterGain);

    this.startSoundtrack();
    this.initialized = true;
  }

  public setVolume(v: number): void {
    this.volume = Math.max(0, Math.min(1, v));
    if (this.masterGain && this.ctx) {
      this.masterGain.gain.setTargetAtTime(this.volume, this.ctx.currentTime, 0.04);
    }
  }

  public setBossMode(active: boolean): void {
    this.bossMode = active;
  }

  private startSoundtrack(): void {
    if (!this.ctx || !this.musicGain) return;

    // Continuous atmospheric dark sci-fi drone bed
    const osc1 = this.ctx.createOscillator();
    const osc2 = this.ctx.createOscillator();
    const filter = this.ctx.createBiquadFilter();
    const bedGain = this.ctx.createGain();

    osc1.type = 'sawtooth';
    osc1.frequency.value = 55.0; // A1
    osc2.type = 'triangle';
    osc2.frequency.value = 82.41; // E2

    filter.type = 'lowpass';
    filter.frequency.value = 180;
    bedGain.gain.value = 0.25;

    osc1.connect(filter);
    osc2.connect(filter);
    filter.connect(bedGain);
    bedGain.connect(this.musicGain);

    osc1.start();
    osc2.start();

    // Subtle procedural ambient sci-fi pulse sequence
    const exploreNotes = [220, 261.63, 329.63, 293.66, 196.0, 246.94];
    const bossNotes = [110, 116.54, 146.83, 164.81, 130.81, 110];
    let step = 0;

    this.musicTimer = window.setInterval(() => {
      if (!this.ctx || !this.musicGain || this.ctx.state !== 'running') return;
      const pool = this.bossMode ? bossNotes : exploreNotes;
      const freq = pool[step % pool.length];
      step++;

      const now = this.ctx.currentTime;
      const osc = this.ctx.createOscillator();
      const noteGain = this.ctx.createGain();
      const noteFilter = this.ctx.createBiquadFilter();

      osc.type = this.bossMode ? 'sawtooth' : 'sine';
      osc.frequency.setValueAtTime(freq, now);

      noteFilter.type = 'lowpass';
      noteFilter.frequency.setValueAtTime(this.bossMode ? 900 : 520, now);

      const peak = this.bossMode ? 0.14 : 0.08;
      const dur = this.bossMode ? 0.35 : 1.1;
      noteGain.gain.setValueAtTime(0.001, now);
      noteGain.gain.exponentialRampToValueAtTime(peak, now + 0.05);
      noteGain.gain.exponentialRampToValueAtTime(0.001, now + dur);

      osc.connect(noteFilter);
      noteFilter.connect(noteGain);
      noteGain.connect(this.musicGain);

      osc.start(now);
      osc.stop(now + dur + 0.02);
    }, 650);
  }

  public dispose(): void {
    if (this.musicTimer !== null) {
      clearInterval(this.musicTimer);
      this.musicTimer = null;
    }
    if (this.ctx) {
      void this.ctx.close();
      this.ctx = null;
    }
    this.initialized = false;
  }

  public playFootstep(sprint = false): void {
    this.synthTone(sprint ? 115 : 90, 42, 0.055, 'triangle', sprint ? 0.14 : 0.09);
  }

  public playJump(): void {
    this.synthTone(140, 280, 0.14, 'sine', 0.15);
  }

  public playDodge(): void {
    this.synthTone(320, 110, 0.16, 'triangle', 0.2);
  }

  public playMeleeSwing(heavy = false): void {
    this.synthTone(heavy ? 240 : 410, 70, heavy ? 0.26 : 0.14, 'sawtooth', 0.24);
  }

  public playMeleeHit(crit = false): void {
    this.synthTone(crit ? 260 : 175, 42, 0.16, 'square', crit ? 0.35 : 0.28);
  }

  public playBlock(): void {
    this.synthTone(520, 920, 0.12, 'triangle', 0.25);
  }

  public playPulseShot(): void {
    this.synthTone(820, 190, 0.1, 'sawtooth', 0.22);
  }

  public playRailCannon(): void {
    this.synthTone(1250, 58, 0.36, 'square', 0.38);
  }

  public playReload(): void {
    this.synthTone(300, 580, 0.12, 'sine', 0.16);
  }

  public playAbility(type: 'emp' | 'shield' | 'lance'): void {
    if (type === 'emp') {
      this.synthTone(540, 58, 0.55, 'sawtooth', 0.38);
    } else if (type === 'shield') {
      this.synthTone(260, 720, 0.32, 'sine', 0.28);
    } else {
      this.synthTone(980, 130, 0.45, 'square', 0.38);
    }
  }

  public playEnemyAlert(): void {
    this.synthTone(440, 880, 0.16, 'square', 0.16);
  }

  public playEnemyDeath(): void {
    this.synthTone(240, 38, 0.35, 'sawtooth', 0.28);
  }

  public playBossRoar(): void {
    this.synthTone(115, 32, 0.85, 'sawtooth', 0.45);
  }

  public playQuestComplete(): void {
    this.synthTone(440, 660, 0.16, 'sine', 0.22);
    window.setTimeout(() => this.synthTone(660, 880, 0.22, 'sine', 0.22), 140);
  }

  public playInteract(): void {
    this.synthTone(520, 780, 0.12, 'sine', 0.2);
  }

  public playUI(confirm = true): void {
    this.synthTone(confirm ? 640 : 300, confirm ? 940 : 200, 0.07, 'sine', 0.15);
  }

  private synthTone(
    startFreq: number,
    endFreq: number,
    duration: number,
    type: OscillatorType,
    gainLevel: number
  ): void {
    if (!this.ctx || !this.masterGain) return;
    if (this.ctx.state === 'suspended') {
      void this.ctx.resume();
    }
    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.type = type;
    osc.frequency.setValueAtTime(startFreq, now);
    osc.frequency.exponentialRampToValueAtTime(Math.max(20, endFreq), now + duration);

    gain.gain.setValueAtTime(gainLevel, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + duration);

    osc.connect(gain);
    gain.connect(this.masterGain);

    osc.start(now);
    osc.stop(now + duration + 0.01);
  }
}
