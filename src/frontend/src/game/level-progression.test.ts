/**
 * Canine Courier — level progression and feedback (cover).
 *
 * Locks down the accepted quality-pass behavior in the pure engine: collecting
 * an item scores 100 and floats a burst, taking a hit sets the shake/vignette/
 * heart-loss feedback, and clearing a level advances to a harder next level
 * while carrying score and lives. No DOM and no backend are involved.
 */

import { describe, expect, it } from "vitest";
import { CONFIG, advanceLevel, createGame, createLevel, step } from "./engine";
import { type GameState, Tile, type Vec2 } from "./types";

/** A hand-built state so tests never depend on random maze generation. */
function makeState(overrides: Partial<GameState> = {}): GameState {
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
    level: 1,
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
    ...overrides,
  };
}

const NONE: Vec2 = { x: 0, y: 0 };

describe("item pickup feedback", () => {
  it("scores 100 and floats a burst when Max collects an item", () => {
    const state = makeState({
      items: [
        { id: 0, kind: "ball", pos: { x: 2, y: 2 }, collected: false },
        { id: 1, kind: "slipper", pos: { x: 1, y: 1 }, collected: false },
      ],
    });
    step(state, NONE, false, 0.016);

    expect(state.collected).toBe(1);
    expect(state.score).toBe(CONFIG.itemScore);
    expect(state.bursts).toHaveLength(1);
    expect(state.bursts?.[0].value).toBe(CONFIG.itemScore);
    expect(state.bursts?.[0].pos).toEqual({ x: 2, y: 2 });
  });

  it("ages the burst out after its lifetime", () => {
    const state = makeState({
      items: [
        { id: 0, kind: "ball", pos: { x: 2, y: 2 }, collected: false },
        { id: 1, kind: "slipper", pos: { x: 1, y: 1 }, collected: false },
      ],
    });
    step(state, NONE, false, 0.016);
    expect(state.bursts).toHaveLength(1);

    for (let t = 0; t < CONFIG.burstDuration + 0.2; t += 0.05) {
      step(state, NONE, false, 0.05);
    }
    expect(state.bursts).toEqual([]);
  });
});

describe("hit feedback", () => {
  it("sets shake, vignette and heart-loss timers when a life is lost", () => {
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
    expect(state.shake).toBeGreaterThan(0);
    expect(state.vignette).toBeGreaterThan(0);
    expect(state.heartLoss).toBeGreaterThan(0);
  });
});

describe("level progression", () => {
  it("advances to the next level with a fresh maze and more hazards", () => {
    const first = createLevel(1);
    const second = advanceLevel(first);

    expect(second.level).toBe(2);
    expect(second.status).toBe("playing");
    expect(second.collected).toBe(0);
    expect(second.items).toHaveLength(3);
    // Each level adds one carrier and one sprinkler.
    expect(second.carriers.length).toBe(first.carriers.length + 1);
    expect(second.sprinklers.length).toBe(first.sprinklers.length + 1);
  });

  it("carries score and remaining lives across the level change", () => {
    const first = createLevel(1);
    first.score = 1234;
    first.lives = 2;

    const second = advanceLevel(first);
    expect(second.score).toBe(1234);
    expect(second.lives).toBe(2);
  });

  it("scales hazard count with the level number", () => {
    const level1 = createLevel(1);
    const level3 = createLevel(3);
    expect(level3.carriers.length).toBe(level1.carriers.length + 2);
    expect(level3.sprinklers.length).toBe(level1.sprinklers.length + 2);
  });

  it("starts a fresh run at level 1", () => {
    expect(createGame().level).toBe(1);
  });
});
