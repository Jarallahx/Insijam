/* ---------------------------------------------------------------------------
   Unity — "Insijam", the finale. Three movements, one instrument:
     I.   The bloom   — align three rings (Dawn)
     II.  The prism   — carry three colors of light to their crystals
                        (Day + Dusk), sliding lenses around the halo
     III. The song    — the crystals sing the game's theme; answer it (Night)
   Each movement hands its light to the next through a soft bloom.
--------------------------------------------------------------------------- */

import { Puzzle, type PuzzleHost } from './base';
import { RingsPuzzle } from './rings';
import { EchoPuzzle } from './echo';
import type { EchoDef, RingsDef } from './defs';
import { angleDiff, bump, clamp01, dist, TAU } from '../render/ease';
import { mixPrims, rgbToCss, withAlpha, type PrimC } from '../render/palette';
import { glowStroke } from '../render/particles';
import type { Vec, View } from '../core/types';

const RINGS_DEF: RingsDef = {
  kind: 'rings',
  steps: 8,
  threads: [0, 3, 5],
  rings: [
    { petals: [1, 4, 6] },
    { petals: [0, 2, 5, 7], links: [{ ring: 0, ratio: -1 }] },
    { petals: [1, 3, 6], links: [{ ring: 1, ratio: 1 }] },
  ],
  scramble: [
    [0, 3],
    [1, -2],
    [2, 3],
    [0, -1],
  ],
};

const ECHO_DEF: EchoDef = {
  kind: 'echo',
  stars: [
    [-320, -120],
    [-160, -280],
    [0, -340],
    [160, -280],
    [320, -120],
  ],
  sequence: [[0], [2], [1], [3], [2], [4]],
  mode: 'full',
};

interface Lens {
  color: PrimC;
  angle: number; // where the finger says it should be
  shown: number; // where it is drawn — glides after `angle`
  targetAngle: number; // where its crystal waits
  locked: boolean;
  glow: number;
}

const TRACK_R = 290;
const CRYSTAL_R = 408;

export class FinalePuzzle extends Puzzle {
  private phase = 0; // 0 rings, 1 lenses, 2 echo
  private child: Puzzle | null = null;
  private lenses: Lens[] = [];
  private dragLens: number | null = null;
  private transition = 0; // >0 while blooming between phases
  private phaseDone = false;
  private finished = false;

  constructor(host: PuzzleHost) {
    super(host);
    this.child = new RingsPuzzle(this.proxy(), RINGS_DEF);
    const angles = [-TAU / 4, -TAU / 4 + TAU / 3, -TAU / 4 + (2 * TAU) / 3];
    const colors: PrimC[] = ['r', 'y', 'b'];
    // lenses start far from home
    const starts = [angles[0] + 2.4, angles[1] - 2.1, angles[2] + 1.7];
    for (let i = 0; i < 3; i++) {
      this.lenses.push({
        color: colors[i],
        angle: starts[i],
        shown: starts[i],
        targetAngle: angles[i],
        locked: false,
        glow: 0,
      });
    }
  }

  get celebrationSeconds(): number {
    return 4.2;
  }

  private proxy(): PuzzleHost {
    // children celebrate on their own; the finale decides when to move on
    return {
      audio: this.host.audio,
      particles: this.host.particles,
      palette: () => this.host.palette(),
      reducedMotion: () => this.host.reducedMotion(),
      solvedNotify: () => {},
    };
  }

