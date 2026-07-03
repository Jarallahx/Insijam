/* ---------------------------------------------------------------------------
   The DOM layer. The canvas draws the world; this class draws the words —
   titles, buttons, settings — and keeps their colors in step with the sky.
--------------------------------------------------------------------------- */

import type { Game } from '../core/game';
import type { Palette } from '../render/palette';
import { getLang, setLang, t, type Lang } from '../i18n/strings';

type IconName = 'back' | 'gear' | 'soundOn' | 'soundOff' | 'replay' | 'close' | 'lamp';

const ICONS: Record<IconName, string> = {
  back: '<svg viewBox="0 0 24 24"><path d="M14.5 5.5 L8 12 L14.5 18.5"/></svg>',
  gear:
    '<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="3.4"/>' +
    '<path d="M12 3.2v2.6M12 18.2v2.6M3.2 12h2.6M18.2 12h2.6M5.8 5.8l1.9 1.9M16.3 16.3l1.9 1.9M18.2 5.8l-1.9 1.9M7.7 16.3l-1.9 1.9"/></svg>',
  soundOn:
    '<svg viewBox="0 0 24 24"><path d="M4.5 9.5v5h3.4l4.6 3.8V5.7L7.9 9.5z"/>' +
    '<path d="M16 9.2a4.2 4.2 0 0 1 0 5.6M18.4 6.8a7.6 7.6 0 0 1 0 10.4"/></svg>',
  soundOff:
    '<svg viewBox="0 0 24 24"><path d="M4.5 9.5v5h3.4l4.6 3.8V5.7L7.9 9.5z"/>' +
    '<path d="M16.4 9.6l4.8 4.8M21.2 9.6l-4.8 4.8"/></svg>',
  replay:
    '<svg viewBox="0 0 24 24"><path d="M5.5 12a6.5 6.5 0 1 1 1.9 4.6"/>' +
    '<path d="M5.2 12.6 5.5 9l3.3 1.7"/></svg>',
  close: '<svg viewBox="0 0 24 24"><path d="M6.5 6.5l11 11M17.5 6.5l-11 11"/></svg>',
  lamp:
    '<svg viewBox="0 0 24 24"><path d="M12 4.2 L14 10 L19.8 12 L14 14 L12 19.8 L10 14 L4.2 12 L10 10 Z"/>' +
    '<circle cx="12" cy="12" r="1.4"/></svg>',
};

export class UI {
  readonly root: HTMLElement;
  private settingsWrap: HTMLElement | null = null;
  private fsListener: (() => void) | null = null;
  /** Scenes register here to rebuild their DOM when the language flips. */
  readonly langListeners = new Set<() => void>();
  /** Assigned by main: what to do after "begin anew". */
  onReset: (() => void) | null = null;

  constructor(private game: Game) {
    this.root = document.getElementById('ui')!;
    setLang(game.save.settings.lang);
  }

  /* ---- theming -------------------------------------------------------------- */

  private lastInk = '';
  theme(p: Palette): void {
    if (p.ink === this.lastInk) return;
    this.lastInk = p.ink;
    this.root.style.setProperty('--ink', p.ink);
    this.root.style.setProperty('--paper', p.paper);
  }

  /* ---- element helpers ------------------------------------------------------ */

  el<K extends keyof HTMLElementTagNameMap>(
    tag: K,
    cls = '',
    text = ''
  ): HTMLElementTagNameMap[K] {
    const e = document.createElement(tag);
    if (cls) e.className = cls;
    if (text) e.textContent = text;
    return e;
  }

  screen(cls = ''): HTMLElement {
    const s = this.el('div', `screen ${cls}`.trim());
    this.root.appendChild(s);
    // double-rAF so the fade-in transition actually runs
    requestAnimationFrame(() => requestAnimationFrame(() => s.classList.add('visible')));
    return s;
  }

  /** Fade a screen out, then remove it. */
  dismiss(el: HTMLElement | null, delay = 0): void {
    if (!el) return;
    setTimeout(() => {
      el.classList.remove('visible');
      setTimeout(() => el.remove(), 750);
    }, delay);
  }

  button(label: string, onClick: () => void, primary = false): HTMLButtonElement {
    const b = this.el('button', `btn hit${primary ? ' primary' : ''}`, label);
    b.addEventListener('click', () => {
      this.game.audio.unlock();
      this.game.audio.tap();
      onClick();
    });
    return b;
  }

  iconButton(icon: IconName, onClick: () => void, title = ''): HTMLButtonElement {
    const b = this.el('button', 'icon-btn hit');
    b.innerHTML = ICONS[icon];
    if (title) b.title = title;
    b.addEventListener('click', () => {
      this.game.audio.unlock();
      this.game.audio.tap();
      onClick();
    });
    return b;
  }

