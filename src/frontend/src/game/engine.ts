/**
 * Canine Courier — game engine.
 *
 * Owns the mutable game state and advances it one fixed step at a time.
 * Rendering lives in render.ts; this module is pure simulation so it stays
 * easy to reason about and test.
 */

import {
  spawnCarriers,
  spawnItems,
  spawnMax,
  spawnSprinklers,
} from "./entities";
import { findPath, generateMaze, isWalkable, manhattan } from "./maze";
import type { GameState, Tile, Vec2 } from "./types";

/** Tunable constants for the whole game. */
export const CONFIG = {
  /** Max's movement speed in tiles per second. */
  maxSpeed: 4.2,
  /** Sniff meter drain per second while active. */
  sniffDrain: 0.55,
  /** Sniff meter recharge per second. */
  sniffRecharge: 0.22,
  /** Minimum charge required to trigger a Sniff. */
  sniffMin: 0.25,
  /** How long items stay revealed after a Sniff (seconds). */
  revealDuration: 3,
  /** How long the glowing trail stays on the ground (seconds). */
  trailDuration: 3,
  /** Sprinkler on/off phase length (seconds). */
  sprinklerPeriod: 4,
  /** Seconds of invulnerability after losing a life. */
  invulnDuration: 1.5,
  /** Collision radius in tiles for hazard contact. */
  hitRadius: 0.55,
  /** Points awarded per collected item. */
  itemScore: 100,
  /** Bonus points for finishing the level. */
  levelBonus: 500,
  /** Carriers on level 1; each level adds one more. */
  baseCarriers: 3,
  /** Sprinklers on level 1; each level adds one more. */
  baseSprinklers: 4,
  /** Hazard speed multiplier added per level beyond the first. */
  levelSpeedStep: 0.12,
  /** Seconds a "+100" pickup burst floats for. */
  burstDuration: 0.8,
  /** Seconds of screen shake after a hit. */
  shakeDuration: 0.35,
  /** Seconds of red vignette flash after a hit. */
  vignetteDuration: 0.5,
  /** Seconds of expanding Sniff pulse ring. */
  sniffPulseDuration: 0.5,
  /** Seconds of heart-loss animation in the HUD. */
  heartLossDuration: 0.6,
  /** Seconds an item stays bright after being collected. */
  itemFlashDuration: 0.35,
} as const;

/** Build a fresh level with difficulty scaled to `level` (1-based). */
export function createLevel(level: number): GameState {
  const maze = generateMaze();
  const max = spawnMax(maze);
  const speedScale = 1 + (level - 1) * CONFIG.levelSpeedStep;
  return {
    maze,
    cols: maze[0].length,
    rows: maze.length,
    max,
    facing: { x: 0, y: 1 },
    items: spawnItems(maze, max),
    carriers: spawnCarriers(
      maze,
      CONFIG.baseCarriers + (level - 1),
      speedScale,
    ),
    sprinklers: spawnSprinklers(maze, CONFIG.baseSprinklers + (level - 1)),
    lives: 3,
    score: 0,
    collected: 0,
    level,
    sniff: 1,
    revealTimer: 0,
    trail: [],
    trailTimer: 0,
    status: "playing",
    invuln: 0,
    bursts: [],
    shake: 0,
    vignette: 0,
    sniffPulse: 0,
    heartLoss: 0,
    walkPhase: 0,
    moving: false,
  };
}

/** Build a brand-new run at level 1. */
export function createGame(): GameState {
  return createLevel(1);
}

/**
 * Advance to the next level: a fresh maze with more, faster hazards. Score and
 * remaining lives carry over so a run only ends when every life is lost.
 */
export function advanceLevel(state: GameState): GameState {
  const next = createLevel((state.level ?? 1) + 1);
  next.score = state.score;
  next.lives = state.lives;
  return next;
}

/** True when a fractional position overlaps a wall tile. */
function blocked(maze: Tile[][], x: number, y: number): boolean {
  // Sample the four corners of Max's collision box.
  const r = 0.32;
  const corners: Vec2[] = [
    { x: x - r, y: y - r },
    { x: x + r, y: y - r },
    { x: x - r, y: y + r },
    { x: x + r, y: y + r },
  ];
  return corners.some(
    (c) => !isWalkable(maze, Math.floor(c.x), Math.floor(c.y)),
  );
}

/** Move Max with per-axis collision so he slides along walls. */
function moveMax(state: GameState, dir: Vec2, dt: number): void {
  const step = CONFIG.maxSpeed * dt;
  const dx = dir.x * step;
  const dy = dir.y * step;

  if (dx !== 0 && !blocked(state.maze, state.max.x + dx, state.max.y)) {
    state.max.x += dx;
  }
  if (dy !== 0 && !blocked(state.maze, state.max.x, state.max.y + dy)) {
    state.max.y += dy;
  }
  if (dir.x !== 0 || dir.y !== 0) {
    state.facing = { x: Math.sign(dir.x), y: Math.sign(dir.y) };
  }
}

/** Advance every mail carrier along its patrol segment. */
function updateCarriers(state: GameState, dt: number): void {
  for (const c of state.carriers) {
    const target = c.dir === 1 ? c.to : c.from;
    const dx = target.x - c.pos.x;
    const dy = target.y - c.pos.y;
    const dist = Math.hypot(dx, dy);
    const step = c.speed * dt;

    if (dist <= step) {
      // Snap to the endpoint and reverse direction.
      c.pos = { ...target };
      c.dir = c.dir === 1 ? -1 : 1;
    } else {
      c.pos.x += (dx / dist) * step;
      c.pos.y += (dy / dist) * step;
    }
  }
}

