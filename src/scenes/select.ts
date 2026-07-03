/* ---------------------------------------------------------------------------
   Level select — the journey drawn as a constellation path across the sky,
   one star per level, clustered by chapter. Completed stars burn bright
   and stay threaded together; the next star waits, pulsing softly.
--------------------------------------------------------------------------- */

import type { Game, Scene } from '../core/game';
import type { View, Vec } from '../core/types';
import { LEVELS, isUnlocked } from '../levels/data';
import { CHAPTERS, withAlpha, type ChapterId } from '../render/palette';
import { clamp01, seeded, TAU } from '../render/ease';
import { getLang, ROMAN, t, type StringKey } from '../i18n/strings';
import { glowStroke } from '../render/particles';
import { LevelScene } from './level';
import { MenuScene } from './menu';

const CH_NAME: Record<ChapterId, StringKey> = {
  dawn: 'chDawn',
  day: 'chDay',
  dusk: 'chDusk',
  night: 'chNight',
  unity: 'chUnity',
};

export class SelectScene implements Scene {
  private dom: HTMLElement | null = null;
  private tip: HTMLElement | null = null;
  private game!: Game;
  private pts: { x: number; y: number }[] = [];
  private hover = -1;
  private entered = 0;
  private onLang = () => this.build();

  enter(game: Game): void {
    this.game = game;
    this.entered = 0;
    const cur = this.currentIndex();
    game.background.setChapter(LEVELS[cur].chapter, 2.2);
    game.audio.setChapter(LEVELS[cur].chapter);
    this.build();
    game.ui.langListeners.add(this.onLang);
  }

  exit(game: Game): void {
    game.ui.langListeners.delete(this.onLang);
    game.ui.dismiss(this.dom);
    this.dom = null;
    this.tip = null;
  }

  /** First unlocked, uncompleted level — where the journey currently is. */
  private currentIndex(): number {
    for (let i = 0; i < LEVELS.length; i++) {
      if (!this.game.save.isCompleted(LEVELS[i].id)) return i;
    }
    return LEVELS.length - 1;
  }

  private build(): void {
    const { ui } = this.game;
    if (this.dom) {
      this.dom.remove();
      this.dom = null;
    }
    const s = ui.screen('select');
    const tl = ui.el('div', 'corner tl');
    tl.appendChild(ui.iconButton('back', () => this.game.goto(new MenuScene())));
    const tr = ui.el('div', 'corner tr');
    tr.appendChild(ui.iconButton('gear', () => ui.toggleSettings()));
    tl.classList.add('hit');
    tr.classList.add('hit');
    this.tip = ui.el('div', 'map-tip');
    s.append(tl, tr, this.tip);
    this.dom = s;
  }

  /** Screen-pixel position of each level's star. */
  private layout(view: View): void {
    this.pts = [];
    const left = view.w * 0.09;
    const usable = view.w * 0.82;
    const counts: Record<string, number> = {};
    for (const l of LEVELS) counts[l.chapter] = (counts[l.chapter] ?? 0) + 1;
    const seen: Record<string, number> = {};
    LEVELS.forEach((l, i) => {
      const c = CHAPTERS.indexOf(l.chapter);
      const k = seen[l.chapter] ?? 0;
      seen[l.chapter] = k + 1;
      const u = (c + 0.14 + (0.72 * (k + 0.5)) / counts[l.chapter]) / CHAPTERS.length;
      const x = left + u * usable;
      const y =
        view.h *
        (0.44 +
          0.13 * Math.sin(u * TAU * 1.15 + 0.6) +
          (seeded(i * 7 + 3) - 0.5) * 0.11);
      this.pts.push({ x, y });
    });
  }

  update(dt: number, _t: number, _game: Game): void {
    this.entered = clamp01(this.entered + dt / 1.2);
  }

  down(p: Vec, game: Game): void {
    const view = game.view;
    const px = p.x * view.s + view.cx;
    const py = p.y * view.s + view.cy;
    const i = this.starAt(px, py);
    if (i < 0) return;
    if (!isUnlocked(i, (id) => game.save.isCompleted(id))) {
      game.audio.soften();
      return;
    }
    game.audio.unlockPing();
    game.goto(new LevelScene(i), { fade: 1.2 });
  }

  move(p: Vec, game: Game): void {
    const view = game.view;
    const px = p.x * view.s + view.cx;
    const py = p.y * view.s + view.cy;
    const i = this.starAt(px, py);
    if (i !== this.hover) {
      this.hover = i;
      if (this.tip) {
        if (i >= 0 && isUnlocked(i, (id) => game.save.isCompleted(id))) {
          this.tip.textContent = t(LEVELS[i].name);
          this.tip.style.left = `${this.pts[i].x}px`;
          this.tip.style.top = `${this.pts[i].y}px`;
          this.tip.classList.add('visible');
          game.canvas.style.cursor = 'pointer';
        } else {
          this.tip.classList.remove('visible');
          game.canvas.style.cursor = 'default';
        }
      }
    }
  }

  private starAt(px: number, py: number): number {
    for (let i = 0; i < this.pts.length; i++) {
      if (Math.hypot(px - this.pts[i].x, py - this.pts[i].y) < 26) return i;
    }
    return -1;
  }

