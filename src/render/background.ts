/* ---------------------------------------------------------------------------
   The living sky. Every chapter owns a full scene, not just a palette:

     dawn  — a great soft sun climbing from behind smooth hills, pollen
             drifting upward on the morning air
     day   — a small hard sun high in a crisp sky, distant peaks, tiny
             glints sparking in the air
     dusk  — an enormous sinking sun behind layered mesas, embers on the
             wind, and now and then a flock of birds crossing home
     night — a crescent moon, a milky-way veil, deep dunes, and the
             occasional shooting star for whoever happens to be looking
     unity — an aurora breathing over the horizon, with faint echoes of
             every earlier sky woven in

   Chapter changes crossfade both palette and scenery.
--------------------------------------------------------------------------- */

import { mixPalette, PALETTES, withAlpha, type ChapterId, type Palette } from './palette';
import { clamp01, seeded, smoothstep, TAU } from './ease';
import type { View } from '../core/types';

interface Star {
  x: number;
  y: number;
  r: number;
  phase: number;
}

interface Mote {
  x: number; // 0..1
  y: number; // 0..1
  s: number; // size seed 0..1
  phase: number;
}

interface DuneLayer {
  base: number; // fraction of height
  amp: number; // fraction of height
  alpha: number;
  jag: number; // 0 = smooth hills, 1 = sharp peaks
  flat: number; // 0 = round, 1 = mesa-flattened
}

interface SkyTheme {
  body: 'rising' | 'high' | 'setting' | 'moon' | 'aurora';
  motes: 'pollen' | 'sparkle' | 'ember' | 'none' | 'weave';
  dunes: DuneLayer[];
  milkyWay?: boolean;
  shooting?: boolean;
  birds?: boolean;
  echoes?: boolean;
}

const THEMES: Record<ChapterId, SkyTheme> = {
  dawn: {
    body: 'rising',
    motes: 'pollen',
    dunes: [
      { base: 0.8, amp: 0.05, alpha: 0.26, jag: 0, flat: 0 },
      { base: 0.9, amp: 0.038, alpha: 0.5, jag: 0, flat: 0 },
    ],
  },
  day: {
    body: 'high',
    motes: 'sparkle',
    dunes: [
      { base: 0.84, amp: 0.075, alpha: 0.2, jag: 0.75, flat: 0 },
      { base: 0.93, amp: 0.045, alpha: 0.42, jag: 0.35, flat: 0 },
    ],
  },
  dusk: {
    body: 'setting',
    motes: 'ember',
    birds: true,
    dunes: [
      { base: 0.74, amp: 0.035, alpha: 0.2, jag: 0, flat: 0.75 },
      { base: 0.84, amp: 0.045, alpha: 0.38, jag: 0, flat: 0.7 },
      { base: 0.93, amp: 0.05, alpha: 0.6, jag: 0, flat: 0.3 },
    ],
  },
  night: {
    body: 'moon',
    motes: 'none',
    milkyWay: true,
    shooting: true,
    dunes: [
      { base: 0.87, amp: 0.035, alpha: 0.34, jag: 0, flat: 0 },
      { base: 0.95, amp: 0.03, alpha: 0.55, jag: 0, flat: 0 },
    ],
  },
  unity: {
    body: 'aurora',
    motes: 'weave',
    milkyWay: true,
    echoes: true,
    dunes: [
      { base: 0.82, amp: 0.05, alpha: 0.22, jag: 0.3, flat: 0.3 },
      { base: 0.91, amp: 0.04, alpha: 0.45, jag: 0, flat: 0 },
    ],
  },
};

export class Background {
  private from: Palette;
  private to: Palette;
  private themeFrom: SkyTheme;
  private themeTo: SkyTheme;
  private blend = 1;
  private blendSpeed = 0.5;

  /** Current interpolated palette — scenes read colors from here. */
  current: Palette;

  private stars: Star[] = [];
  private motes: Mote[] = [];
  private grain: HTMLCanvasElement | null = null;
  reducedMotion = false;

  // rare-event state
  private shootTimer = 7;
  private shoot: { x: number; y: number; dx: number; dy: number; t: number } | null = null;
  private birdTimer = 9;
  private birds: { y: number; t: number; dir: number } | null = null;

