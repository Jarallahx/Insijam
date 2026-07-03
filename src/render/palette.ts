/* ---------------------------------------------------------------------------
   Chapter palettes and color math. Each chapter of the journey owns a small,
   harmonized set of colors; everything on screen derives from these.
--------------------------------------------------------------------------- */

export type ChapterId = 'dawn' | 'day' | 'dusk' | 'night' | 'unity';

export interface Palette {
  /** Sky gradient, top → bottom. */
  top: string;
  mid: string;
  bottom: string;
  /** Foreground / text color that reads on this sky. */
  ink: string;
  /** The chapter's warm highlight. */
  accent: string;
  /** Near-white glow tone for light effects. */
  glow: string;
  /** A soft mid-tone for secondary shapes. */
  soft: string;
  /** DOM panel background tone. */
  paper: string;
  /** True on dark palettes (night, unity). */
  dark: boolean;
}

export const PALETTES: Record<ChapterId, Palette> = {
  dawn: {
    top: '#fdf3e7',
    mid: '#f6c9c4',
    bottom: '#c9aed6',
    ink: '#6f5470',
    accent: '#e08e79',
    glow: '#fff6ec',
    soft: '#eebfb4',
    paper: '#fdf6ee',
    dark: false,
  },
  day: {
    top: '#eef9fc',
    mid: '#bfe3f2',
    bottom: '#8cc7e6',
    ink: '#3c6485',
    accent: '#f4b942',
    glow: '#fffdf4',
    soft: '#a9d6ec',
    paper: '#f4fafd',
    dark: false,
  },
  dusk: {
    top: '#f9cf9d',
    mid: '#ee8b6a',
    bottom: '#6d5a7f',
    ink: '#503d63',
    accent: '#ffd8a8',
    glow: '#ffe9cd',
    soft: '#e8a37e',
    paper: '#fbe8d3',
    dark: false,
  },
  night: {
    top: '#2b3059',
    mid: '#1c2145',
    bottom: '#0d1028',
    ink: '#dfe4ff',
    accent: '#9fb0ff',
    glow: '#e6ecff',
    soft: '#3a4070',
    paper: '#262b52',
    dark: true,
  },
  unity: {
    top: '#2a3d5c',
    mid: '#6d597a',
    bottom: '#b56576',
    ink: '#f6e7d7',
    accent: '#eaac8b',
    glow: '#ffe3cc',
    soft: '#8a6f8e',
    paper: '#4c4067',
    dark: true,
  },
};

export const CHAPTERS: ChapterId[] = ['dawn', 'day', 'dusk', 'night', 'unity'];

/* ---- color math ----------------------------------------------------------- */

export type RGB = [number, number, number];

/** Parses '#rrggbb' or 'rgb(...)'/'rgba(...)' (palette colors become rgb()
    strings mid-transition, so every consumer must accept both). */
export function hexToRgb(color: string): RGB {
  if (color.startsWith('#')) {
    const h = color.slice(1);
    return [
      parseInt(h.slice(0, 2), 16),
      parseInt(h.slice(2, 4), 16),
      parseInt(h.slice(4, 6), 16),
    ];
  }
  const m = color.match(/rgba?\(\s*([\d.]+)\s*,\s*([\d.]+)\s*,\s*([\d.]+)/);
  if (m) return [Number(m[1]), Number(m[2]), Number(m[3])];
  return [255, 255, 255];
}

export function rgbToCss(rgb: RGB, alpha = 1): string {
  const [r, g, b] = rgb.map(Math.round);
  return alpha >= 1 ? `rgb(${r},${g},${b})` : `rgba(${r},${g},${b},${alpha})`;
}

export function mixHex(a: string, b: string, t: number): string {
  const ca = hexToRgb(a);
  const cb = hexToRgb(b);
  return rgbToCss([
    ca[0] + (cb[0] - ca[0]) * t,
    ca[1] + (cb[1] - ca[1]) * t,
    ca[2] + (cb[2] - ca[2]) * t,
  ]);
}

/** Hex/rgb color with alpha applied. Accepts '#rrggbb' only. */
export function withAlpha(hex: string, alpha: number): string {
  return rgbToCss(hexToRgb(hex), alpha);
}

/** Lerp two palettes field-by-field (used during chapter transitions). */
export function mixPalette(a: Palette, b: Palette, t: number): Palette {
  if (t <= 0) return a;
  if (t >= 1) return b;
  return {
    top: mixHex(a.top, b.top, t),
    mid: mixHex(a.mid, b.mid, t),
    bottom: mixHex(a.bottom, b.bottom, t),
    ink: mixHex(a.ink, b.ink, t),
    accent: mixHex(a.accent, b.accent, t),
    glow: mixHex(a.glow, b.glow, t),
    soft: mixHex(a.soft, b.soft, t),
    paper: mixHex(a.paper, b.paper, t),
    dark: t < 0.5 ? a.dark : b.dark,
  };
}

/* ---- puzzle primaries (used by Dusk blending and Unity colored light) ------ */

export type PrimC = 'r' | 'y' | 'b';

/** Additive light colors for the three primaries. */
export const PRIM_RGB: Record<PrimC, RGB> = {
  r: [255, 92, 100],
  y: [255, 196, 72],
  b: [96, 132, 255],
};

/** Additive mix of a set of primaries (screen-like, clamped). */
export function mixPrims(set: Iterable<PrimC>): RGB {
  let r = 0;
  let g = 0;
  let b = 0;
  for (const c of set) {
    const [cr, cg, cb] = PRIM_RGB[c];
    // screen blend keeps mixes luminous without blowing out to pure white
    r = 255 - ((255 - r) * (255 - cr)) / 255;
    g = 255 - ((255 - g) * (255 - cg)) / 255;
    b = 255 - ((255 - b) * (255 - cb)) / 255;
  }
  return [r, g, b];
}

export function sameColorSet(a: PrimC[], b: PrimC[]): boolean {
  if (a.length !== b.length) return false;
  const sa = new Set(a);
  for (const c of b) if (!sa.has(c)) return false;
  return true;
}
