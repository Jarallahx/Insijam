/* ---------------------------------------------------------------------------
   Dawn — "the bloom". Concentric rings carry petals and broken threads.
   Rotate the rings (some are linked to others) until every thread runs
   unbroken from the flower's core to the buds waiting at the rim.
--------------------------------------------------------------------------- */

import { Puzzle, type PuzzleHost } from './base';
import type { RingsDef } from './defs';
import { drawRingBonds, RingRotator } from './rotator';
import { backOut, bump, clamp01, mod, TAU } from '../render/ease';
import { mixHex, withAlpha } from '../render/palette';
import { glowStroke } from '../render/particles';
import type { Vec, View } from '../core/types';

const CORE_R = 78;
const INNER_R = 112;
const OUTER_R = 420;

export class RingsPuzzle extends Puzzle {
  private rot: RingRotator;
  private def: RingsDef;
  private r0: number[] = [];
  private r1: number[] = [];
  private now = 0;
  private burstDone = false;
  private hoverRing: number | null = null;
  /** Per-ring highlight that flares when a ring clicks into alignment. */
  private flare: number[];

  constructor(host: PuzzleHost, def: RingsDef) {
    super(host);
    this.def = def;
    const n = def.rings.length;
    const band = (OUTER_R - INNER_R) / n;
    for (let i = 0; i < n; i++) {
      this.r0.push(INNER_R + i * band + 5);
      this.r1.push(INNER_R + (i + 1) * band - 5);
    }
    this.rot = new RingRotator(
      def.steps,
      n,
      def.rings.map((r) => r.links ?? []),
      def.rings.map((r) => !!r.locked)
    );
    this.flare = new Array(n).fill(0);
    this.rot.applyScramble(def.scramble);
    this.rot.onSnap = (ring, turns) => {
      this.host.audio.tick(1 + ring * 0.13 + Math.min(Math.abs(turns), 3) * 0.03);
      // a ring arriving home sings a soft note
      for (let i = 0; i < this.rot.offsets.length; i++) {
        if (mod(this.rot.offsets[i], def.steps) === 0 && this.flare[i] <= 0) {
          this.flare[i] = 1;
          if (!this.rot.aligned()) this.host.audio.note(i * 2, { level: 0.045 });
        }
      }
    };
  }

  protected tick(dt: number, _t: number): void {
    this.now += dt;
    this.rot.update(dt);
    for (let i = 0; i < this.flare.length; i++) {
      if (mod(this.rot.offsets[i], this.def.steps) !== 0) this.flare[i] = 0;
      else if (this.flare[i] > 0) this.flare[i] = Math.max(0.35, this.flare[i] - dt * 0.8);
    }
    if (!this.solved && this.rot.aligned() && this.rot.settled()) this.win();
    if (this.solved && !this.burstDone && this.solveT > 0.25) {
      this.burstDone = true;
      const p = this.host.palette();
      this.host.particles.burst(0, 0, {
        count: 26,
        colors: [p.accent, p.glow, p.soft],
        shape: 'petal',
        speed: 190,
        size: 7,
        life: 2.4,
        gravity: -22,
      });
    }
  }

  down(p: Vec): void {
    if (this.solved) return;
    const r = Math.hypot(p.x, p.y);
    const ring = this.ringAt(r);
    if (ring === null) return;
    if (this.rot.beginDrag(ring, Math.atan2(p.y, p.x), this.now)) {
      this.host.audio.lift(true);
    }
  }

  move(p: Vec): void {
    this.rot.moveDrag(Math.atan2(p.y, p.x));
    if (this.rot.dragging === null) {
      const ring = this.ringAt(Math.hypot(p.x, p.y));
      this.hoverRing = ring !== null && !this.rot.isLocked(ring) ? ring : null;
    }
  }

  up(_p: Vec): void {
    this.rot.endDrag(this.now);
  }

  hoverable(p: Vec): boolean {
    if (this.solved) return false;
    const ring = this.ringAt(Math.hypot(p.x, p.y));
    return ring !== null && !this.rot.isLocked(ring);
  }

  private ringAt(r: number): number | null {
    for (let i = 0; i < this.r0.length; i++) {
      if (r >= this.r0[i] - 14 && r <= this.r1[i] + 14) return i;
    }
    return null;
  }

