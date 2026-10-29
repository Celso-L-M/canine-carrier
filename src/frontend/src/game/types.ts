/**
 * Canine Courier — shared game types.
 * Kept dependency-free so every game module can import it safely.
 */

/** A single maze tile. Walls are green bushes; floors are walkable. */
export const Tile = {
  Floor: 0,
  Wall: 1,
} as const;
export type Tile = (typeof Tile)[keyof typeof Tile];

/** Axis-aligned grid coordinate. */
export interface Vec2 {
  x: number;
  y: number;
}

/** The three lost items Max must recover. */
export type ItemKind = "newspaper" | "slipper" | "ball";

/** A collectible lost item sitting on a walkable tile. */
export interface LostItem {
  id: number;
  kind: ItemKind;
  pos: Vec2;
  collected: boolean;
  /** Seconds of bright pickup flash remaining (0 when idle). */
  flash?: number;
}

/** A mail carrier patrolling back and forth along a straight corridor. */
export interface Carrier {
  /** Current tile position (fractional while moving). */
  pos: Vec2;
  /** Patrol endpoints in tile units. */
  from: Vec2;
  to: Vec2;
  /** +1 travelling toward `to`, -1 travelling toward `from`. */
  dir: 1 | -1;
  /** Tiles per second. */
  speed: number;
}

/** An automated sprinkler that cycles on/off every 4 seconds. */
export interface Sprinkler {
  pos: Vec2;
  /** Seconds remaining in the current on/off phase. */
  timer: number;
  /** True while actively spraying (deadly). */
  active: boolean;
}

/** A floating "+100" score burst that rises and fades at a pickup tile. */
export interface ScoreBurst {
  id: number;
  pos: Vec2;
  /** Seconds remaining before the burst disappears. */
  timer: number;
  /** Points shown in the burst. */
  value: number;
}

/** High-level lifecycle of a single run. */
export type GameStatus = "playing" | "gameover" | "won";

/** Mutable snapshot of everything the renderer and HUD need. */
export interface GameState {
  maze: Tile[][];
  cols: number;
  rows: number;
  max: Vec2;
  /** Facing direction, used to orient the pixel-art dog. */
  facing: Vec2;
  items: LostItem[];
  carriers: Carrier[];
  sprinklers: Sprinkler[];
  /** Remaining lives (starts at 3). */
  lives: number;
  /** Points earned this run (carries across levels). */
  score: number;
  /** Items collected this level. */
  collected: number;
  /** Current level number (starts at 1). */
  level?: number;
  /** Sniff meter charge, 0..1. */
  sniff: number;
  /** Seconds of item visibility remaining after a Sniff. */
  revealTimer: number;
  /** Path of tiles from Max toward the nearest item (empty when not sniffing). */
  trail: Vec2[];
  /** Seconds the trail stays visible. */
  trailTimer: number;
  status: GameStatus;
  /** Seconds of invulnerability after taking a hit (blink + grace). */
  invuln: number;
  /** Floating score bursts from recent pickups. */
  bursts?: ScoreBurst[];
  /** Seconds of screen shake remaining after a hit. */
  shake?: number;
  /** Seconds of red vignette flash remaining after a hit. */
  vignette?: number;
  /** Seconds of expanding Sniff pulse ring remaining. */
  sniffPulse?: number;
  /** Seconds of heart-loss animation remaining in the HUD. */
  heartLoss?: number;
  /** Walk-cycle phase (radians) advanced while Max is moving. */
  walkPhase?: number;
  /** True while Max has movement input this frame (drives the walk bob). */
  moving?: boolean;
}