  setIcon(b: HTMLButtonElement, icon: IconName): void {
    b.innerHTML = ICONS[icon];
  }

  /* ---- settings panel --------------------------------------------------------- */

  toggleSettings(): void {
    if (this.settingsWrap) this.closeSettings();
    else this.openSettings();
  }

  closeSettings(): void {
    const w = this.settingsWrap;
    if (!w) return;
    this.settingsWrap = null;
    if (this.fsListener) {
      document.removeEventListener('fullscreenchange', this.fsListener);
      this.fsListener = null;
    }
    w.classList.remove('visible');
    setTimeout(() => w.remove(), 500);
  }

  openSettings(): void {
    const game = this.game;
    const wrap = this.el('div', 'panel-wrap hit');
    wrap.addEventListener('click', (e) => {
      if (e.target === wrap) this.closeSettings();
    });
    const panel = this.el('div', 'panel');
    wrap.appendChild(panel);

    const build = () => {
      panel.innerHTML = '';
      panel.appendChild(this.el('h2', '', t('settings')));

      const seg = (
        options: [string, () => boolean, () => void][]
      ): HTMLElement => {
        const s = this.el('div', 'seg');
        const buttons: HTMLButtonElement[] = [];
        for (const [label, , apply] of options) {
          const b = this.el('button', '', label);
          b.addEventListener('click', () => {
            game.audio.unlock();
            game.audio.tap();
            apply();
            buttons.forEach((bb, i) => bb.classList.toggle('on', options[i][1]()));
          });
          buttons.push(b);
          s.appendChild(b);
        }
        buttons.forEach((bb, i) => bb.classList.toggle('on', options[i][1]()));
        return s;
      };

      const row = (label: string, control: HTMLElement) => {
        const r = this.el('div', 'setting-row');
        r.appendChild(this.el('span', 'label', label));
        r.appendChild(control);
        panel.appendChild(r);
      };

      row(
        t('sound'),
        seg([
          [t('on'), () => game.save.settings.sound, () => setSound(true)],
          [t('off'), () => !game.save.settings.sound, () => setSound(false)],
        ])
      );
      row(
        t('motion'),
        seg([
          [t('full'), () => !game.save.settings.reducedMotion, () => setMotion(false)],
          [t('reduced'), () => game.save.settings.reducedMotion, () => setMotion(true)],
        ])
      );
      row(
        t('language'),
        seg([
          ['English', () => getLang() === 'en', () => setLanguage('en')],
          ['العربية', () => getLang() === 'ar', () => setLanguage('ar')],
        ])
      );
      row(
        t('display'),
        seg([
          [
            t('windowed'),
            () => !document.fullscreenElement,
            () => {
              if (document.fullscreenElement) void document.exitFullscreen();
            },
          ],
          [
            t('fullscreen'),
            () => !!document.fullscreenElement,
            () => {
              if (!document.fullscreenElement) {
                void document.documentElement.requestFullscreen().catch(() => {});
              }
            },
          ],
        ])
      );

      const footer = this.el('div', 'footer-row');
      const reset = this.el('button', 'text-btn', t('resetJourney'));
      let arming = false;
      reset.addEventListener('click', () => {
        game.audio.tap();
        if (!arming) {
          arming = true;
          reset.textContent = `${t('resetConfirm')} — ${t('yes')}`;
          setTimeout(() => {
            if (arming) {
              arming = false;
              reset.textContent = t('resetJourney');
            }
          }, 3500);
        } else {
          game.save.resetProgress();
          this.closeSettings();
          this.onReset?.();
        }
      });
      footer.appendChild(reset);
      panel.appendChild(footer);
    };

    const setSound = (on: boolean) => {
      game.save.setSetting('sound', on);
      game.applySettings();
    };
    const setMotion = (reduced: boolean) => {
      game.save.setSetting('reducedMotion', reduced);
      game.applySettings();
    };
    const setLanguage = (lang: Lang) => {
      game.save.setSetting('lang', lang);
      setLang(lang);
      build();
      for (const fn of this.langListeners) fn();
    };

    build();
    // fullscreen can change from outside (F11, Esc) — keep the row honest
    this.fsListener = () => {
      if (this.settingsWrap === wrap) build();
    };
    document.addEventListener('fullscreenchange', this.fsListener);
    this.root.appendChild(wrap);
    requestAnimationFrame(() => requestAnimationFrame(() => wrap.classList.add('visible')));
    this.settingsWrap = wrap;
  }
}
