// ─── A.E.G.I.S. Cinematic Instrumental Music Engine ───
// Purely instrumental procedural Web Audio synth score (NO voice, NO dialogue, NO narration).
// Evolves dynamically with scroll progress (0.0 -> 1.0):
// - 0.00–0.15: Soft ambient pad & crystalline shimmer
// - 0.15–0.45: Rhythmic aerospace arpeggio pulse builds during wireframe construction
// - 0.45–0.65: Harmonic swell & filter lift during reactor activation
// - 0.65–0.80: Tension rise & orchestral-synth climax on energy blast
// - 0.80–1.00: Natural fade-out as the chatbot reveals

export class CinematicMusicEngine {
  private ctx: AudioContext | null = null;
  private masterGain: GainNode | null = null;
  private compressor: DynamicsCompressorNode | null = null;

  private padGain: GainNode | null = null;
  private padFilter: BiquadFilterNode | null = null;
  private pulseGain: GainNode | null = null;
  private pulseFilter: BiquadFilterNode | null = null;

  private padOscs: OscillatorNode[] = [];
  private arpeggioTimer: ReturnType<typeof setInterval> | null = null;
  private activeOneShots: Set<AudioScheduledSourceNode> = new Set();

  private muted = false;
  private disposed = false;
  private progress = 0;
  private blastTriggered = false;
  private arpStep = 0;

  // D minor / aerospace harmonic progression (Hz)
  private readonly arpNotes = [
    146.83, // D3
    220.0,  // A3
    261.63, // C4
    293.66, // D4
    349.23, // F4
    329.63, // E4
    293.66, // D4
    220.0,  // A3
  ];

  public async init(): Promise<boolean> {
    if (this.disposed || typeof window === 'undefined') return false;

    try {
      if (!this.ctx) {
        const AudioCtx =
          window.AudioContext ||
          (window as unknown as { webkitAudioContext?: typeof AudioContext })
            .webkitAudioContext;
        if (!AudioCtx) return false;

        this.ctx = new AudioCtx();

        this.compressor = this.ctx.createDynamicsCompressor();
        this.compressor.threshold.setValueAtTime(-16, this.ctx.currentTime);
        this.compressor.knee.setValueAtTime(18, this.ctx.currentTime);
        this.compressor.ratio.setValueAtTime(5, this.ctx.currentTime);

        this.masterGain = this.ctx.createGain();
        this.masterGain.gain.setValueAtTime(this.muted ? 0 : 0.75, this.ctx.currentTime);

        this.compressor.connect(this.masterGain);
        this.masterGain.connect(this.ctx.destination);

        // Ambient Pad Bus
        this.padFilter = this.ctx.createBiquadFilter();
        this.padFilter.type = 'lowpass';
        this.padFilter.frequency.setValueAtTime(240, this.ctx.currentTime);
        this.padFilter.Q.setValueAtTime(1.2, this.ctx.currentTime);

        this.padGain = this.ctx.createGain();
        this.padGain.gain.setValueAtTime(0.001, this.ctx.currentTime);

        this.padFilter.connect(this.padGain);
        this.padGain.connect(this.compressor);

        // Rhythmic Arpeggio Pulse Bus
        this.pulseFilter = this.ctx.createBiquadFilter();
        this.pulseFilter.type = 'lowpass';
        this.pulseFilter.frequency.setValueAtTime(480, this.ctx.currentTime);

        this.pulseGain = this.ctx.createGain();
        this.pulseGain.gain.setValueAtTime(0.001, this.ctx.currentTime);

        this.pulseFilter.connect(this.pulseGain);
        this.pulseGain.connect(this.compressor);
      }

      if (this.ctx.state === 'suspended') {
        await this.ctx.resume();
      }

      if (this.ctx.state === 'running') {
        this.startLayers();
        return true;
      }
      return false;
    } catch {
      return false;
    }
  }

  private startLayers() {
    if (!this.ctx || !this.padFilter || this.padOscs.length > 0) return;
    const now = this.ctx.currentTime;

    // Warm D-minor/sus2 harmonic pad (D2, A2, E3, F3)
    const freqs = [73.42, 110.0, 164.81, 174.61];
    freqs.forEach((f, idx) => {
      if (!this.ctx || !this.padFilter) return;
      const osc = this.ctx.createOscillator();
      osc.type = idx % 2 === 0 ? 'sawtooth' : 'triangle';
      osc.frequency.setValueAtTime(f, now);
      osc.detune.setValueAtTime((idx - 1.5) * 4, now);

      const g = this.ctx.createGain();
      g.gain.setValueAtTime(idx === 0 ? 0.35 : 0.18, now);
      osc.connect(g);
      g.connect(this.padFilter);
      osc.start(now);
      this.padOscs.push(osc);
    });

    // Subtle rhythmic synth arpeggio timer
    if (!this.arpeggioTimer) {
      this.arpeggioTimer = setInterval(() => {
        this.triggerArpNote();
      }, 220);
    }
  }