  constructor(chapter: ChapterId) {
    const p = PALETTES[chapter];
    this.from = p;
    this.to = p;
    this.current = p;
    this.themeFrom = THEMES[chapter];
    this.themeTo = THEMES[chapter];
    for (let i = 0; i < 110; i++) {
      this.stars.push({
        x: seeded(i * 3 + 1),
        y: seeded(i * 3 + 2) * 0.8,
        r: 0.6 + seeded(i * 3 + 3) * 1.5,
        phase: seeded(i * 7 + 5) * TAU,
      });
    }
    for (let i = 0; i < 26; i++) {
      this.motes.push({
        x: seeded(i * 5 + 11),
        y: seeded(i * 5 + 13),
        s: seeded(i * 5 + 17),
        phase: seeded(i * 5 + 19) * TAU,
      });
    }
  }

  setChapter(chapter: ChapterId, seconds = 2.2): void {
    const p = PALETTES[chapter];
    const th = THEMES[chapter];
    if (p === this.to && th === this.themeTo) return;
    this.from = this.current;
    this.themeFrom = this.blend < 1 ? this.themeTo : this.themeFrom;
    // when interrupted mid-blend, the old "to" is what's mostly on screen
    if (this.blend < 1) this.themeFrom = this.themeTo;
    this.to = p;
    this.themeTo = th;
    this.blend = 0;
    this.blendSpeed = 1 / Math.max(0.01, seconds);
  }

  update(dt: number): void {
    if (this.blend < 1) {
      this.blend = clamp01(this.blend + dt * this.blendSpeed);
      this.current = mixPalette(this.from, this.to, smoothstep(this.blend));
    }
  }

  render(ctx: CanvasRenderingContext2D, view: View, t: number): void {
    const { w, h } = view;
    const p = this.current;
    const u = smoothstep(this.blend);

    // sky
    const sky = ctx.createLinearGradient(0, 0, 0, h);
    sky.addColorStop(0, p.top);
    sky.addColorStop(0.55, p.mid);
    sky.addColorStop(1, p.bottom);
    ctx.fillStyle = sky;
    ctx.fillRect(0, 0, w, h);

    // breathing glow orbs — shared across all skies
    this.renderGlowOrbs(ctx, view, t, p);

    // theme layers, crossfaded
    if (u < 1) this.renderTheme(ctx, view, t, this.themeFrom, 1 - u);
    this.renderTheme(ctx, view, t, this.themeTo, u);

    this.renderGrain(ctx, view);
    this.renderVignette(ctx, view, p);
  }

  /* ---- shared layers ---------------------------------------------------------- */

  private renderGlowOrbs(
    ctx: CanvasRenderingContext2D,
    view: View,
    t: number,
    p: Palette
  ): void {
    const { w, h } = view;
    const drift = this.reducedMotion ? 0 : 1;
    ctx.save();
    ctx.globalCompositeOperation = p.dark ? 'lighter' : 'soft-light';
    for (let i = 0; i < 4; i++) {
      const sx = seeded(i * 11 + 4);
      const sy = seeded(i * 11 + 6);
      const breathe = Math.sin(t * 0.13 + i * 1.9) * drift;
      const x = (0.12 + sx * 0.76) * w + Math.sin(t * 0.05 + i * 2.1) * w * 0.03 * drift;
      const y = (0.1 + sy * 0.7) * h + Math.cos(t * 0.04 + i * 1.3) * h * 0.03 * drift;
      const r = Math.min(w, h) * (0.28 + sx * 0.2) * (1 + breathe * 0.06);
      const g = ctx.createRadialGradient(x, y, 0, x, y, r);
      const tone = i % 2 === 0 ? p.glow : p.accent;
      g.addColorStop(0, withAlpha(tone, p.dark ? 0.09 : 0.45));
      g.addColorStop(1, withAlpha(tone, 0));
      ctx.fillStyle = g;
      ctx.fillRect(x - r, y - r, r * 2, r * 2);
    }
    ctx.restore();
  }

  /* ---- one theme's full scenery at a given opacity ------------------------------ */

