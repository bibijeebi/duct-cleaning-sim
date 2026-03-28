import { Scene } from '@babylonjs/core';

type SoundName =
  | 'footstep'
  | 'compressor_hum'
  | 'vacuum_motor'
  | 'wand_blast'
  | 'screw_gun'
  | 'pressure_washer'
  | 'debris_rattle'
  | 'ambient_hvac'
  | 'ambient_fluorescent'
  | 'alert_problem'
  | 'alert_phase'
  | 'alert_success'
  | 'alert_error';

interface ProceduralSoundConfig {
  type: OscillatorType;
  frequency: number;
  duration: number;
  gain: number;
  fadeIn?: number;
  fadeOut?: number;
  noise?: boolean;
  modFreq?: number;
  modDepth?: number;
  filterFreq?: number;
  filterType?: BiquadFilterType;
  filterQ?: number;
}

const SOUND_CONFIGS: Record<SoundName, ProceduralSoundConfig> = {
  footstep: {
    type: 'square',
    frequency: 120,
    duration: 0.08,
    gain: 0.15,
    fadeOut: 0.04,
    noise: true,
    filterFreq: 800,
    filterType: 'lowpass',
    filterQ: 1,
  },
  compressor_hum: {
    type: 'sawtooth',
    frequency: 60,
    duration: 2.0,
    gain: 0.08,
    fadeIn: 0.3,
    fadeOut: 0.3,
    modFreq: 2,
    modDepth: 5,
    filterFreq: 200,
    filterType: 'lowpass',
    filterQ: 2,
  },
  vacuum_motor: {
    type: 'sawtooth',
    frequency: 90,
    duration: 2.0,
    gain: 0.1,
    fadeIn: 0.2,
    fadeOut: 0.2,
    modFreq: 4,
    modDepth: 8,
    filterFreq: 400,
    filterType: 'lowpass',
    filterQ: 1.5,
  },
  wand_blast: {
    type: 'sawtooth',
    frequency: 200,
    duration: 0.4,
    gain: 0.2,
    fadeIn: 0.05,
    fadeOut: 0.15,
    noise: true,
    filterFreq: 2000,
    filterType: 'highpass',
    filterQ: 0.5,
  },
  screw_gun: {
    type: 'square',
    frequency: 300,
    duration: 0.3,
    gain: 0.18,
    fadeIn: 0.02,
    fadeOut: 0.05,
    modFreq: 40,
    modDepth: 100,
    filterFreq: 1500,
    filterType: 'lowpass',
    filterQ: 2,
  },
  pressure_washer: {
    type: 'sawtooth',
    frequency: 150,
    duration: 1.0,
    gain: 0.15,
    fadeIn: 0.1,
    fadeOut: 0.2,
    noise: true,
    modFreq: 8,
    modDepth: 20,
    filterFreq: 3000,
    filterType: 'lowpass',
    filterQ: 1,
  },
  debris_rattle: {
    type: 'square',
    frequency: 400,
    duration: 0.15,
    gain: 0.1,
    fadeOut: 0.08,
    noise: true,
    filterFreq: 1200,
    filterType: 'bandpass',
    filterQ: 3,
  },
  ambient_hvac: {
    type: 'sine',
    frequency: 55,
    duration: 4.0,
    gain: 0.03,
    fadeIn: 1.0,
    fadeOut: 1.0,
    modFreq: 0.5,
    modDepth: 3,
    filterFreq: 150,
    filterType: 'lowpass',
    filterQ: 1,
  },
  ambient_fluorescent: {
    type: 'sine',
    frequency: 120,
    duration: 3.0,
    gain: 0.015,
    fadeIn: 0.5,
    fadeOut: 0.5,
    modFreq: 0.3,
    modDepth: 2,
    filterFreq: 200,
    filterType: 'lowpass',
    filterQ: 2,
  },
  alert_problem: {
    type: 'square',
    frequency: 440,
    duration: 0.5,
    gain: 0.2,
    fadeIn: 0.02,
    fadeOut: 0.15,
    modFreq: 6,
    modDepth: 50,
  },
  alert_phase: {
    type: 'sine',
    frequency: 523,
    duration: 0.3,
    gain: 0.15,
    fadeIn: 0.02,
    fadeOut: 0.1,
  },
  alert_success: {
    type: 'sine',
    frequency: 660,
    duration: 0.25,
    gain: 0.12,
    fadeIn: 0.01,
    fadeOut: 0.1,
  },
  alert_error: {
    type: 'square',
    frequency: 220,
    duration: 0.4,
    gain: 0.18,
    fadeIn: 0.02,
    fadeOut: 0.15,
  },
};