  render(ctx: CanvasRenderingContext2D, view: View, t: number): void {
    const p = this.host.palette();
    const n = this.def.rings.length;
    const step = this.rot.stepAngle;
    const solvedGlow = this.solved ? clamp01(this.solveT / 1.2) : 0;

    ctx.save();
    ctx.translate(view.cx, view.cy);
    // draw in virtual units so pointer hit-testing lines up exactly
    ctx.scale(view.s, view.s);

    // --- celebration light rays, painted underneath everything
    if (solvedGlow > 0) {
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      const rays = 10;
      for (let i = 0; i < rays; i++) {
        const a = (i / rays) * TAU + t * (this.host.reducedMotion() ? 0 : 0.05);
        const g = ctx.createLinearGradient(0, 0, Math.cos(a) * 640, Math.sin(a) * 640);
        g.addColorStop(0, withAlpha(p.glow, 0.16 * solvedGlow));
        g.addColorStop(1, withAlpha(p.glow, 0));
        ctx.fillStyle = g;
        ctx.beginPath();
        ctx.moveTo(0, 0);
        ctx.arc(0, 0, 640, a - 0.08, a + 0.08);
        ctx.closePath();
        ctx.fill();
      }
      ctx.restore();
    }

    // --- rim buds: where the threads want to arrive (fixed frame)
    const ia = this.intro;
    for (const slot of this.def.threads) {
      const a = slot * step;
      const budR = OUTER_R + 14;
      const bx = Math.cos(a) * budR;
      const by = Math.sin(a) * budR;
      // stub from the last ring outward
      ctx.strokeStyle = withAlpha(p.ink, 0.4 * ia);
      ctx.lineWidth = 2.4;
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(Math.cos(a) * (this.r1[n - 1] + 4), Math.sin(a) * (this.r1[n - 1] + 4));
      ctx.lineTo(Math.cos(a) * (budR - 8), Math.sin(a) * (budR - 8));
      ctx.stroke();
      const bloom = solvedGlow > 0 ? 1 + backOut(clamp01(this.solveT / 0.9)) * 0.9 : 1;
      ctx.fillStyle = solvedGlow > 0 ? p.accent : withAlpha(p.ink, 0.45 * ia);
      ctx.beginPath();
      ctx.arc(bx, by, 6.5 * bloom, 0, TAU);
      ctx.fill();
      if (solvedGlow > 0) {
        ctx.fillStyle = withAlpha(p.glow, 0.75 * solvedGlow);
        ctx.beginPath();
        ctx.arc(bx, by, 3 * bloom, 0, TAU);
        ctx.fill();
      }
    }

    // which rings will move along with the one under the finger?
    const focusRing = this.rot.dragging ?? this.hoverRing;
    const related = new Set<number>(
      focusRing !== null ? this.rot.partnersOf(focusRing) : []
    );

    // --- rings, inner → outer
    for (let i = 0; i < n; i++) {
      const u = clamp01(this.intro * 1.9 - i * 0.22); // staggered entrance
      if (u <= 0) continue;
      const ringAngle = this.rot.angleOf(i);
      const isDragged = this.rot.dragging === i;
      const isHovered = this.hoverRing === i && this.rot.dragging === null;
      const isPartner = related.has(i);
      const alignedNow = mod(this.rot.offsets[i], this.def.steps) === 0 && this.rot.dragging !== i;
      const fl = this.flare[i];

      ctx.save();
      ctx.globalAlpha = u;
      ctx.rotate(ringAngle);
      const grow = 0.92 + backOut(u) * 0.08;
      ctx.scale(grow, grow);

      // band — the held ring lifts; its bonded partners breathe with it
      ctx.beginPath();
      ctx.arc(0, 0, this.r1[i], 0, TAU);
      ctx.arc(0, 0, this.r0[i], 0, TAU, true);
      const bandGlow = this.rot.isLocked(i)
        ? 0.1
        : isDragged
          ? 0.4
          : isPartner
            ? 0.34
            : isHovered
              ? 0.3
              : 0.24;
      ctx.fillStyle =
        isPartner && !isDragged
          ? withAlpha(p.accent, bandGlow * 0.55)
          : withAlpha(p.glow, bandGlow);
      ctx.fill();
      ctx.strokeStyle = withAlpha(p.ink, isDragged || isPartner ? 0.5 : isHovered ? 0.4 : 0.3);
      ctx.lineWidth = 1.2;
      ctx.beginPath();
      ctx.arc(0, 0, this.r1[i], 0, TAU);
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(0, 0, this.r0[i], 0, TAU);
      ctx.stroke();

      // petals — decoration that makes each ring readable at a glance
      const petalColor = mixHex(p.accent, p.soft, i / Math.max(1, n - 1));
      const bloomScale = this.solved ? 1 + backOut(clamp01(this.solveT / 1.1)) * 0.16 : 1;
      for (const slot of this.def.rings[i].petals) {
        const a = slot * step;
        this.petal(ctx, a, this.r0[i] + 7, this.r1[i] - 7, step * 0.34, bloomScale);
        ctx.fillStyle = withAlpha(petalColor, 0.85 + solvedGlow * 0.15);
        ctx.fill();
        ctx.strokeStyle = withAlpha(p.ink, 0.28 + fl * 0.15);
        ctx.lineWidth = 1.2;
        ctx.stroke();
      }

      // thread segments — the actual puzzle state
      const sway = (i % 2 === 0 ? 1 : -1) * 0.055;
      for (const slot of this.def.threads) {
        const a = slot * step;
        const rA = this.r0[i] - 4;
        const rB = this.r1[i] + 4;
        const rM = (rA + rB) / 2;
        const drawSeg = () => {
          ctx.moveTo(Math.cos(a) * rA, Math.sin(a) * rA);
          ctx.quadraticCurveTo(
            Math.cos(a + sway) * rM,
            Math.sin(a + sway) * rM,
            Math.cos(a) * rB,
            Math.sin(a) * rB
          );
        };
        if (solvedGlow > 0 || fl > 0.01) {
          glowStroke(ctx, drawSeg, p.accent, p.glow, 3, Math.max(solvedGlow, fl * 0.5));
        } else {
          ctx.strokeStyle = withAlpha(p.ink, alignedNow ? 0.75 : 0.5);
          ctx.lineWidth = 2.6;
          ctx.lineCap = 'round';
          ctx.beginPath();
          drawSeg();
          ctx.stroke();
        }
      }
      ctx.restore();
    }

    // --- link bonds, riding on top of the bands
    drawRingBonds(
      ctx,
      p,
      this.rot,
      this.r0.map((r, i) => (r + this.r1[i]) / 2),
      this.hoverRing,
      ia,
      this.host.reducedMotion() ? 99 : this.now
    );

    // --- core (fixed frame), drawn last so it sits above the innermost ring edge
    const coreU = clamp01(this.intro * 2.2);
    if (coreU > 0) {
      ctx.save();
      ctx.globalAlpha = coreU;
      const pulse = this.solved
        ? 1 + bump(clamp01(this.solveT / 1.4)) * 0.22
        : 1 + Math.sin(t * 1.1) * (this.host.reducedMotion() ? 0 : 0.012);
      ctx.scale(pulse, pulse);
      const g = ctx.createRadialGradient(0, 0, 0, 0, 0, CORE_R);
      g.addColorStop(0, withAlpha(p.glow, 0.95));
      g.addColorStop(0.75, withAlpha(p.glow, 0.55));
      g.addColorStop(1, withAlpha(p.glow, 0.1));
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.arc(0, 0, CORE_R, 0, TAU);
      ctx.fill();
      ctx.strokeStyle = withAlpha(p.ink, 0.3);
      ctx.lineWidth = 1.4;
      ctx.beginPath();
      ctx.arc(0, 0, CORE_R * 0.62, 0, TAU);
      ctx.stroke();
      // core thread stubs (the anchor: threads must meet these)
      for (const slot of this.def.threads) {
        const a = slot * step;
        const draw = () => {
          ctx.moveTo(Math.cos(a) * (CORE_R * 0.62), Math.sin(a) * (CORE_R * 0.62));
          ctx.lineTo(Math.cos(a) * (INNER_R + 1), Math.sin(a) * (INNER_R + 1));
        };
        if (solvedGlow > 0) glowStroke(ctx, draw, p.accent, p.glow, 3, solvedGlow);
        else {
          ctx.strokeStyle = withAlpha(p.ink, 0.6);
          ctx.lineWidth = 2.6;
          ctx.lineCap = 'round';
          ctx.beginPath();
          draw();
          ctx.stroke();
        }
      }
      ctx.restore();
    }

    ctx.restore();
  }

  /** Builds a petal path centered on angle `a`, spanning radii rA→rB. */
  private petal(
    ctx: CanvasRenderingContext2D,
    a: number,
    rA: number,
    rB: number,
    halfWidth: number,
    scale: number
  ): void {
    const rm = (rA + rB) / 2;
    const rBs = rm + (rB - rm) * scale;
    const rAs = rm + (rA - rm) * scale;
    ctx.beginPath();
    ctx.moveTo(Math.cos(a) * rAs, Math.sin(a) * rAs);
    ctx.quadraticCurveTo(
      Math.cos(a + halfWidth * scale) * rm,
      Math.sin(a + halfWidth * scale) * rm,
      Math.cos(a) * rBs,
      Math.sin(a) * rBs
    );
    ctx.quadraticCurveTo(
      Math.cos(a - halfWidth * scale) * rm,
      Math.sin(a - halfWidth * scale) * rm,
      Math.cos(a) * rAs,
      Math.sin(a) * rAs
    );
    ctx.closePath();
  }
}