  private renderTheme(
    ctx: CanvasRenderingContext2D,
    view: View,
    t: number,
    th: SkyTheme,
    alpha: number
  ): void {
    if (alpha <= 0.004) return;
    const p = this.current;

    if (th.milkyWay) this.renderMilkyWay(ctx, view, t, alpha);
    if (th.body === 'moon' || th.milkyWay) this.renderStars(ctx, view, t, alpha);

    this.renderBody(ctx, view, t, th.body, alpha, p);
    if (th.echoes) this.renderEchoes(ctx, view, t, alpha, p);
    this.renderMotes(ctx, view, t, th.motes, alpha, p);
    this.renderDunes(ctx, view, t, th.dunes, alpha, p);
    if (th.birds) this.renderBirds(ctx, view, t, alpha, p);
    if (th.shooting) this.renderShooting(ctx, view, alpha, p);
  }

  private renderStars(
    ctx: CanvasRenderingContext2D,
    view: View,
    t: number,
    alpha: number
  ): void {
    const p = this.current;
    ctx.save();
    ctx.fillStyle = p.glow;
    for (const s of this.stars) {
      const tw = 0.55 + 0.45 * Math.sin(t * (this.reducedMotion ? 0 : 0.8) + s.phase);
      ctx.globalAlpha = alpha * tw * 0.8;
      ctx.beginPath();
      ctx.arc(s.x * view.w, s.y * view.h, s.r, 0, TAU);
      ctx.fill();
    }
    ctx.restore();
  }

  private renderMilkyWay(
    ctx: CanvasRenderingContext2D,
    view: View,
    _t: number,
    alpha: number
  ): void {
    const { w, h } = view;
    const p = this.current;
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    // a diagonal veil of faint light
    ctx.translate(w * 0.5, h * 0.34);
    ctx.rotate(-0.42);
    const g = ctx.createLinearGradient(0, -h * 0.16, 0, h * 0.16);
    g.addColorStop(0, withAlpha(p.glow, 0));
    g.addColorStop(0.5, withAlpha(p.glow, 0.05 * alpha));
    g.addColorStop(1, withAlpha(p.glow, 0));
    ctx.fillStyle = g;
    ctx.fillRect(-w, -h * 0.16, w * 2, h * 0.32);
    // speckle the band
    ctx.fillStyle = p.glow;
    for (let i = 0; i < 70; i++) {
      const x = (seeded(i * 13 + 40) - 0.5) * w * 1.7;
      const y = (seeded(i * 13 + 41) - 0.5) * h * 0.18;
      ctx.globalAlpha = alpha * 0.35 * seeded(i * 13 + 42);
      ctx.beginPath();
      ctx.arc(x, y, 0.8 + seeded(i * 13 + 43), 0, TAU);
      ctx.fill();
    }
    ctx.restore();
  }

