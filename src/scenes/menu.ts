/* ---------------------------------------------------------------------------
   Main menu — the title breathing over a sky that slowly wanders through
   all five chapter palettes, with quiet geometry drifting behind it.
--------------------------------------------------------------------------- */

import type { Game, Scene } from '../core/game';
import type { View } from '../core/types';
import { CHAPTERS, withAlpha } from '../render/palette';
import { seeded, TAU } from '../render/ease';
import { t } from '../i18n/strings';
import { SelectScene } from './select';
import { LevelScene } from './level';

export class MenuScene implements Scene {
  private dom: HTMLElement | null = null;
  private game!: Game;
  private cycleIdx = 0;
  private cycleTimer = 12;
  private onLang = () => this.build();

  enter(game: Game): void {
    this.game = game;
    this.cycleIdx = 0;
    game.background.setChapter(CHAPTERS[this.cycleIdx], 2.5);
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
    const { ui, save } = this.game;
    if (this.dom) {
      this.dom.remove();
      this.dom = null;
    }
    const s = ui.screen('menu');

    const titleAr = ui.el('h1', 'title-ar fade-up', t('titleAr'));
    const titleEn = ui.el('p', 'title-en fade-up', t('titleEn'));
    const sub = ui.el('p', 'subtitle fade-up', t('subtitle'));
    titleEn.style.animationDelay = '0.25s';
    sub.style.animationDelay = '0.5s';

    const orn = ui.el('div', 'ornament fade-up');
    orn.appendChild(ui.el('span', 'gem'));
    orn.style.animationDelay = '0.65s';

    const buttons = ui.el('div', 'menu-buttons fade-up');
    buttons.style.animationDelay = '0.8s';
    const started = save.completedCount > 0;
    buttons.appendChild(
      ui.button(started ? t('continue') : t('begin'), () => {
        if (started) this.game.goto(new SelectScene());
        else this.game.goto(new LevelScene(0), { fade: 1.4 });
      }, true)
    );
    buttons.appendChild(ui.button(t('settings'), () => ui.toggleSettings()));
    const aboutBtn = ui.el('button', 'text-btn hit', t('about'));
    aboutBtn.addEventListener('click', () => {
      this.game.audio.tap();
      this.openCredits();
    });
    buttons.appendChild(aboutBtn);

    s.append(titleAr, titleEn, sub, orn, buttons);
    this.dom = s;
  }

  /** The about card: just the name, set like an inscription. */
  private openCredits(): void {
    const { ui } = this.game;
    const wrap = ui.el('div', 'panel-wrap hit');
    wrap.addEventListener('click', () => {
      wrap.classList.remove('visible');
      setTimeout(() => wrap.remove(), 500);
    });
    const panel = ui.el('div', 'panel credits');

    const ornTop = ui.el('div', 'ornament');
    ornTop.appendChild(ui.el('span', 'gem'));
    panel.appendChild(ornTop);
    panel.appendChild(ui.el('p', 'c-label', t('designedBy')));
    panel.appendChild(ui.el('p', 'c-name', t('creditsName')));
    panel.appendChild(ui.el('p', 'c-nick', t('creditsNick')));
    const ornBottom = ui.el('div', 'ornament');
    ornBottom.appendChild(ui.el('span', 'gem'));
    panel.appendChild(ornBottom);

    wrap.appendChild(panel);
    ui.root.appendChild(wrap);
    requestAnimationFrame(() => requestAnimationFrame(() => wrap.classList.add('visible')));
  }

  update(dt: number, _t: number, game: Game): void {
    this.cycleTimer -= dt;
    if (this.cycleTimer <= 0) {
      this.cycleTimer = 14;
      this.cycleIdx = (this.cycleIdx + 1) % CHAPTERS.length;
      game.background.setChapter(CHAPTERS[this.cycleIdx], 8);
    }
  }

  render(ctx: CanvasRenderingContext2D, view: View, time: number, game: Game): void {
    const p = game.palette;
    const drift = game.reducedMotion ? 0 : 1;
    ctx.save();
    ctx.translate(view.cx, view.cy);
    ctx.scale(view.s, view.s);

    // a large quiet mandala behind the title, barely there
    ctx.save();
    ctx.globalAlpha = 0.16;
    ctx.rotate(time * 0.02 * drift);
    ctx.strokeStyle = p.ink;
    for (const r of [430, 330, 240]) {
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.arc(0, 0, r, 0, TAU);
      ctx.stroke();
      for (let i = 0; i < 8; i++) {
        const a = (i / 8) * TAU + r * 0.01;
        ctx.beginPath();
        ctx.arc(Math.cos(a) * r, Math.sin(a) * r, 4, 0, TAU);
        ctx.stroke();
      }
    }
    ctx.restore();

    // drifting shapes: a triangle, rings and motes wandering slowly
    for (let i = 0; i < 7; i++) {
      const sx = seeded(i * 13 + 2) * 2 - 1;
      const sy = seeded(i * 13 + 5) * 2 - 1;
      const x = sx * 560 + Math.sin(time * 0.07 * drift + i * 2.4) * 26;
      const y = sy * 380 + Math.cos(time * 0.055 * drift + i * 1.7) * 22;
      const size = 14 + seeded(i * 13 + 8) * 26;
      ctx.save();
      ctx.translate(x, y);
      ctx.rotate(time * 0.05 * drift * (i % 2 === 0 ? 1 : -1) + i);
      ctx.globalAlpha = 0.14;
      if (i % 3 === 0) {
        ctx.strokeStyle = p.accent;
        ctx.lineWidth = 1.6;
        ctx.beginPath();
        ctx.moveTo(0, -size);
        ctx.lineTo(size * 0.87, size * 0.5);
        ctx.lineTo(-size * 0.87, size * 0.5);
        ctx.closePath();
        ctx.stroke();
      } else if (i % 3 === 1) {
        ctx.strokeStyle = p.ink;
        ctx.lineWidth = 1.4;
        ctx.beginPath();
        ctx.arc(0, 0, size, 0, TAU);
        ctx.stroke();
      } else {
        ctx.fillStyle = withAlpha(p.glow, 0.8);
        ctx.beginPath();
        ctx.arc(0, 0, size * 0.28, 0, TAU);
        ctx.fill();
      }
      ctx.restore();
    }
    ctx.restore();
  }
}
