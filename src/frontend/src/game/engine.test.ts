/**
 * Canine Courier — engine simulation tests.
 *
 * These exercise the pure game loop: movement, wall collision, the Sniff
 * ability, hazard contact, and the win / game-over transitions. No DOM and no
 * backend are involved, so the assertions are deterministic.
 */

import { describe, expect, it } from "vitest";
import { CONFIG, createGame, step } from "./engine";
import { isWalkable } from "./maze";
import { type GameState, Tile, type Vec2 } from "./types";

/** A hand-built state so tests never depend on random maze generation. */
function makeState(overrides: Partial<GameState> = {}): GameState {
  // 5x5 open room with a solid wall border.
  const maze: Tile[][] = Array.from({ length: 5 }, (_, y) =>
    Array.from({ length: 5 }, (_, x) =>
      x === 0 || y === 0 || x === 4 || y === 4 ? Tile.Wall : Tile.Floor,
    ),
  );
  return {
    maze,
    cols: 5,
    rows: 5,
    max: { x: 2, y: 2 },
    facing: { x: 0, y: 1 },
    items: [],
    carriers: [],
    sprinklers: [],
    lives: 3,
    score: 0,
    collected: 0,
    sniff: 1,
    revealTimer: 0,
    trail: [],
    trailTimer: 0,
    status: "playing",
    invuln: 0,
    ...overrides,
  };
}

const NONE: Vec2 = { x: 0, y: 0 };

describe("createGame", () => {
  it("starts a fresh run with 3 lives, full sniff, and 3 hidden items", () => {
    const state = createGame();
    expect(state.lives).toBe(3);
    expect(state.sniff).toBe(1);
    expect(state.status).toBe("playing");
    expect(state.items).toHaveLength(3);
    expect(state.items.every((i) => !i.collected)).toBe(true);
    // Max always spawns on a walkable tile.
    expect(isWalkable(state.maze, state.max.x, state.max.y)).toBe(true);
  });
});

describe("movement and wall collision", () => {
  it("moves Max in the requested direction", () => {
    const state = makeState();
    step(state, { x: 1, y: 0 }, false, 0.1);
    expect(state.max.x).toBeGreaterThan(2);
    expect(state.max.y).toBeCloseTo(2);
  });

  it("blocks Max from passing through a bush wall", () => {
    // Max sits against the right wall at x=3 (wall at x=4).
    const state = makeState({ max: { x: 3, y: 2 } });
    for (let i = 0; i < 20; i++) step(state, { x: 1, y: 0 }, false, 0.05);
    // He may approach the wall but never enter the wall tile.
    expect(state.max.x).toBeLessThan(4);
    expect(isWalkable(state.maze, Math.floor(state.max.x), 2)).toBe(true);
  });

  it("records the facing direction from movement input", () => {
    const state = makeState();
    step(state, { x: -1, y: 0 }, false, 0.05);
    expect(state.facing).toEqual({ x: -1, y: 0 });
  });
});

describe("sniff ability", () => {
  it("reveals items, lays a trail to the nearest item, and drains the meter", () => {
    const state = makeState({
      items: [
        { id: 0, kind: "ball", pos: { x: 3, y: 2 }, collected: false },
        { id: 1, kind: "slipper", pos: { x: 1, y: 1 }, collected: false },
      ],
    });
    step(state, NONE, true, 0.016);

    expect(state.revealTimer).toBeGreaterThan(0);
    expect(state.trail.length).toBeGreaterThan(0);
    // Trail ends at the nearest item (3,2), not the farther one.
    expect(state.trail[state.trail.length - 1]).toEqual({ x: 3, y: 2 });
    expect(state.sniff).toBeLessThan(1);
  });

  it("hides items again after the 3-second reveal window", () => {
    const state = makeState({
      items: [{ id: 0, kind: "ball", pos: { x: 3, y: 2 }, collected: false }],
    });
    step(state, NONE, true, 0.016);
    expect(state.revealTimer).toBeGreaterThan(0);

    // Advance past the reveal duration in small steps.
    for (let t = 0; t < CONFIG.revealDuration + 0.2; t += 0.05) {
      step(state, NONE, false, 0.05);
    }
    expect(state.revealTimer).toBe(0);
    expect(state.trail).toEqual([]);
  });

  it("recharges the sniff meter over time when not sniffing", () => {
    const state = makeState({ sniff: 0.2 });
    for (let i = 0; i < 20; i++) step(state, NONE, false, 0.1);
    expect(state.sniff).toBeGreaterThan(0.2);
  });

  it("does not trigger a sniff when the meter is below the minimum", () => {
    const state = makeState({
      sniff: 0.1,
      items: [{ id: 0, kind: "ball", pos: { x: 3, y: 2 }, collected: false }],
    });
    step(state, NONE, true, 0.016);
    expect(state.revealTimer).toBe(0);
    expect(state.trail).toEqual([]);
  });
});

