/* ---------------------------------------------------------------------------
   Day — "light". A grid of mirrors, prisms and crystals. Tap mirrors to
   tilt them and carry every beam home. The same engine, given colored
   emitters, powers the Unity chapter's "Colored Light" (beams that meet
   in one crystal mix additively).
--------------------------------------------------------------------------- */

import { Puzzle, type PuzzleHost } from './base';
import type { Dir, LightCellDef, LightDef } from './defs';
import { bump, clamp01, dist, TAU } from '../render/ease';
import { mixPrims, rgbToCss, sameColorSet, withAlpha, type PrimC } from '../render/palette';
import { glowStroke } from '../render/particles';
import type { Vec, View } from '../core/types';

const DIRV: [number, number][] = [
  [1, 0],
  [0, 1],
  [-1, 0],
  [0, -1],
];

interface Beam {
  pts: { x: number; y: number }[];
  segLens: number[];
  len: number;
  color: PrimC | null;
  /** target index this beam ends in, and the distance at which it arrives */
  target?: { index: number; at: number };
  startOffset: number; // reveal delay for split beams: distance already traveled
}

interface MirrorState {
  o: '/' | '\\';
  shown: number; // animated angle
  target: number;
}

export class LightPuzzle extends Puzzle {
  private def: LightDef;
  private cs = 100;
  private ox = 0;
  private oy = 0;

  private mirrors = new Map<string, MirrorState>();
  private beams: Beam[] = [];
  private targetIdx = new Map<string, number>();
  private targets: LightCellDef[] = [];
  private targetLit: boolean[] = [];
  private targetSatisfied: boolean[] = [];
  private targetLitShown: number[] = [];
  private targetHitColors: Set<PrimC | 'w'>[] = [];
  private targetArrive: number[][] = []; // arrival distances per target

  private reveal = 0;
  private maxLen = 1;
  private logicalSolved = false;
  private burstDone = false;

  constructor(host: PuzzleHost, def: LightDef) {
    super(host);
    this.def = def;
    this.applyCellSize(Math.min(780 / def.cols, 660 / def.rows, 132));
    for (const c of def.cells) {
      if (c.type === 'mirror') {
        const ang = c.m === '/' ? -Math.PI / 4 : Math.PI / 4;
        this.mirrors.set(this.key(c.x, c.y), { o: c.m ?? '/', shown: ang, target: ang });
      }
      if (c.type === 'target') {
        this.targetIdx.set(this.key(c.x, c.y), this.targets.length);
        this.targets.push(c);
        this.targetLit.push(false);
        this.targetSatisfied.push(false);
        this.targetLitShown.push(0);
        this.targetHitColors.push(new Set());
        this.targetArrive.push([]);
      }
    }
    this.trace();
    this.reveal = 0;
  }

  private key(x: number, y: number): string {
    return `${x},${y}`;
  }

  private applyCellSize(cs: number): void {
    this.cs = cs;
    this.ox = (-this.def.cols * cs) / 2;
    this.oy = (-this.def.rows * cs) / 2;
  }

  /** Grids grow into whatever width the window offers (beams are re-traced
      because their stored geometry depends on the cell size). */
  private fitToView(view: View): void {
    const wUnits = view.w / view.s;
    const cs = Math.min((wUnits - 170) / this.def.cols, 690 / this.def.rows, 132);
    if (Math.abs(cs - this.cs) > 0.5) {
      const progress = this.reveal;
      this.applyCellSize(cs);
      this.trace();
      this.reveal = progress; // don't replay the reveal on a mere resize
    }
  }

  private cellAt(x: number, y: number): LightCellDef | undefined {
    return this.def.cells.find((c) => c.x === x && c.y === y);
  }

  private center(x: number, y: number): { x: number; y: number } {
    return { x: this.ox + (x + 0.5) * this.cs, y: this.oy + (y + 0.5) * this.cs };
  }

  /* ---- beam tracing ---------------------------------------------------------- */

