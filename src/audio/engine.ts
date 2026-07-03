/* ---------------------------------------------------------------------------
   Procedural audio. No samples — everything is synthesized with the Web
   Audio API: a slow ambient drone per chapter, generative pentatonic
   sparkles, and a family of soft interaction sounds.

   Graph:  voices → (dry) ambBus/sfxBus → master → destination
                  ↘ (wet) reverb ------------------↗
--------------------------------------------------------------------------- */

import type { ChapterId } from '../render/palette';

interface ChapterSound {
  root: number; // Hz
  scale: number[]; // semitones for sparkles / plucks / solve arpeggios
  filter: number; // bed lowpass, Hz
  sparkleEvery: [number, number]; // min,max seconds between ambient notes
  breathEvery: [number, number]; // min,max seconds between pad swells
  /** chord shapes (scale degrees) the breathing pads choose from */
  breaths: number[][];
  bedLevel: number;
}

const CHAPTER_SOUND: Record<ChapterId, ChapterSound> = {
  dawn: {
    root: 220.0, // A3
    scale: [0, 2, 4, 7, 9, 12, 14],
    filter: 380,
    sparkleEvery: [3.5, 8],
    breathEvery: [16, 30],
    breaths: [
      [0, 4],
      [2, 7],
      [0, 7, 9],
      [4, 9],
    ],
    bedLevel: 0.022,
  },
  day: {
    root: 293.66, // D4
    scale: [0, 2, 4, 7, 9, 12],
    filter: 460,
    sparkleEvery: [3, 6.5],
    breathEvery: [15, 28],
    breaths: [
      [0, 4],
      [2, 9],
      [4, 7],
      [0, 2, 7],
    ],
    bedLevel: 0.017,
  },
  dusk: {
    root: 196.0, // G3
    scale: [0, 3, 5, 7, 10, 12],
    filter: 340,
    sparkleEvery: [4, 8.5],
    breathEvery: [17, 32],
    breaths: [
      [0, 3],
      [3, 7],
      [0, 5, 10],
      [5, 10],
    ],
    bedLevel: 0.024,
  },
  night: {
    root: 164.81, // E3
    scale: [0, 3, 5, 7, 10, 12, 15],
    filter: 290,
    sparkleEvery: [5, 10],
    breathEvery: [20, 36],
    breaths: [
      [0, 7],
      [3, 10],
      [0, 3, 7],
    ],
    bedLevel: 0.026,
  },
  unity: {
    root: 220.0,
    scale: [0, 2, 4, 7, 9, 12, 16],
    filter: 400,
    sparkleEvery: [3.5, 7],
    breathEvery: [14, 26],
    breaths: [
      [0, 4, 7],
      [2, 7],
      [4, 9, 12],
    ],
    bedLevel: 0.022,
  },
};

const st = (root: number, semitones: number): number =>
  root * Math.pow(2, semitones / 12);

interface BedVoice {
  oscs: OscillatorNode[];
  lfos: OscillatorNode[];
  gain: GainNode;
  filter: BiquadFilterNode;
}

export class AudioEngine {
  private ctx: AudioContext | null = null;
  private master!: GainNode;
  private sfxBus!: GainNode;
  private ambBus!: GainNode;
  private reverb!: ConvolverNode;

  private enabled = true;
  private bed: BedVoice | null = null;
  private chapter: ChapterId | null = null;
  private sparkleTimer = 3;
  private breathTimer = 6;

  /** Must be called from a user gesture before any sound can play. */
  unlock(): void {
    if (this.ctx) {
      if (this.ctx.state === 'suspended') void this.ctx.resume();
      return;
    }
    const Ctor = window.AudioContext ?? (window as any).webkitAudioContext;
    if (!Ctor) return;
    const ctx: AudioContext = new Ctor();
    this.ctx = ctx;

    this.master = ctx.createGain();
    this.master.gain.value = this.enabled ? 0.9 : 0;
    this.master.connect(ctx.destination);

    this.sfxBus = ctx.createGain();
    this.sfxBus.gain.value = 1;
    this.sfxBus.connect(this.master);

    this.ambBus = ctx.createGain();
    this.ambBus.gain.value = 1;
    this.ambBus.connect(this.master);

    // generated impulse-response reverb — a soft hall
    this.reverb = ctx.createConvolver();
    this.reverb.buffer = this.makeImpulse(3.2, 2.4);
    const wet = ctx.createGain();
    wet.gain.value = 0.5;
    this.reverb.connect(wet);
    wet.connect(this.master);

    // if a chapter was requested before unlock, start its drone now
    if (this.chapter) {
      const c = this.chapter;
      this.chapter = null;
      this.setChapter(c);
    }
  }

  get ready(): boolean {
    return this.ctx !== null;
  }

