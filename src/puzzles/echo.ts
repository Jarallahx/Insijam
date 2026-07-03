/* ---------------------------------------------------------------------------
   Night — "echo". The stars sing a phrase; answer them in kind and the
   constellation draws itself. Variants: Simon-style growth, answering in
   reverse ("Mirror"), slowly drifting stars, and the Unity color-echo
   where a moon speaks in blended colors and you answer with the parts.
--------------------------------------------------------------------------- */

import { Puzzle, type PuzzleHost } from './base';
import type { EchoDef } from './defs';
import { bump, clamp, clamp01, dist, TAU } from '../render/ease';
import { mixPrims, rgbToCss, withAlpha, type PrimC } from '../render/palette';
import { glowStroke } from '../render/particles';
import type { Vec, View } from '../core/types';

type State = 'idle' | 'show' | 'await' | 'gap' | 'done';

const STEP_TIME = 0.72;
const HIT_R = 62;

export class EchoPuzzle extends Puzzle {
  private def: EchoDef;
  private state: State = 'idle';
  private timer = 0;
  private showIdx = 0;
  private roundLen: number;
  private stepPtr = 0;
  private groupTapped = new Set<number>();
  private pulses: number[];
  private errShake: number[];
  private degrees: number[];
  private lines: { a: number; b: number; born: number }[] = [];
  private now = 0;
  private driftAng = 0;
  private moonPulse = 0;
  private moonColor: PrimC[] = [];
  private burstDone = false;

  constructor(host: PuzzleHost, def: EchoDef) {
    super(host);
    this.def = def;
    this.roundLen =
      def.mode === 'grow' ? Math.min(def.growFrom ?? 3, def.sequence.length) : def.sequence.length;
    this.pulses = def.stars.map(() => 0);
    this.errShake = def.stars.map(() => 0);
    // pitch follows altitude: higher star, higher note
    const order = def.stars
      .map((s, i) => ({ i, y: s[1] }))
      .sort((a, b) => b.y - a.y)
      .map((e) => e.i);
    this.degrees = def.stars.map(() => 0);
    order.forEach((starIdx, rank) => (this.degrees[starIdx] = rank));
  }

  get wantsReplayButton(): boolean {
    return this.state === 'await';
  }

  replay(): void {
    if (this.state !== 'await') return;
    this.beginShow();
  }

  private get answerSeq(): number[][] {
    const seq = this.def.sequence.slice(0, this.roundLen);
    return this.def.mode === 'reverse' ? [...seq].reverse() : seq;
  }

  private beginShow(): void {
    this.state = 'show';
    this.timer = 0.9; // breath before the phrase
    this.showIdx = 0;
    this.stepPtr = 0;
    this.groupTapped.clear();
    this.lines = [];
  }

  private starPos(i: number): Vec {
    const [x, y] = this.def.stars[i];
    if (this.driftAng === 0) return { x, y };
    const c = Math.cos(this.driftAng);
    const s = Math.sin(this.driftAng);
    return { x: x * c - y * s, y: x * s + y * c };
  }

  /* ---- simulation --------------------------------------------------------------- */

  protected tick(dt: number, _t: number): void {
    this.now += dt;
    if (this.def.drift && !this.host.reducedMotion() && this.state !== 'done') {
      this.driftAng += this.def.drift * dt;
    }
    for (let i = 0; i < this.pulses.length; i++) {
      this.pulses[i] = Math.max(0, this.pulses[i] - dt * 1.7);
      this.errShake[i] = Math.max(0, this.errShake[i] - dt * 2.2);
    }
    this.moonPulse = Math.max(0, this.moonPulse - dt * 1.4);

    if (this.state === 'idle' && this.intro >= 1) {
      this.timer -= dt;
      if (this.timer <= 0) this.beginShow();
    } else if (this.state === 'show') {
      this.timer -= dt;
      if (this.timer <= 0) {
        const seq = this.def.sequence.slice(0, this.roundLen);
        if (this.showIdx >= seq.length) {
          this.state = 'await';
        } else {
          const group = seq[this.showIdx];
          if (this.def.colors) {
            // the moon speaks: show only the blended color and its chord
            this.moonPulse = 1;
            this.moonColor = group.map((g) => this.def.colors![g]);
            group.forEach((g, k) =>
              this.host.audio.note(this.degrees[g], { when: k * 0.02, level: 0.06 })
            );
          } else {
            for (const g of group) {
              this.pulses[g] = 1;
              const pos = this.starPos(g);
              this.host.audio.note(this.degrees[g], {
                level: 0.07,
                pan: clamp(pos.x / 500, -0.7, 0.7),
              });
            }
          }
          this.showIdx++;
          this.timer = STEP_TIME;
        }
      }
    } else if (this.state === 'gap') {
      this.timer -= dt;
      if (this.timer <= 0) {
        if (this.roundLen >= this.def.sequence.length) {
          this.state = 'done';
          this.win();
        } else {
          this.roundLen = Math.min(this.roundLen + 1, this.def.sequence.length);
          this.beginShow();
        }
      }
    }

    if (this.solved && !this.burstDone && this.solveT > 0.3) {
      this.burstDone = true;
      const p = this.host.palette();
      for (const [i] of this.def.stars.entries()) {
        const pos = this.starPos(i);
        this.host.particles.burst(pos.x, pos.y, {
          count: 6,
          colors: [p.accent, p.glow],
          shape: 'spark',
          speed: 70,
          size: 3.4,
          life: 2.2,
          gravity: -18,
        });
      }
    }
  }

