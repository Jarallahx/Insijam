/* ---------------------------------------------------------------------------
   Level definition types — the data language the whole game is written in.
--------------------------------------------------------------------------- */

import type { ChapterId, PrimC } from '../render/palette';
import type { StringKey } from '../i18n/strings';

/* Dawn — rotating rings. Threads must run unbroken from core to rim. */
export interface RingSpec {
  /** Decorative petal slots (local frame). */
  petals: number[];
  /** Rotating this ring also rotates these (1 = same way, -1 = opposite). */
  links?: { ring: number; ratio: 1 | -1 }[];
  locked?: boolean;
}
export interface RingsDef {
  kind: 'rings';
  steps: number;
  /** Slot indices where threads cross every ring. Asymmetric sets only. */
  threads: number[];
  rings: RingSpec[];
  /** Initial state = solved state with these [ring, turns] moves applied. */
  scramble: [number, number][];
}

/* Day — light and mirrors on a grid. Directions: 0→E, 1→S, 2→W, 3→N. */
export type Dir = 0 | 1 | 2 | 3;
export interface LightCellDef {
  x: number;
  y: number;
  type: 'emitter' | 'mirror' | 'target' | 'block' | 'splitter' | 'dye';
  dir?: Dir; // emitters
  m?: '/' | '\\'; // mirrors: initial orientation
  locked?: boolean; // mirrors that cannot be flipped
  color?: PrimC; // colored emitters, and the tint of dye panes
  need?: PrimC[]; // colored targets (Unity chapter)
  hits?: number; // white targets that must be fed by several beams
}
export interface LightDef {
  kind: 'light';
  cols: number;
  rows: number;
  cells: LightCellDef[];
}

/* Dusk — translucent color disks sliding between anchors. */
export interface BlendDiskDef {
  color: PrimC;
  anchors: [number, number][];
  at: number; // initial anchor index
  r?: number; // radius (default 130)
  /** Linked disk index: both always sit at the same anchor position index. */
  link?: number;
}
export interface BlendSocketDef {
  x: number;
  y: number;
  need: PrimC[];
}
export interface BlendDef {
  kind: 'blend';
  disks: BlendDiskDef[];
  sockets: BlendSocketDef[];
}

/* Night — echo the stars. Each sequence step is a set of star indices
   (usually one; the Unity color-echo uses pairs). */
export interface EchoDef {
  kind: 'echo';
  stars: [number, number][];
  sequence: number[][];
  /** 'grow': Simon-style lengthening. 'reverse': answer backwards. */
  mode?: 'full' | 'grow' | 'reverse';
  growFrom?: number;
  /** Slow orbital drift of the whole constellation, radians/second. */
  drift?: number;
  /** Star colors — enables the color-echo variant with the speaking moon. */
  colors?: PrimC[];
}

/* Unity — rings of light: rotate ring gates so every beam reaches the core. */
export interface LockDef {
  kind: 'lock';
  steps: number;
  rings: {
    /** Slot indices (local frame) where light may pass through this ring. */
    channels: number[];
    links?: { ring: number; ratio: 1 | -1 }[];
  }[];
  /** Slot angles at which beams shine inward from the rim. */
  beams: number[];
  scramble: [number, number][];
}

/* Unity — the scripted three-movement finale. */
export interface FinaleDef {
  kind: 'finale';
}

export type PuzzleDef = RingsDef | LightDef | BlendDef | EchoDef | LockDef | FinaleDef;

/** Localized inline text (level-specific prose lives with the level). */
export interface LText {
  en: string;
  ar: string;
}

export interface LevelDef {
  id: string;
  chapter: ChapterId;
  name: StringKey;
  hint?: StringKey;
  /** Two-tier nudges for the hint lantern: a gentle idea, then a pointer. */
  nudge1: LText;
  nudge2: LText;
  puzzle: PuzzleDef;
}