/** Toggle sprinklers on a fixed 4-second cycle. */
function updateSprinklers(state: GameState, dt: number): void {
  for (const s of state.sprinklers) {
    s.timer -= dt;
    if (s.timer <= 0) {
      s.active = !s.active;
      s.timer = CONFIG.sprinklerPeriod;
    }
  }
}

/** Trigger a Sniff: reveal items and lay a glowing trail to the nearest one. */
function triggerSniff(state: GameState): void {
  if (state.sniff < CONFIG.sniffMin) return;

  const remaining = state.items.filter((i) => !i.collected);
  if (remaining.length === 0) return;

  // Nearest item by Manhattan distance from Max's current tile.
  const maxTile = { x: Math.round(state.max.x), y: Math.round(state.max.y) };
  const nearest = remaining.reduce((best, item) =>
    manhattan(item.pos, maxTile) < manhattan(best.pos, maxTile) ? item : best,
  );

  state.trail = findPath(state.maze, maxTile, nearest.pos);
  state.trailTimer = CONFIG.trailDuration;
  state.revealTimer = CONFIG.revealDuration;
  state.sniff = Math.max(0, state.sniff - CONFIG.sniffMin);
  // Fire the expanding pulse ring so the ability reads as a deliberate action.
  state.sniffPulse = CONFIG.sniffPulseDuration;
}

/** Collect any item Max is standing on. */
function checkItemPickup(state: GameState): void {
  for (const item of state.items) {
    if (item.collected) continue;
    if (
      manhattan(item.pos, {
        x: Math.round(state.max.x),
        y: Math.round(state.max.y),
      }) === 0
    ) {
      item.collected = true;
      item.flash = CONFIG.itemFlashDuration;
      state.collected += 1;
      state.score += CONFIG.itemScore;
      // Float a "+100" burst at the pickup tile.
      if (!state.bursts) state.bursts = [];
      state.bursts.push({
        id: state.bursts.length + state.collected * 1000,
        pos: { ...item.pos },
        timer: CONFIG.burstDuration,
        value: CONFIG.itemScore,
      });
    }
  }
  if (state.collected >= state.items.length) {
    state.score += CONFIG.levelBonus;
    state.status = "won";
  }
}

/** Apply one life loss with invulnerability grace. */
function loseLife(state: GameState): void {
  if (state.invuln > 0) return;
  state.lives -= 1;
  state.invuln = CONFIG.invulnDuration;
  // Feedback: screen shake, red vignette flash, HUD heart-loss animation.
  state.shake = CONFIG.shakeDuration;
  state.vignette = CONFIG.vignetteDuration;
  state.heartLoss = CONFIG.heartLossDuration;
  if (state.lives <= 0) {
    state.lives = 0;
    state.status = "gameover";
  }
}

/** Check contact with carriers and active sprinklers. */
function checkHazards(state: GameState): void {
  for (const c of state.carriers) {
    if (
      Math.hypot(c.pos.x - state.max.x, c.pos.y - state.max.y) <
      CONFIG.hitRadius
    ) {
      loseLife(state);
      return;
    }
  }
  for (const s of state.sprinklers) {
    if (!s.active) continue;
    if (
      Math.hypot(s.pos.x + 0.5 - state.max.x, s.pos.y + 0.5 - state.max.y) <
      CONFIG.hitRadius
    ) {
      loseLife(state);
      return;
    }
  }
}

/** Decay every short-lived visual effect timer. */
function updateEffects(state: GameState, dt: number): void {
  if (state.shake && state.shake > 0)
    state.shake = Math.max(0, state.shake - dt);
  if (state.vignette && state.vignette > 0)
    state.vignette = Math.max(0, state.vignette - dt);
  if (state.sniffPulse && state.sniffPulse > 0)
    state.sniffPulse = Math.max(0, state.sniffPulse - dt);
  if (state.heartLoss && state.heartLoss > 0)
    state.heartLoss = Math.max(0, state.heartLoss - dt);

  // Age the floating score bursts and drop the expired ones.
  if (state.bursts) {
    for (const b of state.bursts) b.timer -= dt;
    state.bursts = state.bursts.filter((b) => b.timer > 0);
  }

  // Fade the bright pickup flash on collected items.
  for (const item of state.items) {
    if (item.flash && item.flash > 0) item.flash = Math.max(0, item.flash - dt);
  }
}

/**
 * Advance the simulation by `dt` seconds.
 * `dir` is the current movement input; `sniff` is a one-shot trigger.
 */
export function step(
  state: GameState,
  dir: Vec2,
  sniff: boolean,
  dt: number,
): void {
  if (state.status !== "playing") return;

  // Timers first so a hit this frame still respects grace.
  if (state.invuln > 0) state.invuln = Math.max(0, state.invuln - dt);
  if (state.revealTimer > 0)
    state.revealTimer = Math.max(0, state.revealTimer - dt);
  if (state.trailTimer > 0) {
    state.trailTimer = Math.max(0, state.trailTimer - dt);
    if (state.trailTimer === 0) state.trail = [];
  }
  updateEffects(state, dt);

  if (sniff) triggerSniff(state);

  // Track the walk cycle so the renderer can bob Max while he moves.
  state.moving = dir.x !== 0 || dir.y !== 0;
  if (state.moving) state.walkPhase = (state.walkPhase ?? 0) + dt * 12;

  moveMax(state, dir, dt);
  updateCarriers(state, dt);
  updateSprinklers(state, dt);

  // Sniff meter recharges slowly while not actively draining.
  state.sniff = Math.min(1, state.sniff + CONFIG.sniffRecharge * dt);

  checkItemPickup(state);
  checkHazards(state);
}
