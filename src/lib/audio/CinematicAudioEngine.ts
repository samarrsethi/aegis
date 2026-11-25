// ─── A.E.G.I.S. Cinematic Web Audio Engine ───
// 100% procedural Web Audio synthesis with separate Ambience, Mechanical SFX, and Voice/Chime buses,
// stereo panning, DynamicsCompressor anti-clipping, and instant cleanup on skip/mute/unmount.

export class CinematicAudioEngine {
  private ctx: AudioContext | null = null;
  private masterGain: GainNode | null = null;
  private compressor: DynamicsCompressorNode | null = null;
  private ambienceGain: GainNode | null = null;
  private sfxGain: GainNode | null = null;
  private voiceGain: GainNode | null = null;

  private activeNodes: Set<AudioScheduledSourceNode> = new Set();
  private ambienceDroneOsc: OscillatorNode | null = null;
  private ambienceSubOsc: OscillatorNode | null = null;
  private reactorHumOsc: OscillatorNode | null = null;
  private reactorHumGain: GainNode | null = null;
  private noiseBuffer: AudioBuffer | null = null;

  private muted = false;
  private disposed = false;

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

        // Anti-clipping compressor -> Master Gain -> Destination
        this.compressor = this.ctx.createDynamicsCompressor();
        this.compressor.threshold.setValueAtTime(-14, this.ctx.currentTime);
        this.compressor.knee.setValueAtTime(18, this.ctx.currentTime);
        this.compressor.ratio.setValueAtTime(6, this.ctx.currentTime);
        this.compressor.attack.setValueAtTime(0.003, this.ctx.currentTime);
        this.compressor.release.setValueAtTime(0.2, this.ctx.currentTime);

        this.masterGain = this.ctx.createGain();
        this.masterGain.gain.setValueAtTime(this.muted ? 0 : 0.85, this.ctx.currentTime);

        this.compressor.connect(this.masterGain);
        this.masterGain.connect(this.ctx.destination);

        // Separate Gain Buses
        this.ambienceGain = this.ctx.createGain();
        this.ambienceGain.gain.setValueAtTime(0.35, this.ctx.currentTime);
        this.ambienceGain.connect(this.compressor);

        this.sfxGain = this.ctx.createGain();
        this.sfxGain.gain.setValueAtTime(0.85, this.ctx.currentTime);
        this.sfxGain.connect(this.compressor);

        this.voiceGain = this.ctx.createGain();
        this.voiceGain.gain.setValueAtTime(0.75, this.ctx.currentTime);
        this.voiceGain.connect(this.compressor);

