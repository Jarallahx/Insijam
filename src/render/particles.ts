/* ---------------------------------------------------------------------------
   A small particle pool for celebration moments — drifting motes, petals
   and sparks. Everything works in virtual coordinates.
--------------------------------------------------------------------------- */

import { clamp01, TAU } from './ease';
import { withAlpha } from './palette';
import type { View } from '../core/types';

type Shape = 'dot' | 'petal' | 'spark';

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  age: number;
  size: number;
  rot: number;
  vrot: number;
  color: string;
  shape: Shape;
  drag: number;
  gravity: number;
}

export interface BurstOpts {
  count?: number;
  color?: string;
  colors?: string[];
  shape?: Shape;
  speed?: number;
  spread?: number; // radians; TAU = all directions
  dir?: number;
  size?: number;
  life?: number;
  gravity?: number;
  drag?: number;
}

export class Particles {
  private items: Particle[] = [];
  reducedMotion = false;

  burst(x: number, y: number, opts: BurstOpts = {}): void {
    const count = Math.round((opts.count ?? 18) * (this.reducedMotion ? 0.4 : 1));
    const spread = opts.spread ?? TAU;
    const dir = opts.dir ?? 0;
    const speed = opts.speed ?? 130;
    for (let i = 0; i < count; i++) {
      const a = dir + (Math.random() - 0.5) * spread;
      const v = speed * (0.35 + Math.random() * 0.75);
      const colors = opts.colors;
      this.items.push({
        x,
        y,
        vx: Math.cos(a) * v,
        vy: Math.sin(a) * v,
        life: (opts.life ?? 1.6) * (0.7 + Math.random() * 0.6),
        age: 0,
        size: (opts.size ?? 5) * (0.6 + Math.random() * 0.8),
        rot: Math.random() * TAU,
        vrot: (Math.random() - 0.5) * 3,
        color: colors ? colors[i % colors.length] : (opts.color ?? '#ffffff'),
        shape: opts.shape ?? 'dot',
        drag: opts.drag ?? 1.6,
        gravity: opts.gravity ?? -14,
      });
    }
    // keep the pool bounded
    if (this.items.length > 600) this.items.splice(0, this.items.length - 600);
  }

  get count(): number {
    return this.items.length;
  }

  update(dt: number): void {
    for (let i = this.items.length - 1; i >= 0; i--) {
      const p = this.items[i];
      p.age += dt;
      if (p.age >= p.life) {
        this.items.splice(i, 1);
        continue;
      }
      const damp = Math.exp(-p.drag * dt);
      p.vx *= damp;
      p.vy = p.vy * damp + p.gravity * dt;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.rot += p.vrot * dt;
    }
  }

  render(ctx: CanvasRenderingContext2D, view: View): void {
    if (this.items.length === 0) return;
    ctx.save();
    ctx.translate(view.cx, view.cy);
    ctx.scale(view.s, view.s);
    for (const p of this.items) {
      const u = clamp01(p.age / p.life);
      const alpha = u < 0.15 ? u / 0.15 : 1 - (u - 0.15) / 0.85;
      ctx.globalAlpha = clamp01(alpha) * 0.9;
      ctx.fillStyle = p.color;
      if (p.shape === 'petal') {
        ctx.save();
        ctx.translate(p.x, p.y);
        ctx.rotate(p.rot);
        ctx.beginPath();
        ctx.ellipse(0, 0, p.size * 1.6, p.size * 0.65, 0, 0, TAU);
        ctx.fill();
        ctx.restore();
      } else if (p.shape === 'spark') {
        ctx.save();
        ctx.translate(p.x, p.y);
        ctx.rotate(p.rot);
        const s = p.size;
        ctx.beginPath();
        ctx.moveTo(-s * 1.7, 0);
        ctx.lineTo(0, -s * 0.4);
        ctx.lineTo(s * 1.7, 0);
        ctx.lineTo(0, s * 0.4);
        ctx.closePath();
        ctx.fill();
        ctx.restore();
      } else {
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size * (1 - u * 0.4), 0, TAU);
        ctx.fill();
      }
    }
    ctx.restore();
  }

  /** A soft halo ring that expands and fades — the universal "solved" pulse. */
  static ring(
    ctx: CanvasRenderingContext2D,
    x: number,
    y: number,
    radius: number,
    color: string,
    alpha: number,
    width = 3
  ): void {
    if (alpha <= 0.003) return;
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.strokeStyle = color;
    ctx.lineWidth = width;
    ctx.beginPath();
    ctx.arc(x, y, radius, 0, TAU);
    ctx.stroke();
    ctx.restore();
  }
}

/** Layered glow stroke helper — a cheap, pretty alternative to shadowBlur. */
export function glowStroke(
  ctx: CanvasRenderingContext2D,
  draw: () => void,
  color: string,
  coreColor: string,
  width: number,
  intensity = 1
): void {
  ctx.save();
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.strokeStyle = withAlpha(color.startsWith('#') ? color : '#ffffff', 0);
  // wide soft halo
  ctx.globalAlpha = 0.16 * intensity;
  ctx.strokeStyle = color;
  ctx.lineWidth = width * 4.2;
  ctx.beginPath();
  draw();
  ctx.stroke();
  // mid glow
  ctx.globalAlpha = 0.3 * intensity;
  ctx.lineWidth = width * 2;
  ctx.beginPath();
  draw();
  ctx.stroke();
  // bright core
  ctx.globalAlpha = Math.min(1, 0.95 * intensity);
  ctx.strokeStyle = coreColor;
  ctx.lineWidth = width;
  ctx.beginPath();
  draw();
  ctx.stroke();
  ctx.restore();
}