  private trace(): void {
    this.beams = [];
    this.targetHitColors = this.targets.map(() => new Set());
    this.targetArrive = this.targets.map(() => []);
    const visited = new Set<string>();

    const walk = (x: number, y: number, dir: Dir, color: PrimC | null, startOffset: number) => {
      const beam: Beam = {
        pts: [this.center(x, y)],
        segLens: [],
        len: 0,
        color,
        startOffset,
      };
      let cx = x;
      let cy = y;
      let d = dir;
      const pushPoint = (px: number, py: number) => {
        const last = beam.pts[beam.pts.length - 1];
        const l = dist(last.x, last.y, px, py);
        beam.pts.push({ x: px, y: py });
        beam.segLens.push(l);
        beam.len += l;
      };

      for (let guard = 0; guard < 400; guard++) {
        const vkey = `${cx},${cy},${d},${color ?? 'w'}`;
        if (visited.has(vkey)) break;
        visited.add(vkey);
        const [dx, dy] = DIRV[d];
        cx += dx;
        cy += dy;
        if (cx < 0 || cy < 0 || cx >= this.def.cols || cy >= this.def.rows) {
          // drift off the edge and dissolve
          const edge = this.center(cx, cy);
          pushPoint(edge.x - dx * this.cs * 0.62, edge.y - dy * this.cs * 0.62);
          break;
        }
        const cell = this.cellAt(cx, cy);
        const c = this.center(cx, cy);
        if (!cell) continue;
        if (cell.type === 'mirror') {
          pushPoint(c.x, c.y);
          const m = this.mirrors.get(this.key(cx, cy))!;
          d = (m.o === '/' ? [3, 2, 1, 0] : [1, 0, 3, 2])[d] as Dir;
          continue;
        }
        if (cell.type === 'target') {
          pushPoint(c.x, c.y);
          const idx = this.targetIdx.get(this.key(cx, cy))!;
          beam.target = { index: idx, at: startOffset + beam.len };
          this.targetHitColors[idx].add(color ?? 'w');
          this.targetArrive[idx].push(startOffset + beam.len);
          break;
        }
        if (cell.type === 'block' || cell.type === 'emitter') {
          pushPoint(c.x - dx * this.cs * 0.36, c.y - dy * this.cs * 0.36);
          break;
        }
        if (cell.type === 'splitter') {
          pushPoint(c.x, c.y);
          const total = startOffset + beam.len;
          walk(cx, cy, ((d + 1) % 4) as Dir, color, total);
          walk(cx, cy, ((d + 3) % 4) as Dir, color, total);
          break;
        }
        if (cell.type === 'dye') {
          // the beam takes on the dye's color: end this segment and
          // continue as a new beam so the rendered light shifts hue here
          pushPoint(c.x, c.y);
          if (cell.color && cell.color !== color) {
            walk(cx, cy, d, cell.color, startOffset + beam.len);
            break;
          }
          continue;
        }
      }
      this.beams.push(beam);
    };

    for (const c of this.def.cells) {
      if (c.type === 'emitter') walk(c.x, c.y, c.dir ?? 0, c.color ?? null, 0);
    }

    this.maxLen = Math.max(1, ...this.beams.map((b) => b.startOffset + b.len));
    this.logicalSolved = this.targets.every((tc, i) => {
      const hits = this.targetHitColors[i];
      if (tc.need && tc.need.length) {
        const got = [...hits].filter((h): h is PrimC => h !== 'w');
        return hits.size === got.length && sameColorSet(got, tc.need);
      }
      return this.targetArrive[i].length >= (tc.hits ?? 1);
    });
  }

  /* ---- interaction ------------------------------------------------------------ */

  down(p: Vec): void {
    if (this.solved) return;
    const gx = Math.floor((p.x - this.ox) / this.cs);
    const gy = Math.floor((p.y - this.oy) / this.cs);
    const cell = this.cellAt(gx, gy);
    if (!cell || cell.type !== 'mirror' || cell.locked) return;
    const c = this.center(gx, gy);
    if (dist(p.x, p.y, c.x, c.y) > this.cs * 0.52) return;
    const m = this.mirrors.get(this.key(gx, gy))!;
    m.o = m.o === '/' ? '\\' : '/';
    m.target += Math.PI / 2; // always swing the same way — reads as "turning"
    this.host.audio.swivel();
    this.trace();
    this.reveal = 0;
    // reset lit flags so arrivals re-chime
    this.targetLit = this.targets.map(() => false);
  }

  hoverable(p: Vec): boolean {
    if (this.solved) return false;
    const gx = Math.floor((p.x - this.ox) / this.cs);
    const gy = Math.floor((p.y - this.oy) / this.cs);
    const cell = this.cellAt(gx, gy);
    if (!cell || cell.type !== 'mirror' || cell.locked) return false;
    const c = this.center(gx, gy);
    return dist(p.x, p.y, c.x, c.y) <= this.cs * 0.52;
  }

