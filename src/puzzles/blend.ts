/* ---------------------------------------------------------------------------
   Dusk — "blend". Translucent disks of colored light drift between anchor
   points. Where disks overlap, their colors mix additively. Give every
   socket exactly the color it asks for — no more, no less.
--------------------------------------------------------------------------- */

import { Puzzle, type PuzzleHost } from './base';
import type { BlendDef } from './defs';
import { bump, clamp, clamp01, dist, TAU } from '../render/ease';
import { mixPrims, rgbToCss, sameColorSet, withAlpha, type PrimC } from '../render/palette';
import type { Vec, View } from '../core/types';

const DEFAULT_R = 130;
const COVER_PAD = 16;

interface DiskState {
  color: PrimC;
  r: number;
  anchors: [number, number][];
  idx: number;
  pos: Vec; // shown position
  link?: number;
  scale: number;
}

export class BlendPuzzle extends Puzzle {
  private disks: DiskState[] = [];
  private def: BlendDef;
  private dragIdx: number | null = null;
  private grabOff: Vec = { x: 0, y: 0 };
  private socketOk: boolean[];
  private socketShown: number[];
  private off: HTMLCanvasElement | null = null;
  private settledFor = 0;
  private burstDone = false;
  private firstTick = true;

  constructor(host: PuzzleHost, def: BlendDef) {
    super(host);
    this.def = def;
    for (const d of def.disks) {
      const [ax, ay] = d.anchors[d.at];
      this.disks.push({
        color: d.color,
        r: d.r ?? DEFAULT_R,
        anchors: d.anchors,
        idx: d.at,
        pos: { x: ax, y: ay },
        link: d.link,
        scale: 1,
      });
    }
    this.socketOk = def.sockets.map(() => false);
    this.socketShown = def.sockets.map(() => 0);
  }

  /* ---- interaction ---------------------------------------------------------- */

  down(p: Vec): void {
    if (this.solved) return;
    for (let i = this.disks.length - 1; i >= 0; i--) {
      const d = this.disks[i];
      if (dist(p.x, p.y, d.pos.x, d.pos.y) <= d.r * 0.92) {
        this.dragIdx = i;
        this.grabOff = { x: p.x - d.pos.x, y: p.y - d.pos.y };
        this.host.audio.lift(true);
        return;
      }
    }
  }

  move(p: Vec): void {
    if (this.dragIdx === null) return;
    const d = this.disks[this.dragIdx];
    d.pos.x = clamp(p.x - this.grabOff.x, -560, 560);
    d.pos.y = clamp(p.y - this.grabOff.y, -420, 420);
    // linked partner previews the landing
    if (d.link !== undefined) {
      const partner = this.disks[d.link];
      const k = this.nearestAnchor(d);
      const [px, py] = partner.anchors[Math.min(k, partner.anchors.length - 1)];
      partner.pos.x += (px - partner.pos.x) * 0.25;
      partner.pos.y += (py - partner.pos.y) * 0.25;
    }
  }

  up(_p: Vec): void {
    if (this.dragIdx === null) return;
    const d = this.disks[this.dragIdx];
    this.dragIdx = null;
    const k = this.nearestAnchor(d);
    const moved = k !== d.idx;
    d.idx = k;
    if (d.link !== undefined) {
      const partner = this.disks[d.link];
      partner.idx = Math.min(k, partner.anchors.length - 1);
    }
    this.host.audio.lift(false);
    if (moved) this.host.audio.tick(1.15);
  }

  hoverable(p: Vec): boolean {
    if (this.solved) return false;
    return this.disks.some((d) => dist(p.x, p.y, d.pos.x, d.pos.y) <= d.r * 0.92);
  }

  private nearestAnchor(d: DiskState): number {
    let best = 0;
    let bestD = Infinity;
    d.anchors.forEach(([ax, ay], i) => {
      const dd = dist(d.pos.x, d.pos.y, ax, ay);
      if (dd < bestD) {
        bestD = dd;
        best = i;
      }
    });
    return best;
  }