export class AudioManager {
  private _scene: Scene;
  private _audioContext: AudioContext | null = null;
  private _masterGain: GainNode | null = null;
  private _loopingSources: Map<string, { source: AudioBufferSourceNode; gain: GainNode }> = new Map();
  private _footstepTimer: number = 0;
  private _footstepInterval: number = 0.45; // seconds between footsteps
  private _isMoving: boolean = false;
  private _ambientStarted: boolean = false;
  private _disposed: boolean = false;
  private _muted: boolean = false;

  constructor(scene: Scene) {
    this._scene = scene;
  }

  private _ensureContext(): AudioContext | null {
    if (this._disposed) return null;
    if (!this._audioContext) {
      try {
        this._audioContext = new AudioContext();
        this._masterGain = this._audioContext.createGain();
        this._masterGain.gain.value = 0.7;
        this._masterGain.connect(this._audioContext.destination);
      } catch {
        return null;
      }
    }
    if (this._audioContext.state === 'suspended') {
      this._audioContext.resume();
    }
    return this._audioContext;
  }

  private _createNoiseBuffer(ctx: AudioContext, duration: number): AudioBuffer {
    const sampleRate = ctx.sampleRate;
    const length = Math.floor(sampleRate * duration);
    const buffer = ctx.createBuffer(1, length, sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < length; i++) {
      data[i] = Math.random() * 2 - 1;
    }
    return buffer;
  }

  /**
   * Play a one-shot procedural sound.
   */
  playSound(name: SoundName): void {
    if (this._muted) return;
    const ctx = this._ensureContext();
    if (!ctx || !this._masterGain) return;

    const config = SOUND_CONFIGS[name];
    if (!config) return;

    const now = ctx.currentTime;

    // Gain envelope
    const gainNode = ctx.createGain();
    gainNode.gain.setValueAtTime(0, now);
    if (config.fadeIn && config.fadeIn > 0) {
      gainNode.gain.linearRampToValueAtTime(config.gain, now + config.fadeIn);
    } else {
      gainNode.gain.setValueAtTime(config.gain, now);
    }
    const fadeOutStart = now + config.duration - (config.fadeOut ?? 0.05);
    gainNode.gain.setValueAtTime(config.gain, fadeOutStart);
    gainNode.gain.linearRampToValueAtTime(0, now + config.duration);

    let lastNode: AudioNode = gainNode;

    // Optional filter
    if (config.filterFreq && config.filterType) {
      const filter = ctx.createBiquadFilter();
      filter.type = config.filterType;
      filter.frequency.value = config.filterFreq;
      filter.Q.value = config.filterQ ?? 1;
      gainNode.connect(filter);
      lastNode = filter;
    }

    lastNode.connect(this._masterGain);

    // Oscillator
    const osc = ctx.createOscillator();
    osc.type = config.type;
    osc.frequency.value = config.frequency;

    // Optional frequency modulation
    if (config.modFreq && config.modDepth) {
      const lfo = ctx.createOscillator();
      const lfoGain = ctx.createGain();
      lfo.frequency.value = config.modFreq;
      lfoGain.gain.value = config.modDepth;
      lfo.connect(lfoGain);
      lfoGain.connect(osc.frequency);
      lfo.start(now);
      lfo.stop(now + config.duration + 0.1);
    }

    osc.connect(gainNode);
    osc.start(now);
    osc.stop(now + config.duration + 0.1);

    // Optional noise layer
    if (config.noise) {
      const noiseBuffer = this._createNoiseBuffer(ctx, config.duration);
      const noiseSource = ctx.createBufferSource();
      noiseSource.buffer = noiseBuffer;
      const noiseGain = ctx.createGain();
      noiseGain.gain.value = config.gain * 0.5;

      if (config.filterFreq && config.filterType) {
        const noiseFilter = ctx.createBiquadFilter();
        noiseFilter.type = config.filterType;
        noiseFilter.frequency.value = config.filterFreq;
        noiseFilter.Q.value = config.filterQ ?? 1;
        noiseSource.connect(noiseGain);
        noiseGain.connect(noiseFilter);
        noiseFilter.connect(this._masterGain);
      } else {
        noiseSource.connect(noiseGain);
        noiseGain.connect(this._masterGain);
      }

      noiseSource.start(now);
      noiseSource.stop(now + config.duration + 0.1);
    }
  }

