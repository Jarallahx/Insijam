/* ---------------------------------------------------------------------------
   Game core: the requestAnimationFrame loop, scene lifecycle, smooth scene
   transitions (snapshot crossfade + palette drift), and pointer routing.
--------------------------------------------------------------------------- */

import { Background } from '../render/background';
import { withAlpha, type ChapterId, type Palette } from '../render/palette';
import { Particles } from '../render/particles';
import { AudioEngine } from '../audio/engine';
import { Save } from './save';
import { UI } from '../ui/dom';
import { toVirtual, type Vec, type View } from './types';
import { clamp01, cubicInOut } from '../render/ease';

export interface Scene {
  enter(game: Game): void;
  exit(game: Game): void;
  update(dt: number, t: number, game: Game): void;
  render(ctx: CanvasRenderingContext2D, view: View, t: number, game: Game): void;
  down?(p: Vec, game: Game): void;
  move?(p: Vec, game: Game): void;
  up?(p: Vec, game: Game): void;
}

export class Game {
  readonly canvas: HTMLCanvasElement;
  readonly ctx: CanvasRenderingContext2D;
  readonly view: View = { w: 0, h: 0, cx: 0, cy: 0, s: 1 };

  readonly background: Background;
  readonly particles = new Particles();
  readonly audio = new AudioEngine();
  readonly save = new Save();
  readonly ui: UI;

  private scene: Scene | null = null;
  private time = 0;
  private lastFrame = 0;

  // transition state: we keep a snapshot of the outgoing frame and fade it out
  private snapshot: HTMLCanvasElement | null = null;
  private snapshotAlpha = 0;
  private transitionSpeed = 1;
  // a soft band of light that sweeps across during scene changes
  private sweepT = 1;
  private sweepSpeed = 1;

  private pointerActive = false;

  constructor() {
    this.canvas = document.getElementById('stage') as HTMLCanvasElement;
    this.ctx = this.canvas.getContext('2d')!;
    this.background = new Background('dawn');
    this.ui = new UI(this);

    this.applySettings();

    window.addEventListener('resize', () => this.resize());
    this.resize();

    const unlock = () => this.audio.unlock();
    window.addEventListener('pointerdown', unlock, { capture: true });
    window.addEventListener('keydown', unlock, { capture: true });

    // F11 toggles fullscreen via the HTML5 API (one source of truth,
    // shared with the settings panel; works in browser and Electron alike)
    window.addEventListener('keydown', (e) => {
      if (e.key === 'F11') {
        e.preventDefault();
        if (document.fullscreenElement) void document.exitFullscreen();
        else void document.documentElement.requestFullscreen().catch(() => {});
      }
    });

    this.canvas.addEventListener('pointerdown', (e) => {
      this.canvas.setPointerCapture(e.pointerId);
      this.pointerActive = true;
      this.scene?.down?.(this.virt(e), this);
    });
    this.canvas.addEventListener('pointermove', (e) => {
      this.scene?.move?.(this.virt(e), this);
    });
    const release = (e: PointerEvent) => {
      if (!this.pointerActive) return;
      this.pointerActive = false;
      this.scene?.up?.(this.virt(e), this);
    };
    this.canvas.addEventListener('pointerup', release);
    this.canvas.addEventListener('pointercancel', release);

    document.addEventListener('visibilitychange', () => {
      if (document.hidden) this.lastFrame = 0; // avoid a giant dt on return
    });
  }

  applySettings(): void {
    const s = this.save.settings;
    this.background.reducedMotion = s.reducedMotion;
    this.particles.reducedMotion = s.reducedMotion;
    this.audio.setEnabled(s.sound);
    document.documentElement.classList.toggle('reduced-motion', s.reducedMotion);
  }

  get reducedMotion(): boolean {
    return this.save.settings.reducedMotion;
  }

  get palette(): Palette {
    return this.background.current;
  }

  private virt(e: PointerEvent): Vec {
    const r = this.canvas.getBoundingClientRect();
    return toVirtual(this.view, e.clientX - r.left, e.clientY - r.top);
  }