  /* ---- simulation -------------------------------------------------------------- */

  protected tick(dt: number, _t: number): void {
    // disks ease home
    this.disks.forEach((d, i) => {
      const dragging = this.dragIdx === i;
      const targetScale = dragging ? 1.05 : 1;
      d.scale += (targetScale - d.scale) * (1 - Math.exp(-dt * 10));
      if (!dragging) {
        const [ax, ay] = d.anchors[d.idx];
        const e = 1 - Math.exp(-dt * 9);
        d.pos.x += (ax - d.pos.x) * e;
        d.pos.y += (ay - d.pos.y) * e;
      }
    });

    // socket satisfaction from shown positions (live feedback)
    this.def.sockets.forEach((s, i) => {
      const covering: PrimC[] = [];
      for (const d of this.disks) {
        if (dist(s.x, s.y, d.pos.x, d.pos.y) <= d.r - COVER_PAD) covering.push(d.color);
      }
      const ok = sameColorSet([...new Set(covering)], s.need);
      // dark sockets are "satisfied" from the start — don't chime for them then
      if (ok && !this.socketOk[i] && !this.solved && !this.firstTick && s.need.length > 0) {
        this.host.audio.note(i + 2, { level: 0.05, pan: clamp(s.x / 500, -0.7, 0.7) });
      }
      this.socketOk[i] = ok;
      this.socketShown[i] += ((ok ? 1 : 0) - this.socketShown[i]) * (1 - Math.exp(-dt * 5));
    });
    this.firstTick = false;

    // solve when everything is content and at rest
    const atRest =
      this.dragIdx === null &&
      this.disks.every((d) => {
        const [ax, ay] = d.anchors[d.idx];
        return dist(d.pos.x, d.pos.y, ax, ay) < 4;
      });
    if (!this.solved && atRest && this.socketOk.every(Boolean)) {
      this.settledFor += dt;
      if (this.settledFor > 0.35) this.win();
    } else if (!this.solved) {
      this.settledFor = 0;
    }

    if (this.solved && !this.burstDone && this.solveT > 0.25) {
      this.burstDone = true;
      for (const s of this.def.sockets) {
        this.host.particles.burst(s.x, s.y, {
          count: 12,
          color: rgbToCss(mixPrims(s.need)),
          shape: 'dot',
          speed: 90,
          size: 4.5,
          life: 2,
          gravity: -26,
        });
      }
    }
  }

  /* ---- rendering ------------------------------------------------------------------ */