  /* ---- simulation --------------------------------------------------------------- */

  protected tick(dt: number, _t: number): void {
    for (const m of this.mirrors.values()) {
      m.shown += (m.target - m.shown) * (1 - Math.exp(-dt * 14));
    }
    this.reveal = Math.min(this.maxLen + 200, this.reveal + dt * 2600);

    for (let i = 0; i < this.targets.length; i++) {
      const arrivals = this.targetArrive[i];
      const anyArrived = arrivals.some((a) => a <= this.reveal);
      if (anyArrived && !this.targetLit[i]) {
        this.targetLit[i] = true;
        const c = this.center(this.targets[i].x, this.targets[i].y);
        this.host.audio.shimmer(clamp01(c.x / 500) * 0.8 - 0.4);
      }
      const satisfied = this.targetSatisfiedNow(i) && anyArrived;
      this.targetSatisfied[i] = satisfied;
      const want = satisfied ? 1 : this.targetLit[i] ? 0.55 : 0;
      this.targetLitShown[i] += (want - this.targetLitShown[i]) * (1 - Math.exp(-dt * 6));
    }

    if (!this.solved && this.logicalSolved && this.reveal >= this.maxLen) this.win();
    if (this.solved && !this.burstDone && this.solveT > 0.2) {
      this.burstDone = true;
      const p = this.host.palette();
      for (const tc of this.targets) {
        const c = this.center(tc.x, tc.y);
        this.host.particles.burst(c.x, c.y, {
          count: 14,
          colors: [p.accent, p.glow],
          shape: 'spark',
          speed: 120,
          size: 4,
          life: 1.8,
          gravity: -30,
        });
      }
    }
  }

  private targetSatisfiedNow(i: number): boolean {
    const tc = this.targets[i];
    const hits = this.targetHitColors[i];
    if (tc.need && tc.need.length) {
      const got = [...hits].filter((h): h is PrimC => h !== 'w');
      return hits.size === got.length && sameColorSet(got, tc.need);
    }
    return this.arrivedCount(i) >= (tc.hits ?? 1);
  }

  /** How many beams have visibly reached target `i` so far. */
  private arrivedCount(i: number): number {
    return this.targetArrive[i].filter((a) => a <= this.reveal).length;
  }

  /* ---- rendering ------------------------------------------------------------------ */

  render(ctx: CanvasRenderingContext2D, view: View, t: number): void {
    this.fitToView(view);
    const p = this.host.palette();
    const a = this.intro;
    ctx.save();
    ctx.translate(view.cx, view.cy);
    ctx.scale(view.s, view.s);
    ctx.globalAlpha = a;

    // whisper-grid: tiny dots at cell centers
    ctx.fillStyle = withAlpha(p.ink, 0.13);
    for (let gx = 0; gx < this.def.cols; gx++) {
      for (let gy = 0; gy < this.def.rows; gy++) {
        const c = this.center(gx, gy);
        ctx.beginPath();
        ctx.arc(c.x, c.y, 1.6, 0, TAU);
        ctx.fill();
      }
    }

    // beams under the pieces
    const solvedBoost = this.solved ? clamp01(this.solveT / 0.8) * 0.5 : 0;
    for (const b of this.beams) {
      const localReveal = this.reveal - b.startOffset;
      if (localReveal <= 0) continue;
      const colorCss = b.color ? rgbToCss(mixPrims([b.color])) : p.glow;
      const flow = this.host.reducedMotion() ? 0 : Math.sin(t * 2.4) * 0.12;
      glowStroke(
        ctx,
        () => this.partialPath(ctx, b, Math.min(localReveal, b.len)),
        b.color ? colorCss : p.accent,
        b.color ? withAlpha('#ffffff', 0.9) : p.glow,
        3.6,
        0.85 + flow + solvedBoost
      );
    }

    // pieces
    for (const c of this.def.cells) {
      const ctr = this.center(c.x, c.y);
      switch (c.type) {
        case 'emitter':
          this.drawEmitter(ctx, ctr, c, p, t);
          break;
        case 'mirror':
          this.drawMirror(ctx, ctr, this.mirrors.get(this.key(c.x, c.y))!, !!c.locked, p);
          break;
        case 'block':
          this.drawBlock(ctx, ctr, p);
          break;
        case 'splitter':
          this.drawSplitter(ctx, ctr, p, t);
          break;
        case 'dye':
          this.drawDye(ctx, ctr, c, t);
          break;
        case 'target':
          this.drawTarget(ctx, ctr, c, this.targetIdx.get(this.key(c.x, c.y))!, p, t);
          break;
      }
    }

    ctx.restore();
  }