  setEnabled(on: boolean): void {
    this.enabled = on;
    if (this.ctx) {
      const t = this.ctx.currentTime;
      this.master.gain.cancelScheduledValues(t);
      this.master.gain.setTargetAtTime(on ? 0.9 : 0, t, 0.15);
    }
  }

  private makeImpulse(seconds: number, decay: number): AudioBuffer {
    const ctx = this.ctx!;
    const rate = ctx.sampleRate;
    const len = Math.floor(rate * seconds);
    const buf = ctx.createBuffer(2, len, rate);
    for (let ch = 0; ch < 2; ch++) {
      const data = buf.getChannelData(ch);
      for (let i = 0; i < len; i++) {
        data[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, decay);
      }
    }
    return buf;
  }

  /* ---- ambient ------------------------------------------------------------ */

  /**
   * The ambience has three layers, all quiet enough to live with for an hour:
   *   bed      — a barely-audible warm sine an octave down, tide-swelling
   *              over ~26 s so it is never a constant tone
   *   breaths  — every 15–35 s a soft two/three-note pad rises for a few
   *              seconds and dissolves into the hall
   *   sparkles — occasional single pentatonic notes, panned wide
   */
  setChapter(chapter: ChapterId | null): void {
    if (chapter === this.chapter) return;
    this.chapter = chapter;
    if (!this.ctx) return;

    const t = this.ctx.currentTime;
    if (this.bed) {
      const old = this.bed;
      old.gain.gain.cancelScheduledValues(t);
      old.gain.gain.setTargetAtTime(0, t, 1.6);
      const stopAt = t + 7;
      for (const o of old.oscs) o.stop(stopAt);
      for (const l of old.lfos) l.stop(stopAt);
      this.bed = null;
    }
    if (!chapter) return;

    const cfg = CHAPTER_SOUND[chapter];
    const ctx = this.ctx;

    const gain = ctx.createGain();
    gain.gain.value = 0;
    gain.gain.setTargetAtTime(cfg.bedLevel, t, 3.5);

    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = cfg.filter;
    filter.Q.value = 0.3;
    filter.connect(gain);
    gain.connect(this.ambBus);
    const wetSend = ctx.createGain();
    wetSend.gain.value = 0.55;
    gain.connect(wetSend);
    wetSend.connect(this.reverb);

    // two soft sines an octave down: root and a whisper of the fifth
    const oscs: OscillatorNode[] = [];
    [
      { semi: -12, level: 0.85, detunes: [-3, 3] },
      { semi: -5, level: 0.22, detunes: [-2, 2] },
    ].forEach((v) => {
      for (const detune of v.detunes) {
        const o = ctx.createOscillator();
        o.type = 'sine';
        o.frequency.value = st(cfg.root, v.semi);
        o.detune.value = detune;
        const og = ctx.createGain();
        og.gain.value = v.level / v.detunes.length;
        o.connect(og);
        og.connect(filter);
        o.start(t);
        oscs.push(o);
      }
    });

    // the tide: the bed swells and recedes so the ear never pins it down
    const tide = ctx.createOscillator();
    tide.frequency.value = 1 / 26;
    const tideDepth = ctx.createGain();
    tideDepth.gain.value = cfg.bedLevel * 0.45;
    tide.connect(tideDepth);
    tideDepth.connect(gain.gain);
    tide.start(t);

    // and a very slow color drift on the filter
    const lfo = ctx.createOscillator();
    lfo.frequency.value = 0.045;
    const lfoGain = ctx.createGain();
    lfoGain.gain.value = cfg.filter * 0.3;
    lfo.connect(lfoGain);
    lfoGain.connect(filter.frequency);
    lfo.start(t);

    this.bed = { oscs, lfos: [tide, lfo], gain, filter };
    this.sparkleTimer = 2 + Math.random() * 3;
    this.breathTimer = 5 + Math.random() * 6;
  }

  /** One soft pad chord that rises, holds a moment, and dissolves. */
  private breath(): void {
    if (!this.ctx || !this.chapter) return;
    const cfg = CHAPTER_SOUND[this.chapter];
    const shape = cfg.breaths[Math.floor(Math.random() * cfg.breaths.length)];
    const attack = 2.6 + Math.random() * 1.6;
    const release = 5.5 + Math.random() * 3;
    const basePan = Math.random() * 0.8 - 0.4;
    shape.forEach((deg, i) => {
      const semi = cfg.scale[deg % cfg.scale.length] + 12 * Math.floor(deg / cfg.scale.length);
      this.voice(st(cfg.root, semi), {
        type: 'sine',
        level: 0.02 + Math.random() * 0.008,
        attack,
        release,
        when: i * 0.7,
        pan: basePan + (i - shape.length / 2) * 0.25,
        wet: 1.6,
        harmonics: [
          [1, 1],
          [2, 0.16],
        ],
      });
    });
  }