describe("hazards and lives", () => {
  it("costs a life when Max touches a mail carrier", () => {
    const state = makeState({
      carriers: [
        {
          pos: { x: 2, y: 2 },
          from: { x: 2, y: 2 },
          to: { x: 2, y: 2 },
          dir: 1,
          speed: 0,
        },
      ],
    });
    step(state, NONE, false, 0.016);
    expect(state.lives).toBe(2);
    expect(state.invuln).toBeGreaterThan(0);
  });

  it("costs a life when Max stands inside an active sprinkler", () => {
    // Sprinkler tile (2,2) has its center at (2.5,2.5); put Max there.
    const state = makeState({
      max: { x: 2.5, y: 2.5 },
      sprinklers: [{ pos: { x: 2, y: 2 }, timer: 4, active: true }],
    });
    step(state, NONE, false, 0.016);
    expect(state.lives).toBe(2);
  });

  it("does not cost a life inside an inactive sprinkler", () => {
    const state = makeState({
      max: { x: 2.5, y: 2.5 },
      sprinklers: [{ pos: { x: 2, y: 2 }, timer: 4, active: false }],
    });
    step(state, NONE, false, 0.016);
    expect(state.lives).toBe(3);
  });

  it("shows Game Over after losing all 3 lives", () => {
    const state = makeState({
      lives: 1,
      carriers: [
        {
          pos: { x: 2, y: 2 },
          from: { x: 2, y: 2 },
          to: { x: 2, y: 2 },
          dir: 1,
          speed: 0,
        },
      ],
    });
    step(state, NONE, false, 0.016);
    expect(state.lives).toBe(0);
    expect(state.status).toBe("gameover");
  });
});

describe("sprinkler cycle", () => {
  it("toggles a sprinkler on a 4-second period", () => {
    const state = makeState({
      sprinklers: [{ pos: { x: 1, y: 1 }, timer: 0.1, active: false }],
    });
    // Cross the phase boundary.
    step(state, NONE, false, 0.2);
    expect(state.sprinklers[0].active).toBe(true);
    expect(state.sprinklers[0].timer).toBeCloseTo(CONFIG.sprinklerPeriod, 5);
  });
});

describe("win condition", () => {
  it("collects an item Max stands on and scores points", () => {
    const state = makeState({
      items: [{ id: 0, kind: "ball", pos: { x: 2, y: 2 }, collected: false }],
    });
    step(state, NONE, false, 0.016);
    expect(state.collected).toBe(1);
    // Collecting the only item also completes the level, so the bonus applies.
    expect(state.score).toBe(CONFIG.itemScore + CONFIG.levelBonus);
  });

  it("shows the win state after collecting all 3 items", () => {
    const state = makeState({
      items: [
        { id: 0, kind: "ball", pos: { x: 2, y: 2 }, collected: false },
        { id: 1, kind: "slipper", pos: { x: 2, y: 2 }, collected: false },
        { id: 2, kind: "newspaper", pos: { x: 2, y: 2 }, collected: false },
      ],
    });
    step(state, NONE, false, 0.016);
    expect(state.collected).toBe(3);
    expect(state.status).toBe("won");
    expect(state.score).toBe(3 * CONFIG.itemScore + CONFIG.levelBonus);
  });
});
