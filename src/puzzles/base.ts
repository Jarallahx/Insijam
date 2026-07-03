/* ---------------------------------------------------------------------------
   Puzzle base class and the host interface a puzzle uses to reach the
   world (audio, particles, current palette, solved notification).
--------------------------------------------------------------------------- */

import type { AudioEngine } from '../audio/engine';
import type { Particles } from '../render/particles';
import type { Palette } from '../render/palette';
import type { Vec, View } from '../core/types';
import { clamp01 } from '../render/ease';

export interface PuzzleHost {
  audio: AudioEngine;
  particles: Particles;
  palette(): Palette;
  reducedMotion(): boolean;
  /** Called once, the moment the puzzle is solved. */
  solvedNotify(): void;
}

export abstract class Puzzle {
  solved = false;
  /** Seconds since the puzzle was solved (drives celebration rendering). */
  solveT = 0;
  /** 0→1 entrance animation. */
  intro = 0;

  constructor(protected host: PuzzleHost) {}

  /** How long the level scene should wait before advancing. */
  get celebrationSeconds(): number {
    return 2.6;
  }

  update(dt: number, t: number): void {
    this.intro = clamp01(this.intro + dt / (this.host.reducedMotion() ? 0.4 : 1.2));
    if (this.solved) this.solveT += dt;
    this.tick(dt, t);
  }

  protected abstract tick(dt: number, t: number): void;
  abstract render(ctx: CanvasRenderingContext2D, view: View, t: number): void;

  down(_p: Vec): void {}
  move(_p: Vec): void {}
  up(_p: Vec): void {}

  /** True when the pointer rests on something the player can act on. */
  hoverable(_p: Vec): boolean {
    return false;
  }

  /** Whether the level scene should show the "listen again" button. */
  get wantsReplayButton(): boolean {
    return false;
  }
  replay(): void {}

  protected win(): void {
    if (this.solved) return;
    this.solved = true;
    this.solveT = 0;
    this.host.audio.solve();
    this.host.solvedNotify();
  }
}