  /** Called every frame — drives the generative sparkles and breaths. */
  update(dt: number): void {
    if (!this.ctx || !this.chapter || !this.enabled) return;
    const cfg = CHAPTER_SOUND[this.chapter];
    this.sparkleTimer -= dt;
    if (this.sparkleTimer <= 0) {
      const [lo, hi] = cfg.sparkleEvery;
      this.sparkleTimer = lo + Math.random() * (hi - lo);
      const semi = cfg.scale[Math.floor(Math.random() * cfg.scale.length)];
      const octave = Math.random() < 0.4 ? 12 : 0;
      this.pluck(st(cfg.root, semi + 12 + octave), {
        level: 0.016 + Math.random() * 0.016,
        pan: Math.random() * 1.4 - 0.7,
        wet: 1.3,
        release: 2.4,
      });
    }
    this.breathTimer -= dt;
    if (this.breathTimer <= 0) {
      const [lo, hi] = cfg.breathEvery;
      this.breathTimer = lo + Math.random() * (hi - lo);
      this.breath();
    }
  }

  /* ---- synthesis primitives ------------------------------------------------ */

  private voice(
    freq: number,
    opts: {
      type?: OscillatorType;
      level?: number;
      attack?: number;
      release?: number;
      pan?: number;
      wet?: number;
      when?: number;
      bendTo?: number;
      harmonics?: [number, number][]; // [ratio, level]
    } = {}
  ): void {
    if (!this.ctx || !this.enabled) return;
    const ctx = this.ctx;
    const t0 = (opts.when ?? 0) + ctx.currentTime;
    const level = opts.level ?? 0.08;
    const attack = opts.attack ?? 0.008;
    const release = opts.release ?? 0.5;

    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0, t0);
    gain.gain.linearRampToValueAtTime(level, t0 + attack);
    gain.gain.exponentialRampToValueAtTime(0.0001, t0 + attack + release);

    let out: AudioNode = gain;
    if (opts.pan !== undefined && ctx.createStereoPanner) {
      const pan = ctx.createStereoPanner();
      pan.pan.value = opts.pan;
      gain.connect(pan);
      out = pan;
    }
    out.connect(this.sfxBus);
    if (opts.wet && opts.wet > 0) {
      const send = ctx.createGain();
      send.gain.value = opts.wet;
      out.connect(send);
      send.connect(this.reverb);
    }