  /* ---- interaction ----------------------------------------------------------------- */

  down(p: Vec): void {
    if (this.state !== 'await' || this.solved) return;
    let hit = -1;
    let hitD = HIT_R;
    for (let i = 0; i < this.def.stars.length; i++) {
      const s = this.starPos(i);
      const d = dist(p.x, p.y, s.x, s.y);
      if (d < hitD) {
        hitD = d;
        hit = i;
      }
    }
    if (hit < 0) return;

    const seq = this.answerSeq;
    const group = seq[this.stepPtr];
    if (group.includes(hit) && !this.groupTapped.has(hit)) {
      // right star
      this.pulses[hit] = 1;
      const pos = this.starPos(hit);
      this.host.audio.note(this.degrees[hit], { level: 0.075, pan: clamp(pos.x / 500, -0.7, 0.7) });
      // thread from the previous star
      const prev = this.lastLitStar();
      if (prev !== null && prev !== hit) this.lines.push({ a: prev, b: hit, born: this.now });
      this.groupTapped.add(hit);
      if (this.groupTapped.size >= group.length) {
        this.groupTapped.clear();
        this.stepPtr++;
        if (this.stepPtr >= seq.length) {
          this.state = 'gap';
          this.timer = this.roundLen >= this.def.sequence.length ? 0.5 : 0.85;
          if (this.roundLen < this.def.sequence.length) this.host.audio.unlockPing();
        }
      }
    } else if (!group.includes(hit)) {
      // gentle miss: shake, hush, then the sky repeats itself
      this.errShake[hit] = 1;
      this.host.audio.soften();
      this.state = 'idle';
      this.timer = 1.1;
      this.stepPtr = 0;
      this.groupTapped.clear();
      this.lines = [];
    }
  }

  hoverable(p: Vec): boolean {
    if (this.state !== 'await' || this.solved) return false;
    return this.def.stars.some((_, i) => {
      const s = this.starPos(i);
      return dist(p.x, p.y, s.x, s.y) < HIT_R;
    });
  }

  private lastLitStar(): number | null {
    if (this.groupTapped.size > 0) return [...this.groupTapped].pop()!;
    if (this.stepPtr === 0) return null;
    const seq = this.answerSeq;
    const prevGroup = seq[this.stepPtr - 1];
    return prevGroup[prevGroup.length - 1];
  }

  /* ---- rendering ----------------------------------------------------------------------- */