  private resize(): void {
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const w = window.innerWidth;
    const h = window.innerHeight;
    this.canvas.width = Math.round(w * dpr);
    this.canvas.height = Math.round(h * dpr);
    this.canvas.style.width = `${w}px`;
    this.canvas.style.height = `${h}px`;
    this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    this.view.w = w;
    this.view.h = h;
    this.view.cx = w / 2;
    // lift the stage slightly so the caption band at the bottom stays clear
    this.view.cy = h * 0.472;
    this.view.s = Math.min(w, h) / 960;
  }

  /**
   * Switch scenes with a crossfade. The outgoing frame is snapshotted and
   * dissolves over the incoming scene while a band of light sweeps across
   * and the sky drifts toward the new chapter.
   */
  goto(scene: Scene, opts: { chapter?: ChapterId; fade?: number; sound?: boolean } = {}): void {
    // snapshot the current frame
    if (this.scene && this.view.w > 0) {
      const snap = this.snapshot ?? document.createElement('canvas');
      snap.width = this.canvas.width;
      snap.height = this.canvas.height;
      const sctx = snap.getContext('2d')!;
      sctx.setTransform(1, 0, 0, 1, 0, 0);
      sctx.clearRect(0, 0, snap.width, snap.height);
      sctx.drawImage(this.canvas, 0, 0);
      this.snapshot = snap;
      this.snapshotAlpha = 1;
    }
    const fade = this.reducedMotion ? 0.45 : (opts.fade ?? 1.0);
    this.transitionSpeed = 1 / fade;
    if (!this.reducedMotion) {
      this.sweepT = 0;
      this.sweepSpeed = 1 / (fade * 1.35);
    }

    this.scene?.exit(this);
    if (opts.chapter) this.background.setChapter(opts.chapter, fade * 1.6);
    if (opts.sound !== false) this.audio.whoosh();
    this.scene = scene;
    scene.enter(this);
  }

  start(scene: Scene): void {
    this.scene = scene;
    scene.enter(this);
    requestAnimationFrame((ts) => this.frame(ts));
  }

  private frame(ts: number): void {
    requestAnimationFrame((next) => this.frame(next));
    if (this.lastFrame === 0) {
      this.lastFrame = ts;
      return;
    }
    const dt = Math.min(0.05, (ts - this.lastFrame) / 1000);
    this.lastFrame = ts;
    this.time += dt;
    const t = this.time;

    this.background.update(dt);
    this.ui.theme(this.background.current);
    this.audio.update(dt);
    this.particles.update(dt);
    this.scene?.update(dt, t, this);

    const ctx = this.ctx;
    this.background.render(ctx, this.view, t);
    this.scene?.render(ctx, this.view, t, this);
    this.particles.render(ctx, this.view);

    // outgoing-scene dissolve
    if (this.snapshot && this.snapshotAlpha > 0) {
      this.snapshotAlpha = clamp01(this.snapshotAlpha - dt * this.transitionSpeed);
      const a = cubicInOut(this.snapshotAlpha);
      if (a > 0.002) {
        ctx.save();
        ctx.globalAlpha = a;
        ctx.drawImage(this.snapshot, 0, 0, this.view.w, this.view.h);
        ctx.restore();
      }
    }

    // the sweeping band of light that carries one scene into the next
    if (this.sweepT < 1) {
      this.sweepT = clamp01(this.sweepT + dt * this.sweepSpeed);
      const u = this.sweepT;
      const { w, h } = this.view;
      const diag = Math.hypot(w, h);
      // travel from beyond one corner to beyond the other
      const cx = -diag * 0.35 + (diag * 1.7) * cubicInOut(u);
      const strength = Math.sin(Math.min(1, u) * Math.PI);
      ctx.save();
      ctx.translate(w / 2, h / 2);
      ctx.rotate(-0.35);
      ctx.globalCompositeOperation = 'screen';
      const band = ctx.createLinearGradient(cx - diag * 0.3, 0, cx + diag * 0.3, 0);
      const glow = this.background.current.glow;
      band.addColorStop(0, withAlpha(glow, 0));
      band.addColorStop(0.5, withAlpha(glow, 0.3 * strength));
      band.addColorStop(1, withAlpha(glow, 0));
      ctx.fillStyle = band;
      ctx.fillRect(-diag, -diag, diag * 2, diag * 2);
      ctx.restore();
    }
  }
}
