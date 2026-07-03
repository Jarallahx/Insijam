/* ---------------------------------------------------------------------------
   Level scene — hosts a puzzle, frames it with its caption and hint,
   shows the chapter title card at chapter boundaries, celebrates the
   solve, and flows onward to the next level (or the ending).
--------------------------------------------------------------------------- */

import type { Game, Scene } from '../core/game';
import type { Vec, View } from '../core/types';
import { LEVELS } from '../levels/data';
import { CHAPTERS, type ChapterId } from '../render/palette';
import { getLang, ROMAN, t, type StringKey } from '../i18n/strings';
import type { Puzzle, PuzzleHost } from '../puzzles/base';
import type { PuzzleDef } from '../puzzles/defs';
import { RingsPuzzle } from '../puzzles/rings';
import { LightPuzzle } from '../puzzles/light';
import { BlendPuzzle } from '../puzzles/blend';
import { EchoPuzzle } from '../puzzles/echo';
import { LockPuzzle } from '../puzzles/lock';
import { FinalePuzzle } from '../puzzles/finale';
import { SelectScene } from './select';
import { EndingScene } from './ending';

const CH_NAME: Record<ChapterId, StringKey> = {
  dawn: 'chDawn',
  day: 'chDay',
  dusk: 'chDusk',
  night: 'chNight',
  unity: 'chUnity',
};

const SKIP_AFTER = 170; // seconds of gentle struggle before "let it pass"
const CARD_TIME = 2.6;

function createPuzzle(def: PuzzleDef, host: PuzzleHost): Puzzle {
  switch (def.kind) {
    case 'rings':
      return new RingsPuzzle(host, def);
    case 'light':
      return new LightPuzzle(host, def);
    case 'blend':
      return new BlendPuzzle(host, def);
    case 'echo':
      return new EchoPuzzle(host, def);
    case 'lock':
      return new LockPuzzle(host, def);
    case 'finale':
      return new FinalePuzzle(host);
  }
}

export class LevelScene implements Scene {
  private game!: Game;
  private puzzle!: Puzzle;
  private dom: HTMLElement | null = null;
  private hintEl: HTMLElement | null = null;
  private skipEl: HTMLElement | null = null;
  private replayEl: HTMLButtonElement | null = null;
  private cardEl: HTMLElement | null = null;
  private nudgeEl: HTMLElement | null = null;
  private nudgeTier = 0; // 0 = closed, 1 = first nudge shown, 2 = second

  private cardT: number;
  private playT = 0;
  private hintT = 0;
  private advanceT = -1;
  private advanced = false;
  private hintDismissed = false;
  private onLang = () => this.build();

  constructor(private index: number) {
    const def = LEVELS[index];
    const firstOfChapter = index === 0 || LEVELS[index - 1].chapter !== def.chapter;
    this.cardT = firstOfChapter ? CARD_TIME : 0;
  }

  enter(game: Game): void {
    this.game = game;
    const def = LEVELS[this.index];
    // suppress the chapter card on revisits
    if (this.cardT > 0 && game.save.isCompleted(def.id)) this.cardT = 0;

    game.background.setChapter(def.chapter, this.cardT > 0 ? 2.6 : 1.8);
    game.audio.setChapter(def.chapter);

    const host: PuzzleHost = {
      audio: game.audio,
      particles: game.particles,
      palette: () => game.palette,
      reducedMotion: () => game.reducedMotion,
      solvedNotify: () => this.onSolved(),
    };
    this.puzzle = createPuzzle(def.puzzle, host);
    this.build();
  }

  exit(game: Game): void {
    game.ui.langListeners.delete(this.onLang);
    game.ui.dismiss(this.dom);
    this.dom = null;
    game.canvas.style.cursor = 'default';
  }

