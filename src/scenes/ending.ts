/* ---------------------------------------------------------------------------
   The ending — a slow procession through all four skies while the game's
   motifs (rings, light, color, stars) gather into one final mandala.
   Tap to move through the beats; tap at the end to return home.
--------------------------------------------------------------------------- */

import type { Game, Scene } from '../core/game';
import type { View, Vec } from '../core/types';
import { CHAPTERS, mixPrims, rgbToCss, withAlpha } from '../render/palette';
import { clamp01, smoothstep, TAU } from '../render/ease';
import { t } from '../i18n/strings';
import { MenuScene } from './menu';

const BEATS = [5, 11, 17, 23, 29]; // seconds: day, dusk, night, unity, title

export class EndingScene implements Scene {
  private game!: Game;
  private tl = 0;
  private beat = 0;
  private dom: HTMLElement | null = null;
  private lines: HTMLElement[] = [];
  private title: HTMLElement | null = null;
  private chordPlayed = false;
  private leaving = false;
  private onLang = () => this.build();

  enter(game: Game): void {
    this.game = game;
    game.save.markEndingSeen();
    game.background.setChapter('dawn', 3);
    game.audio.setChapter('dawn');
    this.build();
    game.ui.langListeners.add(this.onLang);
  }

  exit(game: Game): void {
    game.ui.langListeners.delete(this.onLang);
    game.ui.dismiss(this.dom);
    this.dom = null;
  }

  private build(): void {
    const { ui } = this.game;
    if (this.dom) {
      this.dom.remove();
      this.dom = null;
    }
    const s = ui.screen('ending');
    this.lines = [
      ui.el('div', 'ending-line', t('ending1')),
      ui.el('div', 'ending-line', t('ending2')),
      ui.el('div', 'ending-line', t('ending3')),
    ];
    this.title = ui.el('div', 'chapter-card');
    this.title.appendChild(ui.el('p', 'cname', t('endingTitle')));
    this.title.appendChild(ui.el('p', 'numeral', t('subtitle')));
    s.append(...this.lines, this.title);
    this.dom = s;
  }

  down(_p: Vec, game: Game): void {
    if (this.tl >= BEATS[4] + 1.5) {
      if (!this.leaving) {
        this.leaving = true;
        game.goto(new MenuScene(), { fade: 1.6 });
      }
      return;
    }
    // gently step forward
    for (const b of BEATS) {
      if (this.tl < b - 0.2) {
        this.tl = b - 0.2;
        break;
      }
    }
  }

  update(dt: number, _t: number, game: Game): void {
    this.tl += dt * (game.reducedMotion ? 1.4 : 1);

    // beat transitions: sky and ambient move together
    const chapterAt = [1, 2, 3, 4]; // day, dusk, night, unity
    for (let b = 0; b < 4; b++) {
      if (this.beat === b && this.tl >= BEATS[b]) {
        this.beat = b + 1;
        const ch = CHAPTERS[chapterAt[b]];
        game.background.setChapter(ch, 4);
        game.audio.setChapter(ch);
      }
    }

    const vis = (el: HTMLElement, a: number, b: number) =>
      el.classList.toggle('visible', this.tl > a && this.tl < b);
    if (this.lines.length === 3) {
      vis(this.lines[0], 4.5, 10.5);
      vis(this.lines[1], 12, 17.5);
      vis(this.lines[2], 23.5, 28.5);
    }
    if (this.title) this.title.classList.toggle('visible', this.tl > BEATS[4] + 0.8);

    if (!this.chordPlayed && this.tl > BEATS[4]) {
      this.chordPlayed = true;
      game.audio.grandChord();
      game.particles.burst(0, 0, {
        count: 30,
        colors: ['#ffffff', '#ffd9c0', '#9fb0ff'],
        shape: 'spark',
        speed: 200,
        size: 4,
        life: 3,
        gravity: -6,
      });
    }
  }