  private renderBody(
    ctx: CanvasRenderingContext2D,
    view: View,
    t: number,
    body: SkyTheme['body'],
    alpha: number,
    p: Palette
  ): void {
    const { w, h } = view;
    const drift = this.reducedMotion ? 0 : 1;
    ctx.save();
    ctx.globalAlpha = alpha;

    if (body === 'rising') {
      // a great gentle sun low over the hills
      const x = w * 0.5;
      const y = h * 0.72 + Math.sin(t * 0.02 * drift) * h * 0.004;
      const r = Math.min(w, h) * 0.19;
      const halo = ctx.createRadialGradient(x, y, 0, x, y, r * 3.2);
      halo.addColorStop(0, withAlpha(p.glow, 0.5));
      halo.addColorStop(0.45, withAlpha(p.accent, 0.14));
      halo.addColorStop(1, withAlpha(p.glow, 0));
      ctx.fillStyle = halo;
      ctx.fillRect(x - r * 3.2, y - r * 3.2, r * 6.4, r * 6.4);
      const disc = ctx.createRadialGradient(x, y - r * 0.3, 0, x, y, r);
      disc.addColorStop(0, withAlpha('#ffffff', 0.85));
      disc.addColorStop(0.7, withAlpha(p.glow, 0.7));
      disc.addColorStop(1, withAlpha(p.glow, 0.25));
      ctx.fillStyle = disc;
      ctx.beginPath();
      ctx.arc(x, y, r, 0, TAU);
      ctx.fill();
    } else if (body === 'high') {
      // a small hard noon sun with a slow ray-wheel, kept clear of the grid
      const x = w * 0.86;
      const y = h * 0.13;
      const r = Math.min(w, h) * 0.045;
      const halo = ctx.createRadialGradient(x, y, 0, x, y, r * 6);
      halo.addColorStop(0, withAlpha('#ffffff', 0.75));
      halo.addColorStop(0.25, withAlpha(p.glow, 0.35));
      halo.addColorStop(1, withAlpha(p.glow, 0));
      ctx.fillStyle = halo;
      ctx.fillRect(x - r * 6, y - r * 6, r * 12, r * 12);
      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.arc(x, y, r, 0, TAU);
      ctx.fill();
      ctx.strokeStyle = withAlpha(p.accent, 0.4);
      ctx.lineWidth = 1.4;
      ctx.lineCap = 'round';
      for (let i = 0; i < 12; i++) {
        const a = (i / 12) * TAU + t * 0.02 * drift;
        ctx.beginPath();
        ctx.moveTo(x + Math.cos(a) * r * 1.9, y + Math.sin(a) * r * 1.9);
        ctx.lineTo(x + Math.cos(a) * r * (2.5 + (i % 2) * 0.5), y + Math.sin(a) * r * (2.5 + (i % 2) * 0.5));
        ctx.stroke();
      }
    } else if (body === 'setting') {
      // a great sun sinking low — kept quiet so it never rivals the puzzle
      const x = w * 0.5;
      const y = h * 0.92;
      const r = Math.min(w, h) * 0.26;
      const halo = ctx.createRadialGradient(x, y, 0, x, y, r * 2.4);
      halo.addColorStop(0, withAlpha(p.accent, 0.3));
      halo.addColorStop(0.5, withAlpha(p.accent, 0.1));
      halo.addColorStop(1, withAlpha(p.accent, 0));
      ctx.fillStyle = halo;
      ctx.fillRect(x - r * 2.4, y - r * 2.4, r * 4.8, r * 4.8);
      const disc = ctx.createRadialGradient(x, y - r * 0.4, 0, x, y, r);
      disc.addColorStop(0, withAlpha('#fff6dd', 0.55));
      disc.addColorStop(0.65, withAlpha(p.accent, 0.42));
      disc.addColorStop(1, withAlpha(p.accent, 0.14));
      ctx.fillStyle = disc;
      ctx.beginPath();
      ctx.arc(x, y, r, 0, TAU);
      ctx.fill();
      // thin cloud bars slicing the disc — the classic dusk signature
      ctx.fillStyle = withAlpha(p.bottom, 0.3);
      for (let i = 0; i < 3; i++) {
        const cy = y - r * 0.55 + i * r * 0.34;
        const cw = r * (1.9 - i * 0.3);
        ctx.beginPath();
        ctx.ellipse(x - r * 0.14 * (i - 1), cy, cw / 2, r * 0.045, 0, 0, TAU);
        ctx.fill();
      }
    } else if (body === 'moon') {
      const x = w * 0.74;
      const y = h * 0.2;
      const r = Math.min(w, h) * 0.05;
      const halo = ctx.createRadialGradient(x, y, 0, x, y, r * 5);
      halo.addColorStop(0, withAlpha(p.glow, 0.3));
      halo.addColorStop(1, withAlpha(p.glow, 0));
      ctx.fillStyle = halo;
      ctx.fillRect(x - r * 5, y - r * 5, r * 10, r * 10);
      ctx.drawImage(this.crescent(p), x - r * 1.2, y - r * 1.2, r * 2.4, r * 2.4);
    } else if (body === 'aurora') {
      // breathing ribbons of light
      ctx.globalCompositeOperation = 'lighter';
      for (let band = 0; band < 3; band++) {
        const baseY = h * (0.2 + band * 0.09);
        const hue = band === 0 ? p.accent : band === 1 ? p.glow : p.soft;
        ctx.beginPath();
        const amp = h * 0.05;
        const segs = 26;
        for (let i = 0; i <= segs; i++) {
          const x = (i / segs) * w;
          const y =
            baseY +
            Math.sin((i / segs) * 4.4 + t * 0.12 * drift + band * 2.2) * amp +
            Math.sin((i / segs) * 9 - t * 0.07 * drift + band) * amp * 0.4;
          i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
        }
        const ribbonH = h * (0.1 - band * 0.02);
        for (let i = segs; i >= 0; i--) {
          const x = (i / segs) * w;
          const y =
            baseY +
            ribbonH +
            Math.sin((i / segs) * 4.4 + t * 0.12 * drift + band * 2.2 + 0.6) * amp;
          ctx.lineTo(x, y);
        }
        ctx.closePath();
        const g = ctx.createLinearGradient(0, baseY - amp, 0, baseY + ribbonH + amp);
        g.addColorStop(0, withAlpha(hue, 0));
        g.addColorStop(0.5, withAlpha(hue, 0.07 * alpha));
        g.addColorStop(1, withAlpha(hue, 0));
        ctx.fillStyle = g;
        ctx.fill();
      }
      ctx.globalCompositeOperation = 'source-over';
    }
    ctx.restore();
  }

