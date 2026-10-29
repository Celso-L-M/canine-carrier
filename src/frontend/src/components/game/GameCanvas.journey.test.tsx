/**
 * Canine Courier — run-end wiring journey (characterization).
 *
 * Mounts the real GameCanvas with a stubbed 2D context and a controllable
 * animation frame loop, then asserts the persistence contract the quality pass
 * must not change: a run that is still playing never reports a finished run.
 * The backend actor is a typed local fake, so no network or canister is used.
 */

import { renderWithActor } from "@/__tests__/test-utils";
import type { backendInterface } from "@/backend";
import { act, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { GameCanvas } from "./GameCanvas";

/** Minimal 2D context stub: the renderer only needs these calls to not throw. */
function stubContext(): CanvasRenderingContext2D {
  const noop = () => {};
  return {
    fillStyle: "",
    globalAlpha: 1,
    save: noop,
    restore: noop,
    translate: noop,
    setTransform: noop,
    fillRect: noop,
    beginPath: noop,
    arc: noop,
    fill: noop,
  } as unknown as CanvasRenderingContext2D;
}

/** A typed fake of the backend methods the app shell calls. */
function makeActor() {
  const getMyStats = vi.fn<backendInterface["getMyStats"]>(async () => null);
  const recordRun = vi.fn<backendInterface["recordRun"]>(async () => ({
    bestScore: 0n,
    totalItemsCollected: 0n,
  }));
  const actor = { getMyStats, recordRun } satisfies Pick<
    backendInterface,
    "getMyStats" | "recordRun"
  >;
  return { actor, getMyStats, recordRun };
}

let frameCallbacks: FrameRequestCallback[] = [];
let now = 0;

function flushFrames(count: number, dtMs = 16) {
  for (let i = 0; i < count; i++) {
    const cbs = frameCallbacks;
    frameCallbacks = [];
    now += dtMs;
    act(() => {
      for (const cb of cbs) cb(now);
    });
  }
}

beforeEach(() => {
  frameCallbacks = [];
  now = 0;
  vi.stubGlobal("requestAnimationFrame", (cb: FrameRequestCallback) => {
    frameCallbacks.push(cb);
    return frameCallbacks.length;
  });
  vi.stubGlobal("cancelAnimationFrame", () => {});
  vi.stubGlobal(
    "ResizeObserver",
    class {
      observe() {}
      unobserve() {}
      disconnect() {}
    },
  );
  vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue(
    stubContext(),
  );
  vi.spyOn(HTMLElement.prototype, "getBoundingClientRect").mockReturnValue({
    width: 640,
    height: 480,
    top: 0,
    left: 0,
    right: 640,
    bottom: 480,
    x: 0,
    y: 0,
    toJSON: () => ({}),
  } as DOMRect);
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("GameCanvas run-end wiring", () => {
  it("does not report a finished run while the game is still playing", () => {
    const { actor } = makeActor();
    const onRunEnd = vi.fn();
    renderWithActor(<GameCanvas onRunEnd={onRunEnd} />, actor);

    // Run a short stretch of the loop with no hazards reached.
    flushFrames(5);

    expect(screen.getByTestId("game.hud")).toBeInTheDocument();
    expect(onRunEnd).not.toHaveBeenCalled();
  });

  it("keeps the HUD and controls hint visible during play", () => {
    const { actor } = makeActor();
    renderWithActor(<GameCanvas />, actor);

    expect(screen.getByTestId("game.hud")).toBeInTheDocument();
    expect(screen.getByTestId("game.score")).toBeInTheDocument();
    expect(screen.getByTestId("game.lives")).toBeInTheDocument();
    expect(screen.getByTestId("game.sniff_meter")).toBeInTheDocument();
    expect(
      screen.getByText("WASD / Arrows to move — Space to sniff"),
    ).toBeInTheDocument();
  });
});