  render(ctx: CanvasRenderingContext2D, view: View, time: number, game: Game): void {
    const p = game.palette;
    const tl = this.tl;
    const seg = (a: number, b: number) => smoothstep(clamp01((tl - a) / (b - a)));
    const drift = game.reducedMotion ? 0 : 1;

    ctx.save();
    ctx.translate(view.cx, view.cy);
    ctx.scale(view.s, view.s);

    // I. the rings assemble (0 → 8s), spinning slower and slower into place
    const ringsIn = seg(0.5, 4);
    if (ringsIn > 0) {
      const settle = seg(3, 8.5);
      for (let i = 0; i < 3; i++) {
        const r = 120 + i * 75;
        const spin = (1 - settle) * (i % 2 === 0 ? 1 : -1) * tl * 0.5 * drift;
        ctx.save();
        ctx.rotate(spin);
        ctx.globalAlpha = ringsIn * 0.85;
        ctx.strokeStyle = withAlpha(p.ink, 0.5);
        ctx.lineWidth = 1.6;
        ctx.beginPath();
        ctx.arc(0, 0, r, 0, TAU);
        ctx.stroke();
        // petals
        for (let k = 0; k < 6 + i * 2; k++) {
          const a = (k / (6 + i * 2)) * TAU;
          ctx.fillStyle = withAlpha(p.accent, 0.5 * ringsIn);
          ctx.beginPath();
          ctx.ellipse(Math.cos(a) * r, Math.sin(a) * r, 16, 7, a, 0, TAU);
          ctx.fill();
        }
        ctx.restore();
      }
    }

    // II. light: beams reach outward (6 → 12s)
    const beamsIn = seg(6, 9);
    if (beamsIn > 0) {
      ctx.save();
      ctx.globalAlpha = Math.min(beamsIn, 0.9);
      for (let k = 0; k < 6; k++) {
        const a = (k / 6) * TAU + Math.PI / 6;
        const len = 130 + beamsIn * 330;
        const g = ctx.createLinearGradient(0, 0, Math.cos(a) * len, Math.sin(a) * len);
        g.addColorStop(0, withAlpha(p.glow, 0.9));
        g.addColorStop(1, withAlpha(p.glow, 0));
        ctx.strokeStyle = g;
        ctx.lineWidth = 3;
        ctx.lineCap = 'round';
        ctx.beginPath();
        ctx.moveTo(Math.cos(a) * 40, Math.sin(a) * 40);
        ctx.lineTo(Math.cos(a) * len, Math.sin(a) * len);
        ctx.stroke();
      }
      ctx.restore();
    }

    // III. color: three orbs spiral inward and meet (11 → 17s)
    const orbsIn = seg(11, 16);
    if (orbsIn > 0) {
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      const prims = ['r', 'y', 'b'] as const;
      prims.forEach((c, i) => {
        const a0 = (i / 3) * TAU - Math.PI / 2 + (1 - orbsIn) * 2.2 * drift;
        const rad = 90 + (1 - orbsIn) * 420;
        const x = Math.cos(a0) * rad;
        const y = Math.sin(a0) * rad;
        const col = mixPrims([c]);
        const g = ctx.createRadialGradient(x, y, 0, x, y, 120);
        g.addColorStop(0, rgbToCss(col, 0.5 * orbsIn));
        g.addColorStop(1, rgbToCss(col, 0));
        ctx.fillStyle = g;
        ctx.beginPath();
        ctx.arc(x, y, 120, 0, TAU);
        ctx.fill();
      });
      ctx.restore();
    }

    // IV. stars: a zodiac of twelve closes the circle (17 → 23s)
    const starsIn = seg(17, 21);
    if (starsIn > 0) {
      const R = 360;
      ctx.save();
      ctx.rotate(time * 0.03 * drift);
      for (let k = 0; k < 12; k++) {
        const u = clamp01(starsIn * 14 - k);
        if (u <= 0) continue;
        const a = (k / 12) * TAU - Math.PI / 2;
        const x = Math.cos(a) * R;
        const y = Math.sin(a) * R;
        ctx.globalAlpha = u * 0.9;
        ctx.fillStyle = p.glow;
        ctx.beginPath();
        ctx.arc(x, y, 5, 0, TAU);
        ctx.fill();
        // thread to the next star
        if (k > 0 && u > 0.6) {
          const pa = ((k - 1) / 12) * TAU - Math.PI / 2;
          ctx.strokeStyle = withAlpha(p.accent, 0.5 * u);
          ctx.lineWidth = 1.4;
          ctx.beginPath();
          ctx.moveTo(Math.cos(pa) * R, Math.sin(pa) * R);
          ctx.lineTo(x, y);
          ctx.stroke();
        }
      }
      // the closing thread
      if (starsIn >= 1) {
        ctx.globalAlpha = seg(21, 22.5);
        ctx.strokeStyle = withAlpha(p.accent, 0.5);
        ctx.beginPath();
        ctx.moveTo(Math.cos(((11 / 12) * TAU) - Math.PI / 2) * R, Math.sin(((11 / 12) * TAU) - Math.PI / 2) * R);
        ctx.lineTo(Math.cos(-Math.PI / 2) * R, Math.sin(-Math.PI / 2) * R);
        ctx.stroke();
      }
      ctx.restore();
    }

    // V. the whole breathes as one (23s →)
    const oneIn = seg(23, 27);
    if (oneIn > 0) {
      const pulse = 1 + Math.sin(time * 0.8) * 0.03 * drift;
      const g = ctx.createRadialGradient(0, 0, 0, 0, 0, 480 * pulse);
      g.addColorStop(0, withAlpha(p.glow, 0.28 * oneIn));
      g.addColorStop(0.5, withAlpha(p.glow, 0.1 * oneIn));
      g.addColorStop(1, withAlpha(p.glow, 0));
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.arc(0, 0, 480 * pulse, 0, TAU);
      ctx.fill();
    }

    // heart of the mandala
    const heart = seg(1, 3);
    if (heart > 0) {
      const white = seg(14.5, 16.5); // when the colors meet, the heart turns to light
      ctx.globalAlpha = heart;
      const g = ctx.createRadialGradient(0, 0, 0, 0, 0, 60);
      g.addColorStop(0, withAlpha('#ffffff', 0.35 + white * 0.6));
      g.addColorStop(1, withAlpha(p.glow, 0.12));
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.arc(0, 0, 60, 0, TAU);
      ctx.fill();
    }

    ctx.restore();
  }
}
