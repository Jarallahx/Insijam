/* ---------------------------------------------------------------------------
   Shared geometry types. Puzzles draw in a "virtual" coordinate space
   centered on screen: 1000 virtual units span the smaller screen dimension.
--------------------------------------------------------------------------- */

export interface View {
  /** Canvas size in CSS pixels. */
  w: number;
  h: number;
  /** Center of the screen in CSS pixels. */
  cx: number;
  cy: number;
  /** Scale: pixels per virtual unit (min(w,h)/1000). */
  s: number;
}

export interface Vec {
  x: number;
  y: number;
}

export function toVirtual(view: View, px: number, py: number): Vec {
  return { x: (px - view.cx) / view.s, y: (py - view.cy) / view.s };
}
