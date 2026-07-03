/* ---------------------------------------------------------------------------
   Easing curves and small math helpers. Every animation in the game goes
   through one of these — consistent motion is half of "calm".
--------------------------------------------------------------------------- */

export const clamp = (v: number, lo: number, hi: number): number =>
  v < lo ? lo : v > hi ? hi : v;

export const clamp01 = (v: number): number => clamp(v, 0, 1);

export const lerp = (a: number, b: number, t: number): number => a + (b - a) * t;

export const TAU = Math.PI * 2;

/** Shortest signed angular difference a→b, in (-PI, PI]. */
export function angleDiff(a: number, b: number): number {
  let d = (b - a) % TAU;
  if (d > Math.PI) d -= TAU;
  if (d <= -Math.PI) d += TAU;
  return d;
}

export function mod(n: number, m: number): number {
  return ((n % m) + m) % m;
}

export const easeInOut = (t: number): number =>
  t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;

export const cubicOut = (t: number): number => 1 - Math.pow(1 - t, 3);

export const cubicInOut = (t: number): number =>
  t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;

export const quartOut = (t: number): number => 1 - Math.pow(1 - t, 4);

export const quintOut = (t: number): number => 1 - Math.pow(1 - t, 5);

/** Gentle overshoot — used for snaps and blooms. */
export function backOut(t: number, s = 1.35): number {
  const c = s + 1;
  return 1 + c * Math.pow(t - 1, 3) + s * Math.pow(t - 1, 2);
}

/** Soft, low-amplitude elastic settle. */
export function settle(t: number): number {
  if (t <= 0) return 0;
  if (t >= 1) return 1;
  return 1 - Math.cos(t * Math.PI * 2.2) * Math.exp(-4.6 * t);
}

export const smoothstep = (t: number): number => {
  const x = clamp01(t);
  return x * x * (3 - 2 * x);
};

/** 0→1→0 bump, smooth at both ends. */
export const bump = (t: number): number => {
  const x = clamp01(t);
  return Math.sin(x * Math.PI);
};

/** Deterministic pseudo-random in [0,1) from an integer seed. */
export function seeded(seed: number): number {
  const x = Math.sin(seed * 127.1 + 311.7) * 43758.5453;
  return x - Math.floor(x);
}

export const dist = (x1: number, y1: number, x2: number, y2: number): number =>
  Math.hypot(x2 - x1, y2 - y1);