  render(ctx: CanvasRenderingContext2D, view: View, t: number): void {
    const p = this.host.palette();
    const a = this.intro;
    ctx.save();
    ctx.translate(view.cx, view.cy);
    ctx.scale(view.s, view.s);
    ctx.globalAlpha = a;

    // the moon (color-echo) or a quiet center mark
    if (this.def.colors) {
      const mixed = this.moonColor.length ? rgbToCss(mixPrims(this.moonColor)) : null;
      const r = 64 + this.moonPulse * 10;
      const g = ctx.createRadialGradient(0, 0, 0, 0, 0, r * 2.2);
      g.addColorStop(0, mixed ? withAlpha('#ffffff', 0.15 + this.moonPulse * 0.3) : withAlpha(p.glow, 0.12));
      g.addColorStop(1, 'rgba(255,255,255,0)');
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.arc(0, 0, r * 2.2, 0, TAU);
      ctx.fill();
      ctx.beginPath();
      ctx.arc(0, 0, r, 0, TAU);
      ctx.fillStyle = mixed
        ? rgbToCss(mixPrims(this.moonColor), 0.35 + this.moonPulse * 0.55)
        : withAlpha(p.soft, 0.4);
      ctx.fill();
      ctx.strokeStyle = withAlpha(p.glow, 0.5);
      ctx.lineWidth = 1.6;
      ctx.stroke();
    }

    // constellation lines
    for (const ln of this.lines) {
      const u = clamp01((this.now - ln.born) / 0.3);
      const A = this.starPos(ln.a);
      const B = this.starPos(ln.b);
      const bx = A.x + (B.x - A.x) * u;
      const by = A.y + (B.y - A.y) * u;
      const boost = this.solved ? 0.6 + clamp01(this.solveT) * 0.6 : 0.75;
      glowStroke(
        ctx,
        () => {
          ctx.moveTo(A.x, A.y);
          ctx.lineTo(bx, by);
        },
        p.accent,
        p.glow,
        2.2,
        boost
      );
    }

    // stars
    for (let i = 0; i < this.def.stars.length; i++) {
      const s = this.starPos(i);
      // stars already answered within a chord stay lit until the chord lands
      const held = this.groupTapped.has(i) ? 0.7 : 0;
      const pulse = Math.max(this.pulses[i], held);
      const shake = this.errShake[i];
      const sx = s.x + (shake > 0 ? Math.sin(shake * 26) * 6 * shake : 0);
      const twinkle = this.host.reducedMotion() ? 0 : Math.sin(t * 1.3 + i * 2.7) * 0.1;
      const solvedGlow = this.solved ? clamp01(this.solveT / 1.2) * 0.6 : 0;
      const bright = 0.42 + twinkle * 0.1 + pulse * 0.58 + solvedGlow;
      const R = 9 + pulse * 7 + (this.solved ? bump(clamp01(this.solveT / 1.6)) * 4 : 0);
      const starCol = this.def.colors ? rgbToCss(mixPrims([this.def.colors[i]])) : p.glow;

      const g = ctx.createRadialGradient(sx, s.y, 0, sx, s.y, R * 3.4);
      g.addColorStop(0, withAlpha('#ffffff', 0.5 * bright));
      g.addColorStop(1, 'rgba(255,255,255,0)');
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.arc(sx, s.y, R * 3.4, 0, TAU);
      ctx.fill();

      ctx.save();
      ctx.globalAlpha = a * clamp01(bright + 0.25);
      ctx.fillStyle = starCol;
      // four-point star sparkle
      ctx.translate(sx, s.y);
      ctx.beginPath();
      for (let k = 0; k < 8; k++) {
        const ang = (k / 8) * TAU - Math.PI / 2;
        const rr = k % 2 === 0 ? R : R * 0.42;
        const px = Math.cos(ang) * rr;
        const py = Math.sin(ang) * rr;
        k === 0 ? ctx.moveTo(px, py) : ctx.lineTo(px, py);
      }
      ctx.closePath();
      ctx.fill();
      ctx.restore();

      // show-phase ripple
      if (pulse > 0.55) {
        ctx.save();
        ctx.globalAlpha = (pulse - 0.55) * 1.6;
        ctx.strokeStyle = starCol;
        ctx.lineWidth = 1.8;
        ctx.beginPath();
        ctx.arc(sx, s.y, R + (1 - pulse) * 55, 0, TAU);
        ctx.stroke();
        ctx.restore();
      }
    }

    // waiting shimmer: a soft ellipsis under the sky while it sings
    if (this.state === 'show' || this.state === 'idle') {
      ctx.save();
      const dots = 3;
      for (let i = 0; i < dots; i++) {
        const ph = this.host.reducedMotion() ? 0.5 : (Math.sin(t * 2.2 - i * 0.7) + 1) / 2;
        ctx.globalAlpha = a * (0.18 + ph * 0.3);
        ctx.fillStyle = p.ink;
        ctx.beginPath();
        ctx.arc((i - 1) * 26, 402, 4, 0, TAU);
        ctx.fill();
      }
      ctx.restore();
    }

    // mirror mode: a turning-back glyph reminds you the answer runs backwards
    if (this.def.mode === 'reverse' && this.state === 'await' && !this.solved) {
      ctx.save();
      ctx.globalAlpha = a * 0.55;
      ctx.strokeStyle = p.accent;
      ctx.fillStyle = p.accent;
      ctx.lineWidth = 2;
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.arc(0, 402, 16, -Math.PI * 0.95, Math.PI * 0.35);
      ctx.stroke();
      // arrowhead at the returning end
      const aa = Math.PI * 0.35;
      const ax = Math.cos(aa) * 16;
      const ay = 402 + Math.sin(aa) * 16;
      ctx.beginPath();
      ctx.moveTo(ax + 6, ay + 1);
      ctx.lineTo(ax - 5, ay + 4);
      ctx.lineTo(ax + 2, ay - 7);
      ctx.closePath();
      ctx.fill();
      ctx.restore();
    }

    ctx.restore();
  }
}
