/* ---------------------------------------------------------------------------
   RingRotator — shared drag/rotate/snap mechanics for every ring puzzle
   (Dawn's blooms and Unity's light-lock). Handles linked rings, springy
   settling, and tap-to-step.
--------------------------------------------------------------------------- */

import { angleDiff, mod, TAU } from '../render/ease';
import { withAlpha, type Palette } from '../render/palette';

export interface RingLink {
  ring: number;
  ratio: 1 | -1;
}

interface DragState {
  ring: number;
  startPointerAngle: number;
  delta: number; // radians since drag start
  startedAt: number;
  moved: boolean;
}

export class RingRotator {
  /** Logical rotation of each ring, in slots (unbounded integers). */
  offsets: number[];
  /** Rendered angle of each ring (radians), spring-eased toward targets. */
  private shown: number[];
  private vel: number[];
  private drag: DragState | null = null;

  readonly stepAngle: number;

  /** Called whenever a move lands (ring snapped into a new notch). */
  onSnap: ((ring: number, turns: number) => void) | null = null;

  constructor(
    public steps: number,
    ringCount: number,
    private links: RingLink[][],
    private locked: boolean[]
  ) {
    this.stepAngle = TAU / steps;
    this.offsets = new Array(ringCount).fill(0);
    this.shown = new Array(ringCount).fill(0);
    this.vel = new Array(ringCount).fill(0);
  }

  applyScramble(scramble: [number, number][]): void {
    for (const [ring, turns] of scramble) this.applyMove(ring, turns);
    // land instantly in the scrambled state
    for (let i = 0; i < this.offsets.length; i++) {
      this.shown[i] = this.offsets[i] * this.stepAngle;
      this.vel[i] = 0;
    }
  }

  private applyMove(ring: number, turns: number): void {
    this.offsets[ring] += turns;
    for (const l of this.links[ring] ?? []) {
      this.offsets[l.ring] += turns * l.ratio;
    }
  }

  get dragging(): number | null {
    return this.drag?.ring ?? null;
  }

  beginDrag(ring: number, pointerAngle: number, now: number): boolean {
    if (this.locked[ring]) return false;
    this.drag = { ring, startPointerAngle: pointerAngle, delta: 0, startedAt: now, moved: false };
    return true;
  }

  moveDrag(pointerAngle: number): void {
    const d = this.drag;
    if (!d) return;
    const diff = angleDiff(d.startPointerAngle, pointerAngle);
    d.delta += diff;
    d.startPointerAngle = pointerAngle;
    if (Math.abs(d.delta) > 0.035) d.moved = true;
  }

  /** Ends the drag; returns the number of slots actually moved. */
  endDrag(now: number): number {
    const d = this.drag;
    if (!d) return 0;
    this.drag = null;
    let turns = Math.round(d.delta / this.stepAngle);
    // a quick touch without movement = tap = one step clockwise
    if (!d.moved && now - d.startedAt < 0.35) turns = 1;
    if (turns !== 0) {
      this.applyMove(d.ring, turns);
      this.onSnap?.(d.ring, turns);
    }
    return turns;
  }

  update(dt: number): void {
    // soft, slightly-underdamped spring: a plush settle, never a snap
    const k = 68;
    const c = 12.8;
    for (let i = 0; i < this.offsets.length; i++) {
      let target = this.offsets[i] * this.stepAngle;
      const d = this.drag;
      if (d) {
        if (d.ring === i) {
          // the held ring glides after the finger through a fast low-pass,
          // which filters pointer jitter without feeling laggy
          const want = this.offsets[i] * this.stepAngle + d.delta;
          const e = 1 - Math.exp(-dt * 26);
          const prev = this.shown[i];
          this.shown[i] = prev + (want - prev) * e;
          // remember the glide velocity so release inherits the momentum
          this.vel[i] = dt > 0 ? (this.shown[i] - prev) / dt : 0;
          continue;
        }
        const link = (this.links[d.ring] ?? []).find((l) => l.ring === i);
        if (link) {
          // linked rings glide with the same smoothing as the held ring
          const want = target + d.delta * link.ratio;
          const e = 1 - Math.exp(-dt * 22);
          const prev = this.shown[i];
          this.shown[i] = prev + (want - prev) * e;
          this.vel[i] = dt > 0 ? (this.shown[i] - prev) / dt : 0;
          continue;
        }
      }
      const x = this.shown[i];
      const v = this.vel[i] + (k * (target - x) - c * this.vel[i]) * dt;
      this.vel[i] = v;
      this.shown[i] = x + v * dt;
    }
  }

  angleOf(ring: number): number {
    return this.shown[ring];
  }

  isLocked(ring: number): boolean {
    return this.locked[ring];
  }

  linksOf(ring: number): RingLink[] {
    return this.links[ring] ?? [];
  }

  aligned(): boolean {
    return this.offsets.every((o) => mod(o, this.steps) === 0);
  }

