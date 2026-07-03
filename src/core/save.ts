/* ---------------------------------------------------------------------------
   Local persistence: progress and settings, stored in localStorage.
--------------------------------------------------------------------------- */

import type { Lang } from '../i18n/strings';

export interface Settings {
  sound: boolean;
  reducedMotion: boolean;
  lang: Lang;
}

interface SaveData {
  completed: string[];
  settings: Settings;
  endingSeen: boolean;
}

const KEY = 'insijam.save.v1';

function defaults(): SaveData {
  const prefersReduced =
    typeof matchMedia !== 'undefined' &&
    matchMedia('(prefers-reduced-motion: reduce)').matches;
  const arabic =
    typeof navigator !== 'undefined' && /^ar\b/i.test(navigator.language ?? '');
  return {
    completed: [],
    settings: { sound: true, reducedMotion: prefersReduced, lang: arabic ? 'ar' : 'en' },
    endingSeen: false,
  };
}

export class Save {
  private data: SaveData;

  constructor() {
    this.data = defaults();
    try {
      const raw = localStorage.getItem(KEY);
      if (raw) {
        const parsed = JSON.parse(raw) as Partial<SaveData>;
        this.data = {
          ...this.data,
          ...parsed,
          settings: { ...this.data.settings, ...(parsed.settings ?? {}) },
          completed: Array.isArray(parsed.completed) ? parsed.completed : [],
        };
      }
    } catch {
      /* corrupted or unavailable storage — start fresh */
    }
  }

  private persist(): void {
    try {
      localStorage.setItem(KEY, JSON.stringify(this.data));
    } catch {
      /* storage may be unavailable (private mode); play on without saving */
    }
  }

  get settings(): Settings {
    return this.data.settings;
  }

  setSetting<K extends keyof Settings>(key: K, value: Settings[K]): void {
    this.data.settings[key] = value;
    this.persist();
  }

  isCompleted(levelId: string): boolean {
    return this.data.completed.includes(levelId);
  }

  complete(levelId: string): void {
    if (!this.data.completed.includes(levelId)) {
      this.data.completed.push(levelId);
      this.persist();
    }
  }

  get completedCount(): number {
    return this.data.completed.length;
  }

  get endingSeen(): boolean {
    return this.data.endingSeen;
  }

  markEndingSeen(): void {
    this.data.endingSeen = true;
    this.persist();
  }

  resetProgress(): void {
    this.data.completed = [];
    this.data.endingSeen = false;
    this.persist();
  }
}
