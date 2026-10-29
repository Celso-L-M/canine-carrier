/**
 * Canine Courier — entity spawning.
 *
 * Every spawner works off the walkable tile list so nothing is ever placed
 * inside a bush wall.
 */

import { manhattan, walkableTiles } from "./maze";
import type { Carrier, ItemKind, LostItem, Sprinkler, Vec2 } from "./types";

/** Pick a random element from a non-empty array. */
function pick<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

/** Fisher–Yates shuffle returning a new array. */
function shuffle<T>(arr: T[]): T[] {
  const copy = [...arr];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

/** Max always starts on the top-left walkable tile. */
export function spawnMax(maze: Parameters<typeof walkableTiles>[0]): Vec2 {
  const tiles = walkableTiles(maze);
  // Prefer a tile near the top-left corner for a consistent start.
  return tiles.reduce((best, t) => (t.x + t.y < best.x + best.y ? t : best));
}

/**
 * Place the three lost items on distinct walkable tiles that are reasonably
 * far from Max so the Sniff ability actually matters.
 */
export function spawnItems(
  maze: Parameters<typeof walkableTiles>[0],
  max: Vec2,
): LostItem[] {
  const kinds: ItemKind[] = ["newspaper", "slipper", "ball"];
  const candidates = shuffle(walkableTiles(maze)).filter(
    (t) => manhattan(t, max) > 4,
  );
  const chosen: Vec2[] = [];
  for (const tile of candidates) {
    if (chosen.length === kinds.length) break;
    // Keep items spread out from each other too.
    if (chosen.every((c) => manhattan(c, tile) > 3)) chosen.push(tile);
  }
  // Fallback: if the maze is tiny, just take the first few candidates.
  while (chosen.length < kinds.length && candidates.length > chosen.length) {
    chosen.push(candidates[chosen.length]);
  }

  return kinds.map((kind, i) => ({
    id: i,
    kind,
    pos: chosen[i] ?? { x: 1, y: 1 },
    collected: false,
    flash: 0,
  }));
}

/**
 * Spawn mail carriers on straight corridors. Each carrier patrols between two
 * walkable tiles that share a row or column. `speedScale` raises the patrol
 * speed on later levels so hazards get faster as the run progresses.
 */
export function spawnCarriers(
  maze: Parameters<typeof walkableTiles>[0],
  count: number,
  speedScale = 1,
): Carrier[] {
  const tiles = walkableTiles(maze);
  const carriers: Carrier[] = [];
  let attempts = 0;

  while (carriers.length < count && attempts < 200) {
    attempts++;
    const start = pick(tiles);
    // Try a horizontal run first, then vertical.
    const horizontal = Math.random() < 0.5;
    const length = 3 + Math.floor(Math.random() * 4);
    const end = horizontal
      ? { x: start.x + length, y: start.y }
      : { x: start.x, y: start.y + length };

    // Verify every tile along the run is walkable.
    let clear = true;
    for (let i = 1; i <= length; i++) {
      const t = horizontal
        ? { x: start.x + i, y: start.y }
        : { x: start.x, y: start.y + i };
      if (!tiles.some((w) => w.x === t.x && w.y === t.y)) {
        clear = false;
        break;
      }
    }
    if (!clear) continue;

    carriers.push({
      pos: { ...start },
      from: { ...start },
      to: end,
      dir: 1,
      speed: (1.6 + Math.random() * 0.8) * speedScale,
    });
  }

  return carriers;
}

/** Spawn sprinklers on random walkable tiles, each starting on a random phase. */
export function spawnSprinklers(
  maze: Parameters<typeof walkableTiles>[0],
  count: number,
): Sprinkler[] {
  const tiles = shuffle(walkableTiles(maze));
  return tiles.slice(0, count).map((pos) => ({
    pos,
    timer: Math.random() * 4,
    active: false,
  }));
}