  /**
   * Start a looping sound (ambient, compressor, vacuum).
   */
  startLoop(name: SoundName): void {
    if (this._muted) return;
    if (this._loopingSources.has(name)) return;
    const ctx = this._ensureContext();
    if (!ctx || !this._masterGain) return;

    const config = SOUND_CONFIGS[name];
    if (!config) return;

    // Create a looping buffer from procedural generation
    const sampleRate = ctx.sampleRate;
    const bufferLength = Math.floor(sampleRate * config.duration);
    const buffer = ctx.createBuffer(1, bufferLength, sampleRate);
    const data = buffer.getChannelData(0);

    // Render the sound into a buffer for looping
    for (let i = 0; i < bufferLength; i++) {
      const t = i / sampleRate;
      let sample = 0;

      // Base oscillator
      const phase = 2 * Math.PI * config.frequency * t;
      const modulation = config.modFreq && config.modDepth
        ? Math.sin(2 * Math.PI * config.modFreq * t) * config.modDepth
        : 0;
      const freq = config.frequency + modulation;
      const modPhase = 2 * Math.PI * freq * t;

      switch (config.type) {
        case 'sine':
          sample = Math.sin(modPhase);
          break;
        case 'square':
          sample = Math.sin(modPhase) > 0 ? 1 : -1;
          break;
        case 'sawtooth':
          sample = 2 * ((freq * t) % 1) - 1;
          break;
        case 'triangle':
          sample = 2 * Math.abs(2 * ((freq * t) % 1) - 1) - 1;
          break;
      }

      // Add noise if configured
      if (config.noise) {
        sample = sample * 0.6 + (Math.random() * 2 - 1) * 0.4;
      }

      data[i] = sample * config.gain;
    }

    // Crossfade the loop edges for seamless looping
    const fadeLen = Math.min(Math.floor(sampleRate * 0.05), bufferLength / 4);
    for (let i = 0; i < fadeLen; i++) {
      const fade = i / fadeLen;
      data[i] *= fade;
      data[bufferLength - 1 - i] *= fade;
    }

    const source = ctx.createBufferSource();
    source.buffer = buffer;
    source.loop = true;

    const gainNode = ctx.createGain();
    gainNode.gain.value = 0;
    gainNode.gain.linearRampToValueAtTime(1.0, ctx.currentTime + 0.5);

    // Optional filter for loop
    if (config.filterFreq && config.filterType) {
      const filter = ctx.createBiquadFilter();
      filter.type = config.filterType;
      filter.frequency.value = config.filterFreq;
      filter.Q.value = config.filterQ ?? 1;
      source.connect(gainNode);
      gainNode.connect(filter);
      filter.connect(this._masterGain);
    } else {
      source.connect(gainNode);
      gainNode.connect(this._masterGain);
    }

    source.start();
    this._loopingSources.set(name, { source, gain: gainNode });
  }

  /**
   * Stop a looping sound with a fade-out.
   */
  stopLoop(name: SoundName): void {
    const entry = this._loopingSources.get(name);
    if (!entry) return;
    const ctx = this._audioContext;
    if (!ctx) return;

    entry.gain.gain.linearRampToValueAtTime(0, ctx.currentTime + 0.3);
    setTimeout(() => {
      try { entry.source.stop(); } catch { /* already stopped */ }
      this._loopingSources.delete(name);
    }, 400);
  }

  /**
   * Stop all looping sounds.
   */
  stopAllLoops(): void {
    for (const name of [...this._loopingSources.keys()]) {
      this.stopLoop(name as SoundName);
    }
  }

  /**
   * Start ambient building sounds (HVAC hum + fluorescent buzz).
   */
  startAmbient(): void {
    if (this._ambientStarted) return;
    this._ambientStarted = true;
    this.startLoop('ambient_hvac');
    this.startLoop('ambient_fluorescent');
  }

  /**
   * Stop ambient building sounds.
   */
  stopAmbient(): void {
    this._ambientStarted = false;
    this.stopLoop('ambient_hvac');
    this.stopLoop('ambient_fluorescent');
  }

  /**
   * Update footstep sounds based on player movement. Call from render loop.
   */
  updateFootsteps(deltaTime: number, isMoving: boolean): void {
    this._isMoving = isMoving;
    if (!isMoving) {
      this._footstepTimer = 0;
      return;
    }

    this._footstepTimer += deltaTime;
    if (this._footstepTimer >= this._footstepInterval) {
      this._footstepTimer -= this._footstepInterval;
      this.playSound('footstep');
    }
  }

  /**
   * Toggle mute state.
   */
  toggleMute(): boolean {
    this._muted = !this._muted;
    if (this._muted) {
      this.stopAllLoops();
      if (this._masterGain) {
        this._masterGain.gain.value = 0;
      }
    } else {
      if (this._masterGain) {
        this._masterGain.gain.value = 0.7;
      }
      if (this._ambientStarted) {
        this._ambientStarted = false;
        this.startAmbient();
      }
    }
    return this._muted;
  }

  get isMuted(): boolean {
    return this._muted;
  }

  dispose(): void {
    this._disposed = true;
    this.stopAllLoops();
    if (this._audioContext) {
      this._audioContext.close();
      this._audioContext = null;
    }
    this._masterGain = null;
  }
}