  private partialPath(ctx: CanvasRenderingContext2D, b: Beam, upTo: number): void {
    let remaining = upTo;
    ctx.moveTo(b.pts[0].x, b.pts[0].y);
    for (let i = 0; i < b.segLens.length; i++) {
      const l = b.segLens[i];
      const p0 = b.pts[i];
      const p1 = b.pts[i + 1];
      if (remaining >= l) {
        ctx.lineTo(p1.x, p1.y);
        remaining -= l;
      } else {
        const u = Math.max(0, remaining / l);
        ctx.lineTo(p0.x + (p1.x - p0.x) * u, p0.y + (p1.y - p0.y) * u);
        break;
      }
    }
  }

  private drawEmitter(
    ctx: CanvasRenderingContext2D,
    c: { x: number; y: number },
    cell: LightCellDef,
    p: import('../render/palette').Palette,
    t: number
  ): void {
    const r = this.cs * 0.22;
    const col = cell.color ? rgbToCss(mixPrims([cell.color])) : p.accent;
    const breathe = this.host.reducedMotion() ? 0 : Math.sin(t * 1.3 + c.x) * 0.05;
    ctx.save();
    ctx.translate(c.x, c.y);
    const g = ctx.createRadialGradient(0, 0, 0, 0, 0, r * 2.4);
    g.addColorStop(0, withAlpha('#ffffff', 0.55));
    g.addColorStop(1, withAlpha('#ffffff', 0));
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(0, 0, r * 2.4, 0, TAU);
    ctx.fill();
    ctx.fillStyle = col;
    ctx.beginPath();
    ctx.arc(0, 0, r * (1 + breathe), 0, TAU);
    ctx.fill();
    // rays
    ctx.strokeStyle = withAlpha(col, 0.8);
    ctx.lineWidth = 2;
    ctx.lineCap = 'round';
    for (let i = 0; i < 8; i++) {
      const ang = (i / 8) * TAU + Math.PI / 8;
      ctx.beginPath();
      ctx.moveTo(Math.cos(ang) * r * 1.35, Math.sin(ang) * r * 1.35);
      ctx.lineTo(Math.cos(ang) * r * 1.75, Math.sin(ang) * r * 1.75);
      ctx.stroke();
    }
    ctx.restore();
  }

  private drawMirror(
    ctx: CanvasRenderingContext2D,
    c: { x: number; y: number },
    m: MirrorState,
    locked: boolean,
    p: import('../render/palette').Palette
  ): void {
    const half = this.cs * 0.34;
    ctx.save();
    ctx.translate(c.x, c.y);
    // pivot ring — the tappable affordance
    ctx.strokeStyle = withAlpha(p.ink, locked ? 0.16 : 0.3);
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    ctx.arc(0, 0, this.cs * 0.42, 0, TAU);
    ctx.stroke();
    ctx.rotate(m.shown);
    // glass
    const g = ctx.createLinearGradient(-half, 0, half, 0);
    g.addColorStop(0, withAlpha(p.glow, 0.95));
    g.addColorStop(0.5, withAlpha('#ffffff', 1));
    g.addColorStop(1, withAlpha(p.soft, 0.9));
    ctx.strokeStyle = g;
    ctx.lineCap = 'round';
    ctx.lineWidth = 5.5;
    ctx.beginPath();
    ctx.moveTo(-half, 0);
    ctx.lineTo(half, 0);
    ctx.stroke();
    ctx.strokeStyle = withAlpha(p.ink, locked ? 0.5 : 0.75);
    ctx.lineWidth = 1.4;
    ctx.beginPath();
    ctx.moveTo(-half, 3.6);
    ctx.lineTo(half, 3.6);
    ctx.stroke();
    ctx.restore();
    if (locked) {
      // four studs on the pivot ring: this mirror is set in stone
      ctx.fillStyle = withAlpha(p.ink, 0.5);
      for (let k = 0; k < 4; k++) {
        const a = (k / 4) * TAU + Math.PI / 4;
        ctx.beginPath();
        ctx.arc(
          c.x + Math.cos(a) * this.cs * 0.42,
          c.y + Math.sin(a) * this.cs * 0.42,
          2.2,
          0,
          TAU
        );
        ctx.fill();
      }
    }
  }