  /** Unity only: faint keepsakes of the earlier chapters, for the observant. */
  private renderEchoes(
    ctx: CanvasRenderingContext2D,
    view: View,
    t: number,
    alpha: number,
    p: Palette
  ): void {
    const { w, h } = view;
    const drift = this.reducedMotion ? 0 : 1;
    ctx.save();
    ctx.globalAlpha = alpha * 0.13;
    ctx.strokeStyle = p.glow;
    ctx.lineWidth = 1;
    // a tiny ring-flower, low on the left
    ctx.save();
    ctx.translate(w * 0.12, h * 0.66);
    ctx.rotate(t * 0.03 * drift);
    for (const r of [14, 24, 34]) {
      ctx.beginPath();
      ctx.arc(0, 0, r, 0, TAU);
      ctx.stroke();
    }
    ctx.restore();
    // a little constellation, high on the right
    const cx = w * 0.88;
    const cy = h * 0.14;
    const pts = [
      [0, 0],
      [26, -14],
      [50, 2],
      [38, 26],
    ];
    ctx.beginPath();
    pts.forEach(([px, py], i) => (i === 0 ? ctx.moveTo(cx + px, cy + py) : ctx.lineTo(cx + px, cy + py)));
    ctx.stroke();
    ctx.fillStyle = p.glow;
    for (const [px, py] of pts) {
      ctx.beginPath();
      ctx.arc(cx + px, cy + py, 1.8, 0, TAU);
      ctx.fill();
    }
    ctx.restore();
  }

  private renderMotes(
    ctx: CanvasRenderingContext2D,
    view: View,
    t: number,
    kind: SkyTheme['motes'],
    alpha: number,
    p: Palette
  ): void {
    if (kind === 'none') return;
    const { w, h } = view;
    const drift = this.reducedMotion ? 0 : 1;
    ctx.save();
    for (const m of this.motes) {
      const cyc = (t * 0.014 * drift * (0.5 + m.s) + m.phase / TAU) % 1;
      if (kind === 'pollen') {
        // rising softly, swaying
        const x = (m.x + Math.sin(t * 0.1 * drift + m.phase) * 0.012) * w;
        const y = (1 - cyc) * h;
        ctx.globalAlpha = alpha * 0.3 * Math.sin(cyc * Math.PI);
        ctx.fillStyle = p.glow;
        ctx.beginPath();
        ctx.arc(x, y, 1.6 + m.s * 2.2, 0, TAU);
        ctx.fill();
      } else if (kind === 'sparkle') {
        // brief crisp glints
        const tw = Math.max(0, Math.sin(t * (0.5 + m.s) * drift + m.phase));
        if (tw < 0.72 && drift) continue;
        const a = alpha * (drift ? (tw - 0.72) / 0.28 : 0.3) * 0.75;
        const x = m.x * w;
        const y = m.y * h * 0.75;
        const s = 2.4 + m.s * 3;
        ctx.globalAlpha = a;
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(x - s, y);
        ctx.lineTo(x + s, y);
        ctx.moveTo(x, y - s);
        ctx.lineTo(x, y + s);
        ctx.stroke();
      } else if (kind === 'ember') {
        // warm sparks drifting on a slow wind
        const x = ((m.x + cyc * 0.6) % 1) * w;
        const y = (0.45 + m.y * 0.5 - cyc * 0.18) * h;
        ctx.globalAlpha = alpha * 0.45 * Math.sin(cyc * Math.PI);
        ctx.fillStyle = p.accent;
        ctx.beginPath();
        ctx.arc(x, y, 1.2 + m.s * 1.8, 0, TAU);
        ctx.fill();
      } else if (kind === 'weave') {
        // slow luminous filaments breathing between accent and glow
        const x = (m.x + Math.sin(t * 0.05 * drift + m.phase) * 0.03) * w;
        const y = (m.y * 0.8 + Math.cos(t * 0.04 * drift + m.phase) * 0.02) * h;
        const pulse = (Math.sin(t * 0.5 * drift + m.phase) + 1) / 2;
        ctx.globalAlpha = alpha * (0.12 + pulse * 0.2);
        ctx.fillStyle = pulse > 0.5 ? p.glow : p.accent;
        ctx.beginPath();
        ctx.arc(x, y, 1.5 + m.s * 2.4, 0, TAU);
        ctx.fill();
      }
    }
    ctx.restore();
  }