  protected tick(dt: number, t: number): void {
    if (this.transition > 0) {
      this.transition = Math.max(0, this.transition - dt / 1.5);
      if (this.transition < 0.5 && this.phaseDone) {
        // swap at the heart of the bloom
        this.phaseDone = false;
        this.phase++;
        if (this.phase === 2) this.child = new EchoPuzzle(this.proxy(), ECHO_DEF);
        else this.child = null;
      }
    }

    if (this.phase === 0 || this.phase === 2) {
      this.child?.update(dt, t);
      if (this.child?.solved && this.child.solveT > 1.6 && this.transition === 0 && !this.finished) {
        if (this.phase === 2) {
          this.finished = true;
          this.solved = true;
          this.solveT = 0;
          this.host.audio.grandChord();
          this.host.solvedNotify();
          this.host.particles.burst(0, 0, {
            count: 40,
            colors: [rgbToCss(mixPrims(['r'])), rgbToCss(mixPrims(['y'])), rgbToCss(mixPrims(['b'])), '#ffffff'],
            shape: 'spark',
            speed: 260,
            size: 5,
            life: 3,
            gravity: -8,
          });
        } else {
          this.transition = 1;
          this.phaseDone = true;
          this.host.audio.whoosh();
        }
      }
    } else if (this.phase === 1) {
      for (const l of this.lenses) {
        l.glow = Math.max(l.locked ? 0.85 : 0, l.glow - dt * 1.2);
        // the lens glides after the finger — the same butter as the rings
        l.shown += angleDiff(l.shown, l.angle) * (1 - Math.exp(-dt * 24));
      }
      const allLocked = this.lenses.every((l) => l.locked);
      if (allLocked && this.transition === 0 && !this.phaseDone) {
        // small pause, then bloom into the song
        this.phaseDone = true;
        this.host.audio.solve();
        this.transition = 1;
        this.host.audio.whoosh();
      }
    }

    if (this.solved) this.child?.update(dt, t);
  }

  /* ---- input ------------------------------------------------------------------ */

  down(p: Vec): void {
    if (this.solved) return;
    if (this.phase === 1) {
      for (let i = 0; i < this.lenses.length; i++) {
        const l = this.lenses[i];
        if (l.locked) continue;
        const lx = Math.cos(l.shown) * TRACK_R;
        const ly = Math.sin(l.shown) * TRACK_R;
        if (dist(p.x, p.y, lx, ly) < 70) {
          this.dragLens = i;
          this.host.audio.lift(true);
          return;
        }
      }
      return;
    }
    this.child?.down(p);
  }

  move(p: Vec): void {
    if (this.phase === 1) {
      if (this.dragLens === null) return;
      const l = this.lenses[this.dragLens];
      l.angle = Math.atan2(p.y, p.x);
      // magnetic hint as it nears home
      const d = angleDiff(l.angle, l.targetAngle);
      if (Math.abs(d) < 0.3) l.glow = Math.max(l.glow, 0.5 * (1 - Math.abs(d) / 0.3));
      return;
    }
    this.child?.move(p);
  }

  up(p: Vec): void {
    if (this.phase === 1) {
      if (this.dragLens === null) return;
      const l = this.lenses[this.dragLens];
      this.dragLens = null;
      if (Math.abs(angleDiff(l.angle, l.targetAngle)) < 0.14) {
        l.angle = l.targetAngle;
        l.locked = true;
        l.glow = 1;
        this.host.audio.shimmer(Math.cos(l.targetAngle) * 0.6);
        this.host.particles.burst(
          Math.cos(l.targetAngle) * CRYSTAL_R,
          Math.sin(l.targetAngle) * CRYSTAL_R,
          { count: 10, color: rgbToCss(mixPrims([l.color])), speed: 90, size: 4, life: 1.6 }
        );
      } else {
        this.host.audio.lift(false);
      }
      return;
    }
    this.child?.up(p);
  }

  get wantsReplayButton(): boolean {
    return this.phase === 2 && !!this.child && this.child.wantsReplayButton;
  }

  replay(): void {
    this.child?.replay();
  }

  /* ---- rendering ------------------------------------------------------------------ */

