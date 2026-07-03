/* ---------------------------------------------------------------------------
   Unity — "the open way". Dawn's rings return, but now they are gates:
   each ring has a few channels light may pass through. Beams shine inward
   from the rim; turn the rings until every beam reaches the sleeping core.
--------------------------------------------------------------------------- */

import { Puzzle, type PuzzleHost } from './base';
import type { LockDef } from './defs';
import { drawRingBonds, RingRotator } from './rotator';
import { angleDiff, bump, clamp01, mod, TAU } from '../render/ease';
import { withAlpha } from '../render/palette';
import { glowStroke } from '../render/particles';
import type { Vec, View } from '../core/types';

const CORE_R = 66;
const INNER_R = 118;
const OUTER_R = 398;
const BEAM_R = 448;

export class LockPuzzle extends Puzzle {
  private rot: RingRotator;
  private def: LockDef;
  private r0: number[] = [];
  private r1: number[] = [];
  private now = 0;
  private shownDepth: number[];
  private beamHome: boolean[];
  private burstDone = false;
  private hoverRing: number | null = null;

  constructor(host: PuzzleHost, def: LockDef) {
    super(host);
    this.def = def;
    const n = def.rings.length;
    const band = (OUTER_R - INNER_R) / n;
    for (let i = 0; i < n; i++) {
      this.r0.push(INNER_R + i * band + 10);
      this.r1.push(INNER_R + (i + 1) * band - 10);
    }
    this.rot = new RingRotator(
      def.steps,
      n,
      def.rings.map((r) => r.links ?? []),
      def.rings.map(() => false)
    );
    this.rot.applyScramble(def.scramble);
    this.rot.onSnap = (ring, turns) =>
      this.host.audio.tick(1 + ring * 0.13 + Math.min(Math.abs(turns), 3) * 0.03);
    this.shownDepth = def.beams.map(() => BEAM_R);
    this.beamHome = def.beams.map(() => false);
  }

  /** How far (radius) the beam at slot `b` reaches, using shown angles. */
  private beamDepth(beamSlot: number): number {
    const beamAngle = beamSlot * this.rot.stepAngle;
    const tol = this.rot.stepAngle * 0.3;
    for (let j = this.def.rings.length - 1; j >= 0; j--) {
      const shown = this.rot.angleOf(j);
      let open = false;
      for (const c of this.def.rings[j].channels) {
        if (Math.abs(angleDiff(c * this.rot.stepAngle + shown, beamAngle)) < tol) {
          open = true;
          break;
        }
      }
      if (!open) return this.r1[j] + 4;
    }
    return CORE_R + 6;
  }

  private logicallyOpen(): boolean {
    return this.def.beams.every((b) =>
      this.def.rings.every((ring, j) =>
        ring.channels.includes(mod(b - this.rot.offsets[j], this.def.steps))
      )
    );
  }

  protected tick(dt: number, _t: number): void {
    this.now += dt;
    this.rot.update(dt);
    const p = this.host.palette();

    this.def.beams.forEach((b, i) => {
      const target = this.beamDepth(b);
      const e = 1 - Math.exp(-dt * 7);
      this.shownDepth[i] += (target - this.shownDepth[i]) * e;
      const home = target <= CORE_R + 8 && this.shownDepth[i] < CORE_R + 40;
      if (home && !this.beamHome[i]) {
        const ang = b * this.rot.stepAngle;
        this.host.audio.shimmer(Math.cos(ang) * 0.6);
        this.host.particles.burst(Math.cos(ang) * CORE_R, Math.sin(ang) * CORE_R, {
          count: 6,
          color: p.glow,
          speed: 60,
          size: 3,
          life: 1.2,
        });
      }
      this.beamHome[i] = home;
    });

    if (!this.solved && this.logicallyOpen() && this.rot.settled()) this.win();
    if (this.solved && !this.burstDone && this.solveT > 0.3) {
      this.burstDone = true;
      this.host.particles.burst(0, 0, {
        count: 34,
        colors: [p.accent, p.glow, '#ffffff'],
        shape: 'spark',
        speed: 220,
        size: 4.5,
        life: 2.6,
        gravity: -10,
      });
    }
  }

  down(p: Vec): void {
    if (this.solved) return;
    const ring = this.ringAt(Math.hypot(p.x, p.y));
    if (ring !== null && this.rot.beginDrag(ring, Math.atan2(p.y, p.x), this.now)) {
      this.host.audio.lift(true);
    }
  }

  move(p: Vec): void {
    this.rot.moveDrag(Math.atan2(p.y, p.x));
    if (this.rot.dragging === null) this.hoverRing = this.ringAt(Math.hypot(p.x, p.y));
  }

  up(_p: Vec): void {
    this.rot.endDrag(this.now);
  }

  private ringAt(r: number): number | null {
    for (let i = 0; i < this.r0.length; i++) {
      if (r >= this.r0[i] - 16 && r <= this.r1[i] + 16) return i;
    }
    return null;
  }