  render(ctx: CanvasRenderingContext2D, view: View, t: number): void {
    const p = this.host.palette();
    const a = this.intro;

    // tracks and anchors, under the light
    ctx.save();
    ctx.translate(view.cx, view.cy);
    ctx.scale(view.s, view.s);
    ctx.globalAlpha = a;
    for (const d of this.disks) {
      if (d.anchors.length > 1) {
        ctx.strokeStyle = withAlpha(p.ink, 0.22);
        ctx.lineWidth = 1.4;
        ctx.setLineDash([1, 9]);
        ctx.lineCap = 'round';
        ctx.beginPath();
        d.anchors.forEach(([ax, ay], i) => (i === 0 ? ctx.moveTo(ax, ay) : ctx.lineTo(ax, ay)));
        ctx.stroke();
        ctx.setLineDash([]);
      }
      for (const [ax, ay] of d.anchors) {
        ctx.beginPath();
        ctx.arc(ax, ay, 3.4, 0, TAU);
        ctx.fillStyle = withAlpha(p.ink, 0.3);
        ctx.fill();
      }
    }
    // linked-disk threads — brighten while either partner is held
    this.disks.forEach((d, di) => {
      if (d.link !== undefined && d.link > di) return; // draw each pair once
      if (d.link !== undefined) {
        const o = this.disks[d.link];
        const held = this.dragIdx === di || this.dragIdx === d.link;
        ctx.strokeStyle = withAlpha(p.ink, held ? 0.6 : 0.3);
        ctx.setLineDash([3, 7]);
        ctx.lineWidth = held ? 2 : 1.4;
        ctx.beginPath();
        ctx.moveTo(d.pos.x, d.pos.y);
        ctx.lineTo(o.pos.x, o.pos.y);
        ctx.stroke();
        ctx.setLineDash([]);
        // matching diamond charms halfway along, so the bond reads at rest
        for (const u of [0.22, 0.78]) {
          const mx = d.pos.x + (o.pos.x - d.pos.x) * u;
          const my = d.pos.y + (o.pos.y - d.pos.y) * u;
          ctx.save();
          ctx.translate(mx, my);
          ctx.rotate(Math.PI / 4);
          ctx.fillStyle = withAlpha(p.ink, held ? 0.75 : 0.45);
          ctx.fillRect(-3.4, -3.4, 6.8, 6.8);
          ctx.restore();
        }
      }
    });
    ctx.restore();

    // the light itself — additive offscreen, screened onto the sky
    if (!this.off || this.off.width !== Math.ceil(view.w) || this.off.height !== Math.ceil(view.h)) {
      this.off = document.createElement('canvas');
      this.off.width = Math.ceil(view.w);
      this.off.height = Math.ceil(view.h);
    }
    const oc = this.off.getContext('2d')!;
    oc.setTransform(1, 0, 0, 1, 0, 0);
    oc.clearRect(0, 0, this.off.width, this.off.height);
    oc.translate(view.cx, view.cy);
    oc.scale(view.s, view.s);
    oc.globalCompositeOperation = 'lighter';
    const breathe = this.host.reducedMotion() ? 0 : 1;
    for (const d of this.disks) {
      const r =
        d.r * d.scale * (1 + Math.sin(t * 0.9 + d.pos.x * 0.01) * 0.012 * breathe) * (0.9 + a * 0.1);
      const col = mixPrims([d.color]);
      const g = oc.createRadialGradient(d.pos.x, d.pos.y, 0, d.pos.x, d.pos.y, r);
      const solid = this.solved ? 0.9 : 0.82;
      g.addColorStop(0, rgbToCss(col, solid * a));
      g.addColorStop(0.68, rgbToCss(col, solid * 0.82 * a));
      g.addColorStop(1, rgbToCss(col, 0));
      oc.fillStyle = g;
      oc.beginPath();
      oc.arc(d.pos.x, d.pos.y, r, 0, TAU);
      oc.fill();
    }
    ctx.save();
    ctx.globalCompositeOperation = 'screen';
    ctx.globalAlpha = 0.92;
    ctx.drawImage(this.off, 0, 0, view.w, view.h);
    ctx.restore();

    // disk rims + grab affordance, and sockets on top
    ctx.save();
    ctx.translate(view.cx, view.cy);
    ctx.scale(view.s, view.s);
    ctx.globalAlpha = a;
    for (const d of this.disks) {
      ctx.strokeStyle = rgbToCss(mixPrims([d.color]), 0.55);
      ctx.lineWidth = 1.6;
      ctx.beginPath();
      ctx.arc(d.pos.x, d.pos.y, d.r * d.scale, 0, TAU);
      ctx.stroke();
      ctx.fillStyle = withAlpha('#ffffff', 0.75);
      ctx.beginPath();
      ctx.arc(d.pos.x, d.pos.y, 4.2, 0, TAU);
      ctx.fill();
    }

    const dragColor = this.dragIdx !== null ? this.disks[this.dragIdx].color : null;
    this.def.sockets.forEach((s, i) => {
      const ok = this.socketShown[i];
      const dark = s.need.length === 0;
      const want = dark ? withAlpha(p.ink, 0.9) : rgbToCss(mixPrims(s.need));
      const r = 30 + (this.solved ? bump(clamp01(this.solveT / 1.4)) * 8 : 0);
      // while dragging, sockets that ask for this color lean toward the player
      const invited = dragColor !== null && s.need.includes(dragColor);
      ctx.save();
      ctx.translate(s.x, s.y);

      if (dark) {
        // the quiet moon: must stay untouched by any light
        const violated = ok < 0.5;
        ctx.strokeStyle = violated ? withAlpha('#ffffff', 0.85) : withAlpha(p.ink, 0.7);
        ctx.lineWidth = 2;
        if (violated) ctx.setLineDash([4, 5]);
        ctx.beginPath();
        ctx.arc(0, 0, r, 0, TAU);
        ctx.stroke();
        ctx.setLineDash([]);
        // crescent heart
        ctx.fillStyle = withAlpha(p.ink, violated ? 0.5 : 0.85);
        ctx.beginPath();
        ctx.arc(0, 0, 12, 0, TAU);
        ctx.fill();
        ctx.fillStyle = withAlpha(p.glow, violated ? 0.35 : 0.55);
        ctx.beginPath();
        ctx.arc(4.5, -3, 8.5, 0, TAU);
        ctx.fill();
        ctx.fillStyle = withAlpha(p.ink, violated ? 0.5 : 0.85);
        ctx.beginPath();
        ctx.arc(2, -1.5, 8.5, 0, TAU);
        ctx.fill();
        ctx.restore();
        return;
      }

      // outer ring: dashed while unsatisfied, whole when content
      ctx.strokeStyle = ok > 0.5 ? want : withAlpha(p.ink, invited ? 0.95 : 0.65);
      ctx.lineWidth = 2 + ok * 1.2 + (invited ? 0.8 : 0);
      if (ok < 0.5) ctx.setLineDash([5, 6]);
      if (!this.host.reducedMotion() && ok < 0.5) ctx.rotate(t * 0.15);
      ctx.beginPath();
      ctx.arc(0, 0, r + (invited ? 3 : 0), 0, TAU);
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.rotate(0);
      // the asked-for color, always visible in the heart
      ctx.fillStyle = want;
      ctx.globalAlpha = a * (0.55 + ok * 0.45);
      ctx.beginPath();
      ctx.arc(0, 0, 11 + ok * 3, 0, TAU);
      ctx.fill();
      ctx.globalAlpha = a;
      // constituent dots so mixes are learnable
      if (s.need.length > 1) {
        s.need.forEach((pc, j) => {
          const ang = -Math.PI / 2 + (j - (s.need.length - 1) / 2) * 0.6;
          const isDragged = dragColor === pc;
          ctx.fillStyle = rgbToCss(mixPrims([pc]));
          ctx.beginPath();
          ctx.arc(Math.cos(ang) * (r - 8), Math.sin(ang) * (r - 8), isDragged ? 4.4 : 3.2, 0, TAU);
          ctx.fill();
        });
      }
      ctx.restore();

      // satisfied halo
      if (ok > 0.6 && this.solved) {
        const u = clamp01(this.solveT / 1.8);
        ctx.save();
        ctx.globalAlpha = (1 - u) * 0.45;
        ctx.strokeStyle = want;
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(s.x, s.y, r + u * 110, 0, TAU);
        ctx.stroke();
        ctx.restore();
      }
    });

    // solved: one warm wave of light washes across the whole dusk
    if (this.solved) {
      const u = clamp01(this.solveT / 2.4);
      if (u > 0.01 && u < 1) {
        const R = 60 + u * 950;
        ctx.save();
        ctx.globalCompositeOperation = 'screen';
        const g = ctx.createRadialGradient(0, 0, Math.max(0, R - 130), 0, 0, R + 90);
        g.addColorStop(0, 'rgba(255,240,220,0)');
        g.addColorStop(0.55, `rgba(255,240,220,${0.22 * bump(u)})`);
        g.addColorStop(1, 'rgba(255,240,220,0)');
        ctx.fillStyle = g;
        ctx.beginPath();
        ctx.arc(0, 0, R + 90, 0, TAU);
        ctx.fill();
        ctx.restore();
      }
    }
    ctx.restore();
  }
}
