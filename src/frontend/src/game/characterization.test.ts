/**
 * Canine Courier — maze and spawn invariants (characterization).
 *
 * These lock down the parts of the existing game the quality pass must not
 * change: the generated maze is a bounded, fully connected grid, and every
 * entity spawns on a walkable tile. No DOM and no backend are involved.
 */

import { describe, expect, it } from "vitest";
import { createGame } from "./engine";
import {
  MAZE_COLS,
  MAZE_ROWS,
  generateMaze,
  isWalkable,
  walkableTiles,
} from "./maze";
import { Tile } from "./types";

describe("maze generation invariants", () => {
  it("produces a bounded grid of the declared dimensions", () => {
    const maze = generateMaze();
    expect(maze).toHaveLength(MAZE_ROWS);
    for (const row of maze) expect(row).toHaveLength(MAZE_COLS);
  });

  it("keeps the outer border solid so Max cannot leave the board", () => {
    const maze = generateMaze();
    for (let x = 0; x < MAZE_COLS; x++) {
      expect(maze[0][x]).toBe(Tile.Wall);
      expect(maze[MAZE_ROWS - 1][x]).toBe(Tile.Wall);
    }
    for (let y = 0; y < MAZE_ROWS; y++) {
      expect(maze[y][0]).toBe(Tile.Wall);
      expect(maze[y][MAZE_COLS - 1]).toBe(Tile.Wall);
    }
  });

  it("carves a connected maze with at least one walkable tile", () => {
    const maze = generateMaze();
    const floors = walkableTiles(maze);
    expect(floors.length).toBeGreaterThan(0);

    // Flood-fill from the first floor tile: every floor must be reachable.
    const seen = new Set<string>([`${floors[0].x},${floors[0].y}`]);
    const queue = [floors[0]];
    while (queue.length > 0) {
      const cur = queue.shift() as { x: number; y: number };
      for (const d of [
        { x: 1, y: 0 },
        { x: -1, y: 0 },
        { x: 0, y: 1 },
        { x: 0, y: -1 },
      ]) {
        const nx = cur.x + d.x;
        const ny = cur.y + d.y;
        const key = `${nx},${ny}`;
        if (isWalkable(maze, nx, ny) && !seen.has(key)) {
          seen.add(key);
          queue.push({ x: nx, y: ny });
        }
      }
    }
    expect(seen.size).toBe(floors.length);
  });
});

describe("fresh run spawn invariants", () => {
  it("spawns Max, items, carriers and sprinklers on walkable tiles", () => {
    const state = createGame();
    expect(isWalkable(state.maze, state.max.x, state.max.y)).toBe(true);
    for (const item of state.items) {
      expect(isWalkable(state.maze, item.pos.x, item.pos.y)).toBe(true);
    }
    for (const s of state.sprinklers) {
      expect(isWalkable(state.maze, s.pos.x, s.pos.y)).toBe(true);
    }
    for (const c of state.carriers) {
      expect(isWalkable(state.maze, c.from.x, c.from.y)).toBe(true);
      expect(isWalkable(state.maze, c.to.x, c.to.y)).toBe(true);
    }
  });

  it("starts every run with 3 lives, a full sniff meter and 3 hidden items", () => {
    const state = createGame();
    expect(state.lives).toBe(3);
    expect(state.sniff).toBe(1);
    expect(state.status).toBe("playing");
    expect(state.items).toHaveLength(3);
    expect(state.items.every((i) => !i.collected)).toBe(true);
  });
});