        this.noiseBuffer = this.createNoiseBuffer(this.ctx, 2.0);
      }

      if (this.ctx.state === 'suspended') {
        await this.ctx.resume();
      }

      return this.ctx.state === 'running';
    } catch {
      return false;
    }
  }

  public isRunning(): boolean {
    return this.ctx?.state === 'running';
  }

  public setMuted(muted: boolean) {
    this.muted = muted;
    if (this.ctx && this.masterGain) {
      const now = this.ctx.currentTime;
      this.masterGain.gain.cancelScheduledValues(now);
      this.masterGain.gain.setTargetAtTime(muted ? 0 : 0.85, now, 0.04);
    }
    if (muted && typeof window !== 'undefined' && 'speechSynthesis' in window) {
      try {
        window.speechSynthesis.cancel();
      } catch {
        // Ignore
      }
    }
  }

  public isMuted(): boolean {
    return this.muted;
  }

  private createNoiseBuffer(ctx: AudioContext, seconds: number): AudioBuffer {
    const length = Math.floor(ctx.sampleRate * seconds);
    const buffer = ctx.createBuffer(1, length, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < length; i++) {
      data[i] = Math.random() * 2 - 1;
    }
    return buffer;
  }

  private createPanner(pan: number): AudioNode {
    if (!this.ctx || !this.sfxGain) {
      throw new Error('AudioContext not initialized');
    }
    if (typeof this.ctx.createStereoPanner === 'function') {
      const panner = this.ctx.createStereoPanner();
      panner.pan.setValueAtTime(Math.max(-1, Math.min(1, pan)), this.ctx.currentTime);
      panner.connect(this.sfxGain);
      return panner;
    }
    return this.sfxGain;
  }

  private trackNode(node: AudioScheduledSourceNode) {
    this.activeNodes.add(node);
    node.onended = () => {
      this.activeNodes.delete(node);
    };
  }

  // ─── 1. Low Atmospheric Sub-Bass Ambience ───
  public startAmbience() {
    if (!this.ctx || !this.ambienceGain || this.ambienceDroneOsc) return;
    const now = this.ctx.currentTime;

    const drone = this.ctx.createOscillator();
    drone.type = 'sawtooth';
    drone.frequency.setValueAtTime(42, now);

    const filter = this.ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(110, now);

    const droneGain = this.ctx.createGain();
    droneGain.gain.setValueAtTime(0.001, now);
    droneGain.gain.linearRampToValueAtTime(0.28, now + 0.8);

    drone.connect(filter);
    filter.connect(droneGain);
    droneGain.connect(this.ambienceGain);
    drone.start(now);
    this.trackNode(drone);
    this.ambienceDroneOsc = drone;

    const sub = this.ctx.createOscillator();
    sub.type = 'sine';
    sub.frequency.setValueAtTime(28, now);
    const subGain = this.ctx.createGain();
    subGain.gain.setValueAtTime(0.001, now);
    subGain.gain.linearRampToValueAtTime(0.35, now + 0.6);

    sub.connect(subGain);
    subGain.connect(this.ambienceGain);
    sub.start(now);
    this.trackNode(sub);
    this.ambienceSubOsc = sub;
  }

  // ─── 2. Thruster Approach / Propulsion ───
  public playThrusterSweep(duration = 1.4, pan = 0, intensity = 0.5) {
    if (!this.ctx || !this.noiseBuffer || !this.sfxGain) return;
    const now = this.ctx.currentTime;
    const dest = this.createPanner(pan);

    const noise = this.ctx.createBufferSource();
    noise.buffer = this.noiseBuffer;
    noise.loop = true;

    const filter = this.ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.Q.setValueAtTime(1.8, now);
    filter.frequency.setValueAtTime(160, now);
    filter.frequency.exponentialRampToValueAtTime(950, now + duration * 0.7);
    filter.frequency.exponentialRampToValueAtTime(240, now + duration);

    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(0.001, now);
    gain.gain.linearRampToValueAtTime(0.32 * intensity, now + duration * 0.4);
    gain.gain.exponentialRampToValueAtTime(0.001, now + duration);

    noise.connect(filter);
    filter.connect(gain);
    gain.connect(dest);

    noise.start(now);
    noise.stop(now + duration + 0.05);
    this.trackNode(noise);
  }

  // ─── 3. Heavy Metallic Landing Impact ───
  public playLandingImpact() {
    if (!this.ctx || !this.noiseBuffer || !this.sfxGain) return;
    const now = this.ctx.currentTime;

    // Sub-bass slam
    const sub = this.ctx.createOscillator();
    sub.type = 'sine';
    sub.frequency.setValueAtTime(135, now);
    sub.frequency.exponentialRampToValueAtTime(30, now + 0.45);

    const subGain = this.ctx.createGain();
    subGain.gain.setValueAtTime(0.85, now);
    subGain.gain.exponentialRampToValueAtTime(0.001, now + 0.6);

    sub.connect(subGain);
    subGain.connect(this.sfxGain);
    sub.start(now);
    sub.stop(now + 0.65);
    this.trackNode(sub);

    // Metallic crunch
    const clang = this.ctx.createOscillator();
    clang.type = 'triangle';
    clang.frequency.setValueAtTime(280, now);
    clang.frequency.exponentialRampToValueAtTime(92, now + 0.22);

    const clangGain = this.ctx.createGain();
    clangGain.gain.setValueAtTime(0.42, now);
    clangGain.gain.exponentialRampToValueAtTime(0.001, now + 0.26);

    clang.connect(clangGain);
    clangGain.connect(this.sfxGain);
    clang.start(now);
    clang.stop(now + 0.3);
    this.trackNode(clang);

    // Debris / dust burst
    const debris = this.ctx.createBufferSource();
    debris.buffer = this.noiseBuffer;
    const lp = this.ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.setValueAtTime(1200, now);
    lp.frequency.exponentialRampToValueAtTime(180, now + 0.5);

    const dGain = this.ctx.createGain();
    dGain.gain.setValueAtTime(0.4, now);
    dGain.gain.exponentialRampToValueAtTime(0.001, now + 0.55);

    debris.connect(lp);
    lp.connect(dGain);
    dGain.connect(this.sfxGain);
    debris.start(now);
    debris.stop(now + 0.6);
    this.trackNode(debris);
  }

  // ─── 4. Servo Motor Movement ───
  public playServoMove(duration = 0.28, pan = 0, pitchHz = 360) {
    if (!this.ctx || !this.sfxGain) return;
    const now = this.ctx.currentTime;
    const dest = this.createPanner(pan);

    const osc = this.ctx.createOscillator();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(pitchHz, now);
    osc.frequency.linearRampToValueAtTime(pitchHz * 1.38, now + duration * 0.6);
    osc.frequency.linearRampToValueAtTime(pitchHz * 0.9, now + duration);

    const filter = this.ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.setValueAtTime(900, now);
    filter.Q.setValueAtTime(4, now);

    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(0.001, now);
    gain.gain.linearRampToValueAtTime(0.14, now + 0.04);
    gain.gain.exponentialRampToValueAtTime(0.001, now + duration);

    osc.connect(filter);
    filter.connect(gain);
    gain.connect(dest);

    osc.start(now);
    osc.stop(now + duration + 0.03);
    this.trackNode(osc);
  }

  // ─── 5. Crisp Mechanical Click ("CHK") ───
  public playMechanicalClick(pan = 0, pitchScale = 1) {
    if (!this.ctx || !this.noiseBuffer || !this.sfxGain) return;
    const now = this.ctx.currentTime;
    const dest = this.createPanner(pan);

    const osc = this.ctx.createOscillator();
    osc.type = 'square';
    osc.frequency.setValueAtTime(1400 * pitchScale, now);
    osc.frequency.exponentialRampToValueAtTime(320 * pitchScale, now + 0.045);

    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(0.26, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.05);

    osc.connect(gain);
    gain.connect(dest);
    osc.start(now);
    osc.stop(now + 0.06);
    this.trackNode(osc);
  }

  // ─── 6. Heavy Armor Plate Lock ("K-CHUNK / CLANK") ───
  public playArmorLock(pan = 0, intensity = 1) {
    if (!this.ctx || !this.sfxGain) return;
    const now = this.ctx.currentTime;
    const dest = this.createPanner(pan);

    const thud = this.ctx.createOscillator();
    thud.type = 'triangle';
    thud.frequency.setValueAtTime(210, now);
    thud.frequency.exponentialRampToValueAtTime(52, now + 0.14);

    const thudGain = this.ctx.createGain();
    thudGain.gain.setValueAtTime(0.45 * intensity, now);
    thudGain.gain.exponentialRampToValueAtTime(0.001, now + 0.16);

    thud.connect(thudGain);
    thudGain.connect(dest);
    thud.start(now);
    thud.stop(now + 0.18);
    this.trackNode(thud);

    // Secondary latch snap
    const latch = this.ctx.createOscillator();
    latch.type = 'sawtooth';
    latch.frequency.setValueAtTime(980, now + 0.025);
    latch.frequency.exponentialRampToValueAtTime(280, now + 0.09);

    const lGain = this.ctx.createGain();
    lGain.gain.setValueAtTime(0.22 * intensity, now + 0.025);
    lGain.gain.exponentialRampToValueAtTime(0.001, now + 0.1);

    latch.connect(lGain);
    lGain.connect(dest);
    latch.start(now + 0.025);
    latch.stop(now + 0.11);
    this.trackNode(latch);
  }

  // ─── 7. Pneumatic Pressure Release ───
  public playPneumaticHiss(pan = 0, duration = 0.25) {
    if (!this.ctx || !this.noiseBuffer || !this.sfxGain) return;
    const now = this.ctx.currentTime;
    const dest = this.createPanner(pan);

    const noise = this.ctx.createBufferSource();
    noise.buffer = this.noiseBuffer;

    const hp = this.ctx.createBiquadFilter();
    hp.type = 'highpass';
    hp.frequency.setValueAtTime(2600, now);

    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(0.18, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + duration);

    noise.connect(hp);
    hp.connect(gain);
    gain.connect(dest);
    noise.start(now);
    noise.stop(now + duration + 0.03);
    this.trackNode(noise);
  }

  // ─── 8. Electrical Arc / Surge ───
  public playElectricalArc(pan = 0) {
    if (!this.ctx || !this.sfxGain) return;
    const now = this.ctx.currentTime;
    const dest = this.createPanner(pan);

    const carrier = this.ctx.createOscillator();
    carrier.type = 'sawtooth';
    carrier.frequency.setValueAtTime(1800, now);
    carrier.frequency.exponentialRampToValueAtTime(420, now + 0.16);

    const mod = this.ctx.createOscillator();
    mod.type = 'square';
    mod.frequency.setValueAtTime(95, now);

    const modGain = this.ctx.createGain();
    modGain.gain.setValueAtTime(650, now);

    const outGain = this.ctx.createGain();
    outGain.gain.setValueAtTime(0.18, now);
    outGain.gain.exponentialRampToValueAtTime(0.001, now + 0.17);

    mod.connect(modGain);
    modGain.connect(carrier.frequency);
    carrier.connect(outGain);
    outGain.connect(dest);

    mod.start(now);
    carrier.start(now);
    mod.stop(now + 0.18);
    carrier.stop(now + 0.18);
    this.trackNode(mod);
    this.trackNode(carrier);
  }

  // ─── 9. Reactor Ignition & Sustained Hum ───
  public playReactorIgnition() {
    if (!this.ctx || !this.sfxGain) return;
    const now = this.ctx.currentTime;

    const sweep = this.ctx.createOscillator();
    sweep.type = 'sine';
    sweep.frequency.setValueAtTime(140, now);
    sweep.frequency.exponentialRampToValueAtTime(620, now + 0.55);

    const sGain = this.ctx.createGain();
    sGain.gain.setValueAtTime(0.001, now);
    sGain.gain.linearRampToValueAtTime(0.28, now + 0.25);
    sGain.gain.exponentialRampToValueAtTime(0.001, now + 0.7);

    sweep.connect(sGain);
    sGain.connect(this.sfxGain);
    sweep.start(now);
    sweep.stop(now + 0.75);
    this.trackNode(sweep);

    if (!this.reactorHumOsc) {
      const hum = this.ctx.createOscillator();
      hum.type = 'sine';
      hum.frequency.setValueAtTime(96, now);

      const hGain = this.ctx.createGain();
      hGain.gain.setValueAtTime(0.001, now);
      hGain.gain.linearRampToValueAtTime(0.16, now + 0.5);

      hum.connect(hGain);
      hGain.connect(this.sfxGain);
      hum.start(now);
      this.trackNode(hum);
      this.reactorHumOsc = hum;
      this.reactorHumGain = hGain;
    }
  }

  // ─── 10. HUD Diagnostic Beeps & Chime ───
  public playHudBeep(freq = 880, duration = 0.07) {
    if (!this.ctx || !this.voiceGain) return;
    const now = this.ctx.currentTime;

    const osc = this.ctx.createOscillator();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(freq, now);

    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(0.001, now);
    gain.gain.linearRampToValueAtTime(0.12, now + 0.01);
    gain.gain.exponentialRampToValueAtTime(0.001, now + duration);

    osc.connect(gain);
    gain.connect(this.voiceGain);
    osc.start(now);
    osc.stop(now + duration + 0.02);
    this.trackNode(osc);
  }

  public playConfirmationChime() {
    if (!this.ctx || !this.voiceGain) return;
    const now = this.ctx.currentTime;
    const notes = [523.25, 659.25, 783.99];
    notes.forEach((freq, idx) => {
      if (!this.ctx || !this.voiceGain) return;
      const startAt = now + idx * 0.08;
      const osc = this.ctx.createOscillator();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, startAt);

      const gain = this.ctx.createGain();
      gain.gain.setValueAtTime(0.001, startAt);
      gain.gain.linearRampToValueAtTime(0.14, startAt + 0.03);
      gain.gain.exponentialRampToValueAtTime(0.001, startAt + 0.45);

      osc.connect(gain);
      gain.connect(this.voiceGain);
      osc.start(startAt);
      osc.stop(startAt + 0.5);
      this.trackNode(osc);
    });
  }

  // ─── 11. Energy Shockwave Blast ───
  public playEnergyShockwave() {
    if (!this.ctx || !this.noiseBuffer || !this.sfxGain) return;
    const now = this.ctx.currentTime;

    // Deep sub-bass drop
    const boom = this.ctx.createOscillator();
    boom.type = 'sine';
    boom.frequency.setValueAtTime(180, now);
    boom.frequency.exponentialRampToValueAtTime(26, now + 1.1);

    const bGain = this.ctx.createGain();
    bGain.gain.setValueAtTime(0.9, now);
    bGain.gain.exponentialRampToValueAtTime(0.001, now + 1.3);

    boom.connect(bGain);
    bGain.connect(this.sfxGain);
    boom.start(now);
    boom.stop(now + 1.35);
    this.trackNode(boom);

    // Wide cyan energy wash
    const wash = this.ctx.createBufferSource();
    wash.buffer = this.noiseBuffer;

    const bp = this.ctx.createBiquadFilter();
    bp.type = 'bandpass';
    bp.frequency.setValueAtTime(2200, now);
    bp.frequency.exponentialRampToValueAtTime(180, now + 1.2);
    bp.Q.setValueAtTime(0.9, now);

    const wGain = this.ctx.createGain();
    wGain.gain.setValueAtTime(0.48, now);
    wGain.gain.exponentialRampToValueAtTime(0.001, now + 1.25);

    wash.connect(bp);
    bp.connect(wGain);
    wGain.connect(this.sfxGain);
    wash.start(now);
    wash.stop(now + 1.3);
    this.trackNode(wash);

    // Fade out reactor hum cleanly
    if (this.reactorHumGain) {
      this.reactorHumGain.gain.setTargetAtTime(0.0001, now + 0.2, 0.25);
    }
  }

  // ─── 12. Synthesized AI Voice Line ───
  public speakLine(text: string) {
    if (this.muted || this.disposed || typeof window === 'undefined') return;
    if (!('speechSynthesis' in window)) return;

    try {
      window.speechSynthesis.cancel();
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.rate = 0.96;
      utterance.pitch = 0.88;
      utterance.volume = 0.82;

      const voices = window.speechSynthesis.getVoices();
      const preferred =
        voices.find(
          (v) =>
            v.lang.startsWith('en') &&
            (v.name.includes('Daniel') ||
              v.name.includes('Samantha') ||
              v.name.includes('Google') ||
              v.name.includes('Natural'))
        ) || voices.find((v) => v.lang.startsWith('en'));

      if (preferred) {
        utterance.voice = preferred;
      }

      window.speechSynthesis.speak(utterance);
    } catch {
      // Ignore speech synthesis errors
    }
  }

  // ─── 13. Stop & Dispose Everything Immediately ───
  public stopAll() {
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      try {
        window.speechSynthesis.cancel();
      } catch {
        // Ignore
      }
    }

    for (const node of Array.from(this.activeNodes)) {
      try {
        node.stop();
        node.disconnect();
      } catch {
        // Already stopped
      }
    }
    this.activeNodes.clear();
    this.ambienceDroneOsc = null;
    this.ambienceSubOsc = null;
    this.reactorHumOsc = null;
    this.reactorHumGain = null;
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