    const partials: [number, number][] = opts.harmonics ?? [[1, 1]];
    const stopAt = t0 + attack + release + 0.1;
    for (const [ratio, plevel] of partials) {
      const o = ctx.createOscillator();
      o.type = opts.type ?? 'sine';
      o.frequency.setValueAtTime(freq * ratio, t0);
      if (opts.bendTo) {
        o.frequency.exponentialRampToValueAtTime(opts.bendTo * ratio, stopAt - 0.1);
      }
      const og = ctx.createGain();
      og.gain.value = plevel;
      o.connect(og);
      og.connect(gain);
      o.start(t0);
      o.stop(stopAt);
    }
  }

  private noise(opts: {
    level?: number;
    attack?: number;
    release?: number;
    freq?: number;
    q?: number;
    sweepTo?: number;
    when?: number;
    wet?: number;
  }): void {
    if (!this.ctx || !this.enabled) return;
    const ctx = this.ctx;
    const t0 = (opts.when ?? 0) + ctx.currentTime;
    const dur = (opts.attack ?? 0.02) + (opts.release ?? 0.3) + 0.05;
    const buf = ctx.createBuffer(1, Math.ceil(ctx.sampleRate * dur), ctx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
    const src = ctx.createBufferSource();
    src.buffer = buf;

    const filter = ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.setValueAtTime(opts.freq ?? 800, t0);
    if (opts.sweepTo) {
      filter.frequency.exponentialRampToValueAtTime(opts.sweepTo, t0 + dur * 0.9);
    }
    filter.Q.value = opts.q ?? 1;

    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0, t0);
    gain.gain.linearRampToValueAtTime(opts.level ?? 0.05, t0 + (opts.attack ?? 0.02));
    gain.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);

    src.connect(filter);
    filter.connect(gain);
    gain.connect(this.sfxBus);
    if (opts.wet) {
      const send = ctx.createGain();
      send.gain.value = opts.wet;
      gain.connect(send);
      send.connect(this.reverb);
    }
    src.start(t0);
    src.stop(t0 + dur + 0.05);
  }

  /* ---- the sound vocabulary ------------------------------------------------ */

  /** Soft fingertip tap — generic UI press. */
  tap(): void {
    this.voice(620, { level: 0.035, release: 0.12, harmonics: [[1, 1], [2.7, 0.2]] });
  }

  /** A ring settling into a notch. */
  tick(pitch = 1): void {
    this.voice(340 * pitch, { level: 0.05, release: 0.09, type: 'triangle' });
    this.noise({ level: 0.02, release: 0.05, freq: 2400, q: 2 });
  }

  /** Warm pluck used for musical feedback. */
  pluck(
    freq: number,
    opts: { level?: number; pan?: number; wet?: number; release?: number; when?: number } = {}
  ): void {
    this.voice(freq, {
      level: opts.level ?? 0.07,
      release: opts.release ?? 1.1,
      attack: 0.005,
      pan: opts.pan,
      wet: opts.wet ?? 0.8,
      when: opts.when,
      harmonics: [
        [1, 1],
        [2, 0.28],
        [3, 0.1],
        [4.2, 0.04],
      ],
    });
  }

  /** A star singing one scale degree of the current chapter. */
  note(degree: number, opts: { when?: number; level?: number; pan?: number } = {}): void {
    const cfg = CHAPTER_SOUND[this.chapter ?? 'night'];
    const semi = cfg.scale[((degree % cfg.scale.length) + cfg.scale.length) % cfg.scale.length];
    const octave = Math.floor(degree / cfg.scale.length) * 12;
    this.pluck(st(cfg.root, semi + 12 + octave), {
      level: opts.level ?? 0.075,
      when: opts.when,
      pan: opts.pan,
      wet: 1.1,
      release: 1.5,
    });
  }

  /** Mirror pivot — a small glassy turn. */
  swivel(): void {
    this.voice(520, { level: 0.03, release: 0.14, type: 'triangle', bendTo: 700 });
    this.noise({ level: 0.014, release: 0.08, freq: 3200, q: 3 });
  }

  /** A beam reaching a crystal. */
  shimmer(pan = 0): void {
    this.voice(1240, {
      level: 0.035,
      release: 0.8,
      wet: 1.4,
      pan,
      harmonics: [
        [1, 1],
        [1.5, 0.4],
        [2.02, 0.25],
      ],
    });
  }

  /** Disk drag pickup / put down. */
  lift(up: boolean): void {
    this.voice(up ? 300 : 260, {
      level: 0.028,
      release: 0.16,
      type: 'sine',
      bendTo: up ? 380 : 210,
    });
  }

  /** Gentle "not quite" — never harsh. */
  soften(): void {
    this.voice(196, { level: 0.04, release: 0.5, type: 'sine', harmonics: [[1, 1], [0.5, 0.5]] });
  }

  /** The solved payoff: a slow rising arpeggio and a warm pad swell. */
  solve(): void {
    const cfg = CHAPTER_SOUND[this.chapter ?? 'dawn'];
    const degrees = [0, 2, 4, 5, 7];
    degrees.forEach((d, i) => {
      const semi = cfg.scale[d % cfg.scale.length] + 12 * Math.floor(d / cfg.scale.length);
      this.pluck(st(cfg.root, semi + 12), {
        when: i * 0.13,
        level: 0.065,
        pan: (i / degrees.length) * 0.8 - 0.4,
        wet: 1.3,
        release: 1.9,
      });
    });
    // pad swell underneath
    this.voice(st(cfg.root, 12), {
      level: 0.05,
      attack: 0.7,
      release: 2.6,
      type: 'triangle',
      wet: 1.2,
      harmonics: [
        [1, 1],
        [1.5, 0.5],
        [2, 0.35],
      ],
    });
    this.noise({ level: 0.02, attack: 0.5, release: 2, freq: 1800, sweepTo: 4200, q: 0.8, wet: 1.5 });
  }

  /** Big chord for chapter completion and the finale. */
  grandChord(): void {
    const cfg = CHAPTER_SOUND[this.chapter ?? 'unity'];
    [0, 7, 12, 16, 19, 24].forEach((semi, i) => {
      this.pluck(st(cfg.root, semi), {
        when: i * 0.22,
        level: 0.06,
        pan: (i % 2 === 0 ? -1 : 1) * 0.35,
        wet: 1.6,
        release: 3,
      });
    });
    this.noise({ level: 0.025, attack: 1.2, release: 3.4, freq: 1200, sweepTo: 5000, q: 0.7, wet: 1.8 });
  }

  /** Scene transition — air moving. */
  whoosh(): void {
    this.noise({ level: 0.03, attack: 0.25, release: 0.7, freq: 400, sweepTo: 1400, q: 0.6, wet: 0.8 });
  }

  /** Star unlock ping on the map. */
  unlockPing(): void {
    this.pluck(880, { level: 0.05, wet: 1.2, release: 1.4 });
    this.pluck(1320, { level: 0.03, when: 0.12, wet: 1.2, release: 1.4 });
  }
}