  render(ctx: CanvasRenderingContext2D, view: View, time: number, game: Game): void {
    this.layout(view);
    const p = game.palette;
    const cur = this.currentIndex();
    const a = this.entered;

    // path: the road already walked glows; the road ahead is a whisper
    ctx.save();
    ctx.globalAlpha = a;
    const drawPathUpTo = (from: number, to: number) => {
      ctx.moveTo(this.pts[from].x, this.pts[from].y);
      for (let i = from + 1; i <= to; i++) {
        const prev = this.pts[i - 1];
        const here = this.pts[i];
        const mx = (prev.x + here.x) / 2;
        const my = (prev.y + here.y) / 2;
        ctx.quadraticCurveTo(prev.x, prev.y, mx, my);
        if (i === to) ctx.lineTo(here.x, here.y);
      }
    };
    if (cur > 0) {
      glowStroke(ctx, () => drawPathUpTo(0, cur), p.accent, p.glow, 1.8, 0.6 * a);
    }
    if (cur < LEVELS.length - 1) {
      ctx.strokeStyle = withAlpha(p.ink, 0.3);
      ctx.setLineDash([2, 9]);
      ctx.lineWidth = 1.4;
      ctx.lineCap = 'round';
      ctx.beginPath();
      drawPathUpTo(cur, LEVELS.length - 1);
      ctx.stroke();
      ctx.setLineDash([]);
    }

    // chapter labels
    const latin = getLang() === 'en';
    for (let c = 0; c < CHAPTERS.length; c++) {
      const idxs = LEVELS.map((l, i) => ({ l, i })).filter((e) => e.l.chapter === CHAPTERS[c]);
      const cx = idxs.reduce((s2, e) => s2 + this.pts[e.i].x, 0) / idxs.length;
      const anyUnlocked = isUnlocked(idxs[0].i, (id) => game.save.isCompleted(id));
      ctx.textAlign = 'center';
      ctx.fillStyle = withAlpha(p.ink, anyUnlocked ? 0.75 : 0.32);
      const base = view.h * 0.8;
      ctx.font = `300 ${Math.round(13 * Math.min(1.4, view.s * 1.9))}px 'Josefin Sans','Tajawal',sans-serif`;
      ctx.fillText(ROMAN[c], cx, base - (latin ? 26 : 30));
      ctx.font = `300 ${Math.round(19 * Math.min(1.4, view.s * 1.9))}px ${latin ? "'Josefin Sans','Tajawal'" : "'Tajawal','Josefin Sans'"},sans-serif`;
      ctx.fillText(t(CH_NAME[CHAPTERS[c]]), cx, base);
    }

    // stars
    for (let i = 0; i < LEVELS.length; i++) {
      const pt = this.pts[i];
      const done = game.save.isCompleted(LEVELS[i].id);
      const open = isUnlocked(i, (id) => game.save.isCompleted(id));
      const isCurrent = i === cur && open && !done;
      const hovered = i === this.hover && open;
      const su = clamp01(a * 2.4 - i * 0.05);
      if (su <= 0) continue;

      const pulse = isCurrent && !game.reducedMotion ? 1 + Math.sin(time * 2.2) * 0.16 : 1;
      const R = (done ? 7.5 : isCurrent ? 10 : 3.4) * pulse * (hovered ? 1.25 : 1) * su;

      if (done || isCurrent) {
        const g = ctx.createRadialGradient(pt.x, pt.y, 0, pt.x, pt.y, R * 4);
        g.addColorStop(0, withAlpha(done ? p.accent : p.glow, 0.5 * su));
        g.addColorStop(1, withAlpha(p.glow, 0));
        ctx.fillStyle = g;
        ctx.beginPath();
        ctx.arc(pt.x, pt.y, R * 4, 0, TAU);
        ctx.fill();
      }

      ctx.save();
      ctx.translate(pt.x, pt.y);
      ctx.rotate(game.reducedMotion ? 0 : time * 0.12 + i);
      ctx.globalAlpha = su * (open ? 1 : 0.45);
      ctx.fillStyle = done ? p.accent : open ? p.glow : p.ink;
      ctx.beginPath();
      for (let k = 0; k < 8; k++) {
        const ang = (k / 8) * TAU;
        const rr = k % 2 === 0 ? R : R * 0.45;
        const sx = Math.cos(ang) * rr;
        const sy = Math.sin(ang) * rr;
        k === 0 ? ctx.moveTo(sx, sy) : ctx.lineTo(sx, sy);
      }
      ctx.closePath();
      ctx.fill();
      ctx.restore();

      // current star ring
      if (isCurrent) {
        ctx.strokeStyle = withAlpha(p.glow, 0.6 * su);
        ctx.lineWidth = 1.4;
        ctx.beginPath();
        ctx.arc(
          pt.x,
          pt.y,
          Math.max(0.5, R * 2 + Math.sin(time * 1.6) * 2 * (game.reducedMotion ? 0 : 1)),
          0,
          TAU
        );
        ctx.stroke();
      }
    }
    ctx.restore();
  }
}