  hoverable(p: Vec): boolean {
    return !this.solved && this.ringAt(Math.hypot(p.x, p.y)) !== null;
  }

  render(ctx: CanvasRenderingContext2D, view: View, t: number): void {
    const p = this.host.palette();
    const n = this.def.rings.length;
    const step = this.rot.stepAngle;
    const solvedGlow = this.solved ? clamp01(this.solveT / 1.2) : 0;
    const homeCount = this.beamHome.filter(Boolean).length;
    const coreCharge = clamp01(homeCount / this.def.beams.length + solvedGlow);

    ctx.save();
    ctx.translate(view.cx, view.cy);
    ctx.scale(view.s, view.s);
    ctx.globalAlpha = this.intro;

    // --- beams (under the rings)
    this.def.beams.forEach((b, i) => {
      const a = b * step;
      const depth = this.shownDepth[i];
      const ca = Math.cos(a);
      const sa = Math.sin(a);
      glowStroke(
        ctx,
        () => {
          ctx.moveTo(ca * BEAM_R, sa * BEAM_R);
          ctx.lineTo(ca * depth, sa * depth);
        },
        p.accent,
        p.glow,
        3.4,
        this.beamHome[i] ? 1.05 : 0.7
      );
      // source spark at the rim
      ctx.fillStyle = withAlpha(p.glow, 0.9);
      ctx.beginPath();
      ctx.arc(ca * BEAM_R, sa * BEAM_R, 5, 0, TAU);
      ctx.fill();
    });

    const focusRing = this.rot.dragging ?? this.hoverRing;
    const related = new Set<number>(
      focusRing !== null ? this.rot.partnersOf(focusRing) : []
    );

    // --- rings: arcs with luminous gaps at the channels
    for (let i = 0; i < n; i++) {
      const u = clamp01(this.intro * 1.9 - i * 0.2);
      if (u <= 0) continue;
      const ringAngle = this.rot.angleOf(i);
      const isDragged = this.rot.dragging === i;
      const isPartner = related.has(i);
      const rm = (this.r0[i] + this.r1[i]) / 2;
      const bandW = this.r1[i] - this.r0[i];
      const gapHalf = step * 0.3;

      ctx.save();
      ctx.globalAlpha = u * this.intro;
      ctx.rotate(ringAngle);

      const channels = [...this.def.rings[i].channels].sort((x, y) => x - y);
      ctx.strokeStyle = isPartner && !isDragged
        ? withAlpha(p.accent, 0.5)
        : withAlpha(isDragged ? p.glow : p.ink, isDragged ? 0.55 : 0.4);
      ctx.lineWidth = bandW;
      ctx.lineCap = 'round';
      for (let k = 0; k < channels.length; k++) {
        const aFrom = channels[k] * step + gapHalf;
        const aTo = channels[(k + 1) % channels.length] * step - gapHalf + (k + 1 >= channels.length ? TAU : 0);
        ctx.beginPath();
        ctx.arc(0, 0, rm, aFrom, aTo);
        ctx.stroke();
      }
      // channel edge glimmers — the "keyholes"
      for (const c of channels) {
        const a = c * step;
        for (const side of [-1, 1]) {
          const ea = a + side * gapHalf;
          ctx.strokeStyle = withAlpha(p.accent, 0.85);
          ctx.lineWidth = 2.4;
          ctx.beginPath();
          ctx.moveTo(Math.cos(ea) * (rm - bandW / 2), Math.sin(ea) * (rm - bandW / 2));
          ctx.lineTo(Math.cos(ea) * (rm + bandW / 2), Math.sin(ea) * (rm + bandW / 2));
          ctx.stroke();
        }
      }
      ctx.restore();
    }

    // --- link bonds
    drawRingBonds(
      ctx,
      p,
      this.rot,
      this.r0.map((r, i) => (r + this.r1[i]) / 2),
      this.hoverRing,
      this.intro,
      this.host.reducedMotion() ? 99 : this.now
    );

    // --- core
    const pulse =
      1 +
      (this.solved
        ? bump(clamp01(this.solveT / 1.4)) * 0.3
        : (this.host.reducedMotion() ? 0 : Math.sin(t * 1.2) * 0.02));
    const R = CORE_R * pulse;
    const g = ctx.createRadialGradient(0, 0, 0, 0, 0, R * (2 + coreCharge * 2.4));
    g.addColorStop(0, withAlpha(p.glow, 0.25 + coreCharge * 0.7));
    g.addColorStop(1, withAlpha(p.glow, 0));
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(0, 0, R * (2 + coreCharge * 2.4), 0, TAU);
    ctx.fill();
    ctx.beginPath();
    ctx.arc(0, 0, R, 0, TAU);
    ctx.fillStyle = withAlpha(p.glow, 0.18 + coreCharge * 0.8);
    ctx.fill();
    ctx.strokeStyle = withAlpha(p.accent, 0.5 + coreCharge * 0.5);
    ctx.lineWidth = 1.8;
    ctx.stroke();

    ctx.restore();
  }
}