  private renderDunes(
    ctx: CanvasRenderingContext2D,
    view: View,
    t: number,
    layers: DuneLayer[],
    alpha: number,
    p: Palette
  ): void {
    const { w, h } = view;
    ctx.save();
    layers.forEach((L, li) => {
      const speed = this.reducedMotion ? 0 : 0.02 + li * 0.012;
      ctx.beginPath();
      ctx.moveTo(0, h);
      for (let x = 0; x <= w; x += 14) {
        const uu = x / Math.max(1, w);
        let s =
          Math.sin(uu * 4.1 + t * speed + li * 2.4) +
          Math.sin(uu * 9.7 - t * speed * 0.7 + li) * (0.35 + L.jag * 0.9);
        if (L.jag > 0) {
          // fold the wave into ridges
          s = s * (1 - L.jag * 0.5) + (Math.abs(Math.sin(uu * 7 + li * 3)) * 2 - 1) * L.jag;
        }
        if (L.flat > 0) {
          // clip the crests into mesas
          const lim = 1 - L.flat * 0.55;
          s = Math.max(-1.2, Math.min(lim, s));
        }
        ctx.lineTo(x, h * L.base + s * h * L.amp);
      }
      ctx.lineTo(w, h);
      ctx.closePath();
      ctx.fillStyle = withAlpha(p.dark ? p.soft : p.bottom, L.alpha * alpha);
      ctx.fill();
    });
    ctx.restore();
  }

  private renderBirds(
    ctx: CanvasRenderingContext2D,
    view: View,
    t: number,
    alpha: number,
    p: Palette
  ): void {
    if (this.reducedMotion) return;
    const { w, h } = view;
    if (this.birds) {
      const b = this.birds;
      b.t += 1 / 60; // approximate; birds are decorative
      const journey = b.t / 26; // slow crossing
      if (journey > 1.1) this.birds = null;
      else {
        const bx = (b.dir > 0 ? journey : 1 - journey) * (w + 160) - 80;
        ctx.save();
        ctx.globalAlpha = alpha * 0.5 * Math.min(1, Math.sin(Math.min(journey, 1) * Math.PI) * 3);
        ctx.strokeStyle = withAlpha(p.ink, 0.8);
        ctx.lineWidth = 1.6;
        ctx.lineCap = 'round';
        for (let i = 0; i < 5; i++) {
          const off = [0, -26, 24, -48, 46][i];
          const x = bx + off * 0.9 - Math.abs(off) * 0.55 * b.dir;
          const y = b.y * h + Math.abs(off) * 0.5 + Math.sin(t * 1.1 + i) * 2;
          const flap = Math.sin(t * 5 + i * 1.4) * 3.2;
          const s = 7 - (i > 2 ? 1.5 : 0);
          ctx.beginPath();
          ctx.moveTo(x - s, y + flap * 0.4);
          ctx.quadraticCurveTo(x, y - 3 - flap, x, y);
          ctx.quadraticCurveTo(x, y - 3 - flap, x + s, y + flap * 0.4);
          ctx.stroke();
        }
        ctx.restore();
      }
    } else {
      this.birdTimer -= 1 / 60;
      if (this.birdTimer <= 0) {
        this.birdTimer = 14 + Math.random() * 18;
        this.birds = { y: 0.2 + Math.random() * 0.3, t: 0, dir: Math.random() < 0.5 ? 1 : -1 };
      }
    }
  }