  private drawBlock(
    ctx: CanvasRenderingContext2D,
    c: { x: number; y: number },
    p: import('../render/palette').Palette
  ): void {
    const r = this.cs * 0.3;
    ctx.save();
    ctx.translate(c.x, c.y);
    ctx.fillStyle = withAlpha(p.ink, 0.34);
    ctx.beginPath();
    ctx.moveTo(-r, r * 0.5);
    ctx.quadraticCurveTo(-r * 1.05, -r * 0.6, -r * 0.25, -r * 0.85);
    ctx.quadraticCurveTo(r * 0.7, -r * 1.15, r, -r * 0.1);
    ctx.quadraticCurveTo(r * 1.05, r * 0.75, r * 0.15, r * 0.8);
    ctx.quadraticCurveTo(-r * 0.6, r * 0.9, -r, r * 0.5);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  }

  private drawSplitter(
    ctx: CanvasRenderingContext2D,
    c: { x: number; y: number },
    p: import('../render/palette').Palette,
    t: number
  ): void {
    const r = this.cs * 0.3;
    ctx.save();
    ctx.translate(c.x, c.y);
    if (!this.host.reducedMotion()) ctx.rotate(Math.sin(t * 0.6) * 0.06);
    ctx.beginPath();
    ctx.moveTo(0, -r);
    ctx.lineTo(r * 0.9, r * 0.7);
    ctx.lineTo(-r * 0.9, r * 0.7);
    ctx.closePath();
    ctx.fillStyle = withAlpha(p.glow, 0.75);
    ctx.fill();
    ctx.strokeStyle = withAlpha(p.ink, 0.6);
    ctx.lineWidth = 1.6;
    ctx.stroke();
    ctx.restore();
  }

  /** A pane of tinted glass: whatever light passes it takes on its color. */
  private drawDye(
    ctx: CanvasRenderingContext2D,
    c: { x: number; y: number },
    cell: LightCellDef,
    t: number
  ): void {
    const r = this.cs * 0.26;
    const col = rgbToCss(mixPrims([cell.color ?? 'y']));
    ctx.save();
    ctx.translate(c.x, c.y);
    if (!this.host.reducedMotion()) ctx.rotate(Math.sin(t * 0.7 + c.x) * 0.04);
    // soft tinted aura
    const g = ctx.createRadialGradient(0, 0, 0, 0, 0, r * 2);
    g.addColorStop(0, rgbToCss(mixPrims([cell.color ?? 'y']), 0.22));
    g.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(0, 0, r * 2, 0, TAU);
    ctx.fill();
    // the pane: a rounded droplet of stained glass
    ctx.beginPath();
    ctx.moveTo(0, -r * 1.25);
    ctx.quadraticCurveTo(r, -r * 0.3, r * 0.62, r * 0.55);
    ctx.quadraticCurveTo(0, r * 1.25, -r * 0.62, r * 0.55);
    ctx.quadraticCurveTo(-r, -r * 0.3, 0, -r * 1.25);
    ctx.closePath();
    ctx.fillStyle = rgbToCss(mixPrims([cell.color ?? 'y']), 0.4);
    ctx.fill();
    ctx.strokeStyle = col;
    ctx.lineWidth = 2;
    ctx.stroke();
    ctx.fillStyle = 'rgba(255,255,255,0.75)';
    ctx.beginPath();
    ctx.arc(0, -r * 0.2, 2.6, 0, TAU);
    ctx.fill();
    ctx.restore();
  }