  render(ctx: CanvasRenderingContext2D, view: View, t: number): void {
    if (this.phase === 0 || this.phase === 2) {
      this.child?.render(ctx, view, t);
    } else {
      this.renderLenses(ctx, view, t);
    }

    // bloom between the movements
    if (this.transition > 0) {
      const u = bump(1 - this.transition);
      const p = this.host.palette();
      const R = Math.max(view.w, view.h) * 0.75;
      const g = ctx.createRadialGradient(view.cx, view.cy, 0, view.cx, view.cy, R);
      g.addColorStop(0, withAlpha(p.glow, 0.95 * u));
      g.addColorStop(0.6, withAlpha(p.glow, 0.7 * u));
      g.addColorStop(1, withAlpha(p.glow, 0));
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, view.w, view.h);
    }
  }

  private renderLenses(ctx: CanvasRenderingContext2D, view: View, t: number): void {
    const p = this.host.palette();
    ctx.save();
    ctx.translate(view.cx, view.cy);
    ctx.scale(view.s, view.s);

    // core — still warm from movement I
    const g = ctx.createRadialGradient(0, 0, 0, 0, 0, 170);
    g.addColorStop(0, withAlpha(p.glow, 0.85));
    g.addColorStop(1, withAlpha(p.glow, 0));
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(0, 0, 170, 0, TAU);
    ctx.fill();
    ctx.beginPath();
    ctx.arc(0, 0, 52, 0, TAU);
    ctx.fillStyle = withAlpha(p.glow, 0.9);
    ctx.fill();

    // track
    ctx.strokeStyle = withAlpha(p.ink, 0.3);
    ctx.setLineDash([1, 10]);
    ctx.lineWidth = 1.6;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.arc(0, 0, TRACK_R, 0, TAU);
    ctx.stroke();
    ctx.setLineDash([]);

    for (const l of this.lenses) {
      const col = rgbToCss(mixPrims([l.color]));
      const la = l.shown;
      const lx = Math.cos(la) * TRACK_R;
      const ly = Math.sin(la) * TRACK_R;
      const tx = Math.cos(l.targetAngle) * CRYSTAL_R;
      const ty = Math.sin(l.targetAngle) * CRYSTAL_R;

      // beam: core → lens → onward in the lens direction
      const reach = l.locked ? CRYSTAL_R - 26 : TRACK_R + 130;
      glowStroke(
        ctx,
        () => {
          ctx.moveTo(Math.cos(la) * 56, Math.sin(la) * 56);
          ctx.lineTo(Math.cos(la) * (TRACK_R - 22), Math.sin(la) * (TRACK_R - 22));
          ctx.moveTo(Math.cos(la) * (TRACK_R + 22), Math.sin(la) * (TRACK_R + 22));
          ctx.lineTo(Math.cos(la) * reach, Math.sin(la) * reach);
        },
        col,
        '#ffffff',
        3.2,
        l.locked ? 1 : 0.65
      );

      // crystal
      ctx.save();
      ctx.translate(tx, ty);
      ctx.rotate(l.targetAngle + Math.PI / 2);
      const r = 30 + (l.locked ? bump(clamp01(l.glow)) * 6 : 0);
      if (l.locked) {
        const cg = ctx.createRadialGradient(0, 0, 0, 0, 0, r * 3);
        cg.addColorStop(0, rgbToCss(mixPrims([l.color]), 0.5));
        cg.addColorStop(1, 'rgba(255,255,255,0)');
        ctx.fillStyle = cg;
        ctx.beginPath();
        ctx.arc(0, 0, r * 3, 0, TAU);
        ctx.fill();
      }
      ctx.beginPath();
      ctx.moveTo(0, -r);
      ctx.lineTo(r * 0.72, 0);
      ctx.lineTo(0, r);
      ctx.lineTo(-r * 0.72, 0);
      ctx.closePath();
      ctx.fillStyle = l.locked ? rgbToCss(mixPrims([l.color]), 0.85) : rgbToCss(mixPrims([l.color]), 0.18);
      ctx.fill();
      ctx.strokeStyle = col;
      ctx.lineWidth = 2;
      ctx.stroke();
      ctx.restore();

      // lens
      const wob = this.host.reducedMotion() || l.locked ? 0 : Math.sin(t * 1.6 + l.targetAngle) * 2;
      ctx.beginPath();
      ctx.arc(lx, ly + wob, 26, 0, TAU);
      ctx.strokeStyle = col;
      ctx.lineWidth = 3;
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(lx, ly + wob, 15, 0, TAU);
      ctx.strokeStyle = withAlpha('#ffffff', 0.8);
      ctx.lineWidth = 1.6;
      ctx.stroke();
      if (l.glow > 0) {
        ctx.save();
        ctx.globalAlpha = l.glow * 0.6;
        ctx.beginPath();
        ctx.arc(lx, ly + wob, 34, 0, TAU);
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 2;
        ctx.stroke();
        ctx.restore();
      }
    }
    ctx.restore();
  }
}