  /** True when the shown angles are visually at rest near their targets. */
  settled(): boolean {
    if (this.drag) return false;
    for (let i = 0; i < this.offsets.length; i++) {
      if (Math.abs(this.shown[i] - this.offsets[i] * this.stepAngle) > 0.01) return false;
      if (Math.abs(this.vel[i]) > 0.02) return false;
    }
    return true;
  }

  /** Every ring that moves along with `ring` (directly linked, either way). */
  partnersOf(ring: number): number[] {
    const out = new Set<number>();
    for (const l of this.links[ring] ?? []) out.add(l.ring);
    this.links.forEach((ls, i) => {
      if (i !== ring && (ls ?? []).some((l) => l.ring === ring)) out.add(i);
    });
    return [...out];
  }
}

/* ---------------------------------------------------------------------------
   Link bonds — the visible answer to "which rings move together?".
   Drawn as a radial thread between the two bands with a driver bead on the
   ring you turn and a tangential arrow on the ring that follows (pointing
   with or against the turn). Bonds glow when either ring is held or hovered.
--------------------------------------------------------------------------- */

interface Bond {
  a: number; // driver
  b: number; // follower
  ratio: 1 | -1;
  mutual: boolean;
}

export function drawRingBonds(
  ctx: CanvasRenderingContext2D,
  p: Palette,
  rot: RingRotator,
  midR: number[],
  hover: number | null,
  intro: number,
  age = 99
): void {
  const bonds: Bond[] = [];
  for (let i = 0; i < midR.length; i++) {
    for (const l of rot.linksOf(i)) {
      const ex = bonds.find((q) => q.a === l.ring && q.b === i && q.ratio === l.ratio);
      if (ex) {
        ex.mutual = true;
        continue;
      }
      bonds.push({ a: i, b: l.ring, ratio: l.ratio, mutual: false });
    }
  }
  if (!bonds.length) return;

  // for the first moments of a level the bonds breathe, asking to be seen
  const invite = age < 8 ? (1 - age / 8) * (0.5 + 0.5 * Math.sin(age * 3.2)) : 0;

  bonds.forEach((bond, idx) => {
    // fan the bonds around the upper arc so they never overlap each other
    const ang = -TAU * 0.17 + (idx - (bonds.length - 1) / 2) * 0.62;
    const active =
      hover === bond.a || hover === bond.b || rot.dragging === bond.a || rot.dragging === bond.b;
    const alpha = intro * Math.min(1, (active ? 1 : 0.72) + invite * 0.28);
    const size = (active ? 12 : 10.5) + invite * 2;
    const rA = midR[bond.a];
    const rB = midR[bond.b];
    const ca = Math.cos(ang);
    const sa = Math.sin(ang);

    // the thread
    ctx.strokeStyle = withAlpha(p.ink, alpha * 0.8);
    ctx.setLineDash([2, 6]);
    ctx.lineCap = 'round';
    ctx.lineWidth = active ? 2.2 : 1.8;
    ctx.beginPath();
    ctx.moveTo(ca * rA, sa * rA);
    ctx.lineTo(ca * rB, sa * rB);
    ctx.stroke();
    ctx.setLineDash([]);

    // driver end: a held bead (or an arrow too, when the bond is mutual)
    if (bond.mutual) {
      arrowAt(ctx, rA, ang, 1, size, withAlpha(p.accent, alpha));
    } else {
      ctx.fillStyle = withAlpha(p.accent, alpha);
      ctx.beginPath();
      ctx.arc(ca * rA, sa * rA, size * 0.52, 0, TAU);
      ctx.fill();
      ctx.strokeStyle = withAlpha(p.ink, alpha * 0.75);
      ctx.lineWidth = 1.3;
      ctx.stroke();
    }
    // follower end: arrow with (ratio 1) or against (ratio -1) the turn
    arrowAt(ctx, rB, ang, bond.ratio, size, withAlpha(p.accent, alpha));
  });
}

/** A small tangential arrow riding on radius R at angle theta. */
function arrowAt(
  ctx: CanvasRenderingContext2D,
  R: number,
  theta: number,
  sign: 1 | -1,
  size: number,
  color: string
): void {
  const dTip = (sign * size * 1.5) / R;
  const dBase = (-sign * size * 0.55) / R;
  const tipX = Math.cos(theta + dTip) * R;
  const tipY = Math.sin(theta + dTip) * R;
  const b1x = Math.cos(theta + dBase) * (R - size * 0.62);
  const b1y = Math.sin(theta + dBase) * (R - size * 0.62);
  const b2x = Math.cos(theta + dBase) * (R + size * 0.62);
  const b2y = Math.sin(theta + dBase) * (R + size * 0.62);
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.moveTo(tipX, tipY);
  ctx.lineTo(b1x, b1y);
  ctx.lineTo(b2x, b2y);
  ctx.closePath();
  ctx.fill();
}
