/**
 * Canine Courier — maze generation and pathfinding.
 *
 * The maze is a fixed odd-sized grid carved with a randomised depth-first
 * search so every run feels fresh while always remaining fully connected.
 */

import { Tile, type Vec2 } from "./types";

/** Grid dimensions (odd numbers keep the DFS carve clean). */
export const MAZE_COLS = 21;
export const MAZE_ROWS = 15;

/** Four orthogonal neighbours used by both carving and pathfinding. */
const DIRS: Vec2[] = [
  { x: 1, y: 0 },
  { x: -1, y: 0 },
  { x: 0, y: 1 },
  { x: 0, y: -1 },
];

/** Build a fresh maze: all walls, then carve corridors with randomised DFS. */
export function generateMaze(): Tile[][] {
  const grid: Tile[][] = Array.from({ length: MAZE_ROWS }, () =>
    Array.from({ length: MAZE_COLS }, () => Tile.Wall),
  );

  // Carve from a random odd cell, stepping two tiles at a time.
  const startX = 1;
  const startY = 1;
  grid[startY][startX] = Tile.Floor;

  const stack: Vec2[] = [{ x: startX, y: startY }];
  while (stack.length > 0) {
    const current = stack[stack.length - 1];
    // Collect unvisited neighbours two tiles away (still walls).
    const candidates = DIRS.map((d) => ({
      x: current.x + d.x * 2,
      y: current.y + d.y * 2,
      dx: d.x,
      dy: d.y,
    })).filter(
      (n) =>
        n.x > 0 &&
        n.x < MAZE_COLS - 1 &&
        n.y > 0 &&
        n.y < MAZE_ROWS - 1 &&
        grid[n.y][n.x] === Tile.Wall,
    );

    if (candidates.length === 0) {
      stack.pop();
      continue;
    }

    const next = candidates[Math.floor(Math.random() * candidates.length)];
    // Knock down the wall between current and next, then open next.
    grid[current.y + next.dy][current.x + next.dx] = Tile.Floor;
    grid[next.y][next.x] = Tile.Floor;
    stack.push({ x: next.x, y: next.y });
  }

  // Punch a few extra openings so the maze has loops (more fun to navigate).
  for (let i = 0; i < 14; i++) {
    const x = 1 + Math.floor(Math.random() * (MAZE_COLS - 2));
    const y = 1 + Math.floor(Math.random() * (MAZE_ROWS - 2));
    if (grid[y][x] === Tile.Wall) {
      // Only remove walls that separate two floors (avoids dead pockets).
      const horizontal =
        grid[y][x - 1] === Tile.Floor && grid[y][x + 1] === Tile.Floor;
      const vertical =
        grid[y - 1][x] === Tile.Floor && grid[y + 1][x] === Tile.Floor;
      if (horizontal || vertical) grid[y][x] = Tile.Floor;
    }
  }

  return grid;
}

/** True when the tile is inside bounds and walkable. */
export function isWalkable(maze: Tile[][], x: number, y: number): boolean {
  if (y < 0 || y >= maze.length || x < 0 || x >= maze[0].length) return false;
  return maze[y][x] === Tile.Floor;
}

/** Every walkable tile in the maze. */
export function walkableTiles(maze: Tile[][]): Vec2[] {
  const tiles: Vec2[] = [];
  for (let y = 0; y < maze.length; y++) {
    for (let x = 0; x < maze[0].length; x++) {
      if (maze[y][x] === Tile.Floor) tiles.push({ x, y });
    }
  }
  return tiles;
}

/**
 * Breadth-first search returning the shortest tile path from `start` to
 * `goal` (inclusive of both). Returns an empty array when unreachable.
 */
export function findPath(maze: Tile[][], start: Vec2, goal: Vec2): Vec2[] {
  if (start.x === goal.x && start.y === goal.y) return [start];

  const key = (p: Vec2) => `${p.x},${p.y}`;
  const cameFrom = new Map<string, Vec2>();
  const visited = new Set<string>([key(start)]);
  const queue: Vec2[] = [start];

  while (queue.length > 0) {
    const current = queue.shift() as Vec2;
    for (const d of DIRS) {
      const next = { x: current.x + d.x, y: current.y + d.y };
      if (!isWalkable(maze, next.x, next.y) || visited.has(key(next))) continue;
      visited.add(key(next));
      cameFrom.set(key(next), current);
      if (next.x === goal.x && next.y === goal.y) {
        // Reconstruct the path back to the start.
        const path: Vec2[] = [next];
        let step = current;
        while (!(step.x === start.x && step.y === start.y)) {
          path.unshift(step);
          step = cameFrom.get(key(step)) as Vec2;
        }
        path.unshift(start);
        return path;
      }
      queue.push(next);
    }
  }
  return [];
}

/** Manhattan distance — cheap heuristic for "nearest item". */
export function manhattan(a: Vec2, b: Vec2): number {
  return Math.abs(a.x - b.x) + Math.abs(a.y - b.y);
}