  private renderShooting(
    ctx: CanvasRenderingContext2D,
    view: View,
    alpha: number,
    p: Palette
  ): void {
    if (this.reducedMotion) return;
    const { w, h } = view;
    if (this.shoot) {
      const s = this.shoot;
      s.t += 1 / 60;
      const u = s.t / 0.9;
      if (u > 1) this.shoot = null;
      else {
        const x = s.x * w + s.dx * u * w * 0.3;
        const y = s.y * h + s.dy * u * h * 0.22;
        const tail = 90 * (1 - u * 0.4);
        const fade = Math.sin(Math.min(1, u) * Math.PI);
        ctx.save();
        ctx.globalAlpha = alpha * fade;
        const g = ctx.createLinearGradient(x, y, x - s.dx * tail, y - s.dy * tail);
        g.addColorStop(0, withAlpha('#ffffff', 0.95));
        g.addColorStop(1, withAlpha(p.glow, 0));
        ctx.strokeStyle = g;
        ctx.lineWidth = 1.8;
        ctx.lineCap = 'round';
        ctx.beginPath();
        ctx.moveTo(x, y);
        ctx.lineTo(x - s.dx * tail, y - s.dy * tail);
        ctx.stroke();
        ctx.restore();
      }
    } else {
      this.shootTimer -= 1 / 60;
      if (this.shootTimer <= 0) {
        this.shootTimer = 7 + Math.random() * 14;
        const dir = Math.random() < 0.5 ? 1 : -1;
        this.shoot = {
          x: 0.2 + Math.random() * 0.6,
          y: 0.06 + Math.random() * 0.24,
          dx: dir * (0.8 + Math.random() * 0.4),
          dy: 0.45 + Math.random() * 0.3,
          t: 0,
        };
      }
    }
  }

  /** The crescent is cut on its own little canvas so the sky stays intact. */
  private moonCanvas: HTMLCanvasElement | null = null;
  private moonTint = '';
  private crescent(p: Palette): HTMLCanvasElement {
    if (!this.moonCanvas || this.moonTint !== p.glow) {
      this.moonTint = p.glow;
      const c = document.createElement('canvas');
      c.width = 96;
      c.height = 96;
      const mc = c.getContext('2d')!;
      mc.beginPath();
      mc.arc(48, 48, 40, 0, TAU);
      mc.fillStyle = withAlpha(p.glow, 0.95);
      mc.fill();
      mc.globalCompositeOperation = 'destination-out';
      mc.beginPath();
      mc.arc(48 - 17, 48 - 7, 37, 0, TAU);
      mc.fill();
      this.moonCanvas = c;
    }
    return this.moonCanvas;
  }

  private renderGrain(ctx: CanvasRenderingContext2D, view: View): void {
    if (!this.grain) {
      const g = document.createElement('canvas');
      g.width = 160;
      g.height = 160;
      const gc = g.getContext('2d')!;
      const img = gc.createImageData(160, 160);
      for (let i = 0; i < img.data.length; i += 4) {
        const v = 128 + (Math.random() - 0.5) * 255;
        img.data[i] = img.data[i + 1] = img.data[i + 2] = v;
        img.data[i + 3] = 14;
      }
      gc.putImageData(img, 0, 0);
      this.grain = g;
    }
    ctx.save();
    ctx.globalCompositeOperation = 'overlay';
    ctx.globalAlpha = 0.5;
    const pat = ctx.createPattern(this.grain, 'repeat');
    if (pat) {
      ctx.fillStyle = pat;
      ctx.fillRect(0, 0, view.w, view.h);
    }
    ctx.restore();
  }

  /** A whisper of focus: corners fall away, the center holds the eye. */
  private renderVignette(ctx: CanvasRenderingContext2D, view: View, p: Palette): void {
    const { w, h } = view;
    const g = ctx.createRadialGradient(
      w / 2,
      h / 2,
      Math.min(w, h) * 0.42,
      w / 2,
      h / 2,
      Math.max(w, h) * 0.72
    );
    g.addColorStop(0, 'rgba(10,8,24,0)');
    g.addColorStop(1, p.dark ? 'rgba(4,4,14,0.26)' : 'rgba(30,20,50,0.11)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, w, h);
  }
}