  private triggerArpNote() {
    if (
      this.disposed ||
      this.muted ||
      !this.ctx ||
      !this.pulseFilter ||
      this.ctx.state !== 'running'
    ) {
      return;
    }
    // Only audible between wireframe construction and disintegration
    if (this.progress < 0.12 || this.progress > 0.92) return;

    const now = this.ctx.currentTime;
    const note = this.arpNotes[this.arpStep % this.arpNotes.length];
    this.arpStep++;

    const osc = this.ctx.createOscillator();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(note, now);

    const g = this.ctx.createGain();
    g.gain.setValueAtTime(0.001, now);
    g.gain.linearRampToValueAtTime(0.16, now + 0.02);
    g.gain.exponentialRampToValueAtTime(0.001, now + 0.19);

    osc.connect(g);
    g.connect(this.pulseFilter);
    osc.start(now);
    osc.stop(now + 0.21);

    this.activeOneShots.add(osc);
    osc.onended = () => {
      this.activeOneShots.delete(osc);
    };
  }

  public setProgress(p: number) {
    this.progress = Math.max(0, Math.min(1, p));
    if (!this.ctx || !this.padGain || !this.padFilter || !this.pulseGain || !this.pulseFilter) {
      return;
    }

    const now = this.ctx.currentTime;

    // Pad volume & filter brightness curve
    let padLevel = 0.15;
    let padCutoff = 260;
    let pulseLevel = 0.0;
    let pulseCutoff = 500;

    if (this.progress < 0.15) {
      // Scene 1: Soft initialization
      const t = this.progress / 0.15;
      padLevel = 0.12 + t * 0.12;
      padCutoff = 220 + t * 140;
      pulseLevel = 0.02;
    } else if (this.progress < 0.48) {
      // Scene 2: Wireframe construction build
      const t = (this.progress - 0.15) / 0.33;
      padLevel = 0.24 + t * 0.16;
      padCutoff = 360 + t * 520;
      pulseLevel = 0.12 + t * 0.22;
      pulseCutoff = 600 + t * 900;
    } else if (this.progress < 0.68) {
      // Scene 3: Reactor activation intensify
      const t = (this.progress - 0.48) / 0.2;
      padLevel = 0.4 + t * 0.18;
      padCutoff = 880 + t * 950;
      pulseLevel = 0.34 + t * 0.12;
      pulseCutoff = 1500 + t * 1200;
    } else if (this.progress < 0.82) {
      // Scene 4: Energy blast climax
      padLevel = 0.58;
      padCutoff = 1900;
      pulseLevel = 0.46;
      pulseCutoff = 2600;

      if (!this.blastTriggered && this.progress >= 0.72) {
        this.blastTriggered = true;
        this.triggerInstrumentalClimax();
      }
    } else {
      // Scene 5–6: Natural fade as chatbot appears
      const t = (this.progress - 0.82) / 0.18;
      const fade = Math.max(0.0001, 1 - t);
      padLevel = 0.5 * fade;
      padCutoff = 1600 * fade + 160;
      pulseLevel = 0.3 * fade;
    }

    if (this.progress < 0.65) {
      this.blastTriggered = false;
    }

    this.padGain.gain.setTargetAtTime(padLevel, now, 0.08);
    this.padFilter.frequency.setTargetAtTime(padCutoff, now, 0.08);
    this.pulseGain.gain.setTargetAtTime(pulseLevel, now, 0.08);
    this.pulseFilter.frequency.setTargetAtTime(pulseCutoff, now, 0.08);
  }

  private triggerInstrumentalClimax() {
    if (this.muted || !this.ctx || !this.compressor) return;
    const now = this.ctx.currentTime;

    // Deep cinematic sub-bass swell + warm chord hit (instrumental only)
    const sub = this.ctx.createOscillator();
    sub.type = 'sine';
    sub.frequency.setValueAtTime(110, now);
    sub.frequency.exponentialRampToValueAtTime(36.71, now + 1.1);

    const subG = this.ctx.createGain();
    subG.gain.setValueAtTime(0.001, now);
    subG.gain.linearRampToValueAtTime(0.55, now + 0.06);
    subG.gain.exponentialRampToValueAtTime(0.001, now + 1.3);

    sub.connect(subG);
    subG.connect(this.compressor);
    sub.start(now);
    sub.stop(now + 1.35);
    this.activeOneShots.add(sub);
    sub.onended = () => this.activeOneShots.delete(sub);
  }

  public setMuted(muted: boolean) {
    this.muted = muted;
    if (this.ctx && this.masterGain) {
      const now = this.ctx.currentTime;
      this.masterGain.gain.cancelScheduledValues(now);
      this.masterGain.gain.setTargetAtTime(muted ? 0 : 0.75, now, 0.05);
    }
  }

  public stopAll() {
    if (this.arpeggioTimer) {
      clearInterval(this.arpeggioTimer);
      this.arpeggioTimer = null;
    }
    for (const osc of this.padOscs) {
      try {
        osc.stop();
        osc.disconnect();
      } catch {
        // Ignore
      }
    }
    this.padOscs = [];

    for (const node of Array.from(this.activeOneShots)) {
      try {
        node.stop();
        node.disconnect();
      } catch {
        // Ignore
      }
    }
    this.activeOneShots.clear();
  }

  public dispose() {
    this.disposed = true;
    this.stopAll();
    if (this.ctx && this.ctx.state !== 'closed') {
      this.ctx.close().catch(() => {});
    }
    this.ctx = null;
  }
}