  private build(): void {
    const { ui } = this.game;
    ui.langListeners.delete(this.onLang);
    ui.langListeners.add(this.onLang);
    if (this.dom) {
      this.dom.remove();
      this.dom = null;
    }
    const def = LEVELS[this.index];
    const s = ui.screen('level');

    const tl = ui.el('div', 'corner tl hit');
    tl.appendChild(ui.iconButton('back', () => this.game.goto(new SelectScene())));
    const tr = ui.el('div', 'corner tr hit');
    this.replayEl = ui.iconButton('replay', () => this.puzzle.replay(), t('listenAgain'));
    this.replayEl.style.display = 'none';
    tr.appendChild(this.replayEl);
    tr.appendChild(ui.iconButton('lamp', () => this.toggleNudge(), t('nudge')));
    tr.appendChild(ui.iconButton('gear', () => ui.toggleSettings()));

    // the nudge card — calm, two gentle tiers, never the full answer.
    // no 'hit' class here: only .visible turns pointer-events on, otherwise
    // the invisible card would swallow clicks meant for what's beneath it.
    this.nudgeEl = ui.el('div', 'nudge-card');
    const nudgeText = ui.el('p', 'nudge-text');
    const more = ui.el('div', 'nudge-more');
    const moreBtn = ui.el('button', 'text-btn', t('anotherNudge'));
    moreBtn.addEventListener('click', () => {
      this.game.audio.tap();
      this.nudgeTier = 2;
      nudgeText.textContent = this.nudgeText(2);
      more.style.display = 'none';
    });
    more.appendChild(moreBtn);
    this.nudgeEl.append(nudgeText, more);
    this.showNudgeTier = (tier: number) => {
      nudgeText.textContent = this.nudgeText(tier);
      more.style.display = tier === 1 ? '' : 'none';
    };

    const caption = ui.el('div', 'level-caption');
    const chapterIdx = CHAPTERS.indexOf(def.chapter);
    caption.appendChild(
      ui.el('p', 'kicker', `${t(CH_NAME[def.chapter])} · ${ROMAN[chapterIdx]}`)
    );
    caption.appendChild(ui.el('p', 'name', t(def.name)));

    this.hintEl = null;
    if (def.hint && !this.game.save.isCompleted(def.id)) {
      this.hintEl = ui.el('div', 'hint-line', t(def.hint));
    }

    this.skipEl = ui.el('div', 'soft-action');
    this.skipEl.appendChild(
      ui.button(t('skip'), () => {
        if (!this.advanced) {
          this.game.save.complete(def.id);
          this.advance();
        }
      })
    );

    this.cardEl = null;
    if (this.cardT > 0) {
      this.cardEl = ui.el('div', 'chapter-card');
      this.cardEl.appendChild(ui.el('p', 'numeral', ROMAN[chapterIdx]));
      this.cardEl.appendChild(ui.el('p', 'cname', t(CH_NAME[def.chapter])));
      const orn = ui.el('div', 'ornament');
      orn.appendChild(ui.el('span', 'gem'));
      this.cardEl.appendChild(orn);
      requestAnimationFrame(() =>
        requestAnimationFrame(() => this.cardEl?.classList.add('visible'))
      );
    }

    s.append(tl, tr, caption);
    if (this.hintEl) s.appendChild(this.hintEl);
    s.appendChild(this.skipEl);
    s.appendChild(this.nudgeEl);
    if (this.cardEl) s.appendChild(this.cardEl);
    this.dom = s;
    // restore an open nudge across language rebuilds
    if (this.nudgeTier > 0) {
      this.showNudgeTier(this.nudgeTier);
      this.nudgeEl.classList.add('visible');
    }
  }

  private showNudgeTier: (tier: number) => void = () => {};

  private nudgeText(tier: number): string {
    const def = LEVELS[this.index];
    const lang = getLang();
    return tier >= 2 ? def.nudge2[lang] : def.nudge1[lang];
  }

  private toggleNudge(): void {
    if (!this.nudgeEl) return;
    if (this.nudgeTier === 0) {
      this.nudgeTier = 1;
      this.showNudgeTier(1);
      this.nudgeEl.classList.add('visible');
    } else {
      this.nudgeTier = 0;
      this.nudgeEl.classList.remove('visible');
    }
  }

  private get playing(): boolean {
    return this.cardT <= 0;
  }

  private onSolved(): void {
    this.game.save.complete(LEVELS[this.index].id);
    this.advanceT = this.puzzle.celebrationSeconds;
    this.hintEl?.classList.remove('visible');
    this.skipEl?.classList.remove('visible');
    this.nudgeTier = 0;
    this.nudgeEl?.classList.remove('visible');
    this.game.canvas.style.cursor = 'default';
  }

  private advance(): void {
    if (this.advanced) return;
    this.advanced = true;
    if (this.index + 1 < LEVELS.length) {
      this.game.goto(new LevelScene(this.index + 1), { fade: 1.5 });
    } else {
      this.game.goto(new EndingScene(), { fade: 2.2 });
    }
  }

  update(dt: number, time: number, _game: Game): void {
    if (this.cardT > 0) {
      this.cardT -= dt;
      if (this.cardT <= CARD_TIME - 1.9 && this.cardEl?.classList.contains('visible')) {
        this.cardEl.classList.remove('visible');
      }
      if (this.cardT > CARD_TIME - 2.2) return; // hold the puzzle until the card breathes
    }
    this.playT += dt;
    this.puzzle.update(dt, time);

    // hint appears after a moment, then bows out
    if (this.hintEl && !this.hintDismissed) {
      this.hintT += dt;
      if (this.hintT > 1.6) this.hintEl.classList.add('visible');
      if (this.hintT > 12) this.dismissHint();
    }

    // replay affordance for the echo puzzles
    if (this.replayEl) {
      const want = this.puzzle.wantsReplayButton && !this.puzzle.solved;
      const shown = this.replayEl.style.display !== 'none';
      if (want !== shown) this.replayEl.style.display = want ? '' : 'none';
    }

    // the gentle way out
    if (!this.puzzle.solved && this.playT > SKIP_AFTER && this.skipEl) {
      this.skipEl.classList.add('visible');
    }

    if (this.advanceT > 0) {
      this.advanceT -= dt;
      if (this.advanceT <= 0) this.advance();
    }
  }

  private dismissHint(): void {
    this.hintDismissed = true;
    this.hintEl?.classList.remove('visible');
  }

  down(p: Vec): void {
    if (!this.playing) return;
    if (this.hintT > 2.5) this.dismissHint();
    this.puzzle.down(p);
  }

  move(p: Vec): void {
    if (!this.playing) return;
    this.puzzle.move(p);
    this.game.canvas.style.cursor = this.puzzle.hoverable(p) ? 'pointer' : 'default';
  }

  up(p: Vec): void {
    if (this.playing) this.puzzle.up(p);
  }

  render(ctx: CanvasRenderingContext2D, view: View, time: number, _game: Game): void {
    this.puzzle.render(ctx, view, time);
  }
}