  private drawTarget(
    ctx: CanvasRenderingContext2D,
    c: { x: number; y: number },
    cell: LightCellDef,
    idx: number,
    p: import('../render/palette').Palette,
    t: number
  ): void {
    const lit = this.targetLitShown[idx];
    const satisfied = this.targetSatisfied[idx];
    const r = this.cs * 0.3 * (1 + (satisfied ? bump(clamp01(this.solveT)) * 0.25 : 0));
    const wantCol = cell.need?.length ? rgbToCss(mixPrims(cell.need)) : p.accent;
    ctx.save();
    ctx.translate(c.x, c.y);
    if (!this.host.reducedMotion()) ctx.rotate(Math.sin(t * 0.5 + idx * 2) * 0.05);

    if (lit > 0.02) {
      const g = ctx.createRadialGradient(0, 0, 0, 0, 0, r * 2.6);
      g.addColorStop(0, withAlpha('#ffffff', 0.35 * lit));
      g.addColorStop(1, withAlpha('#ffffff', 0));
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.arc(0, 0, r * 2.6, 0, TAU);
      ctx.fill();
    }

    // crystal
    ctx.beginPath();
    ctx.moveTo(0, -r);
    ctx.lineTo(r * 0.72, 0);
    ctx.lineTo(0, r);
    ctx.lineTo(-r * 0.72, 0);
    ctx.closePath();
    const got = this.targetHitColors[idx];
    const gotCols = [...got].filter((h): h is PrimC => h !== 'w');
    const litCol =
      gotCols.length > 0 ? rgbToCss(mixPrims(gotCols)) : withAlpha('#ffffff', 0.9);
    if (lit > 0.02) {
      ctx.save();
      ctx.globalAlpha = 0.25 + lit * 0.75;
      ctx.fillStyle = litCol;
      ctx.fill();
      ctx.restore();
    }
    ctx.strokeStyle = satisfied ? wantCol : withAlpha(p.ink, 0.6);
    ctx.lineWidth = satisfied ? 2.6 : 1.8;
    ctx.stroke();
    // inner facet
    ctx.strokeStyle = withAlpha(p.ink, 0.25);
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(0, -r);
    ctx.lineTo(0, r);
    ctx.moveTo(-r * 0.72, 0);
    ctx.lineTo(r * 0.72, 0);
    ctx.stroke();

    // multi-beam pips: this crystal wants to be fed more than once
    if ((cell.hits ?? 1) > 1) {
      const want = cell.hits!;
      const got = this.arrivedCount(idx);
      for (let k = 0; k < want; k++) {
        const px = (k - (want - 1) / 2) * 10;
        ctx.beginPath();
        ctx.arc(px, r * 1.55, 3.2, 0, TAU);
        if (k < got) {
          ctx.fillStyle = p.accent;
          ctx.fill();
        } else {
          ctx.strokeStyle = withAlpha(p.ink, 0.55);
          ctx.lineWidth = 1.4;
          ctx.stroke();
        }
      }
    }

    // required-color ring for the Unity variant
    if (cell.need?.length) {
      ctx.strokeStyle = wantCol;
      ctx.lineWidth = 2.2;
      ctx.globalAlpha = satisfied ? 1 : 0.75;
      ctx.beginPath();
      ctx.arc(0, 0, r * 1.45, 0, TAU);
      ctx.stroke();
      // constituent hint dots
      if (cell.need.length > 1) {
        cell.need.forEach((pc, i) => {
          const ang = -Math.PI / 2 + (i - (cell.need!.length - 1) / 2) * 0.55;
          ctx.fillStyle = rgbToCss(mixPrims([pc]));
          ctx.beginPath();
          ctx.arc(Math.cos(ang) * r * 1.45, Math.sin(ang) * r * 1.45, 3.4, 0, TAU);
          ctx.fill();
        });
      }
    }
    ctx.restore();

    // solved halo + a slow lens-flare cross blooming out of the crystal
    if (satisfied && this.solved) {
      const u = clamp01(this.solveT / 1.6);
      ctx.save();
      ctx.globalAlpha = (1 - u) * 0.5;
      ctx.strokeStyle = wantCol;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(c.x, c.y, r * (1.5 + u * 2.6), 0, TAU);
      ctx.stroke();
      ctx.restore();

      const flare = bump(clamp01(this.solveT / 2.2));
      if (flare > 0.01) {
        ctx.save();
        ctx.translate(c.x, c.y);
        ctx.rotate(0.35 + this.solveT * (this.host.reducedMotion() ? 0 : 0.12));
        ctx.globalCompositeOperation = 'screen';
        for (const ang of [0, Math.PI / 2]) {
          ctx.save();
          ctx.rotate(ang);
          const len = r * (3 + flare * 7);
          const g = ctx.createLinearGradient(-len, 0, len, 0);
          g.addColorStop(0, withAlpha('#ffffff', 0));
          g.addColorStop(0.5, withAlpha('#ffffff', 0.55 * flare));
          g.addColorStop(1, withAlpha('#ffffff', 0));
          ctx.fillStyle = g;
          ctx.fillRect(-len, -1.6 - flare * 1.6, len * 2, 3.2 + flare * 3.2);
          ctx.restore();
        }
        ctx.restore();
      }
    }
  }
}
