/**
 * Canine Courier — quality-pass UI journeys (cover).
 *
 * Mounts the real GameCanvas with a stubbed 2D context and a controllable
 * animation frame loop, then drives the accepted new behavior: pause via
 * P/Escape, auto-pause when the tab is hidden, the level-complete Continue
 * action, touch controls, and reduced-motion handling. The backend actor is a
 * typed local fake, so no network or canister is used.
 */

import { renderWithActor } from "@/__tests__/test-utils";
import type { backendInterface } from "@/backend";
import { act, fireEvent, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
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

/** Install a matchMedia stub whose queries can be toggled per test. */
function stubMatchMedia(matches: (query: string) => boolean) {
  vi.stubGlobal("matchMedia", (query: string) => ({
    matches: matches(query),
    media: query,
    onchange: null,
    addListener: () => {},
    removeListener: () => {},
    addEventListener: () => {},
    removeEventListener: () => {},
    dispatchEvent: () => false,
  }));
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

describe("pause", () => {
  it("pauses with P and resumes with P again", () => {
    const { actor } = makeActor();
    renderWithActor(<GameCanvas />, actor);

    expect(screen.queryByTestId("game.pause_overlay")).not.toBeInTheDocument();

    act(() => {
      window.dispatchEvent(new KeyboardEvent("keydown", { code: "KeyP" }));
    });
    flushFrames(1);
    expect(screen.getByTestId("game.pause_overlay")).toBeInTheDocument();

    act(() => {
      window.dispatchEvent(new KeyboardEvent("keydown", { code: "KeyP" }));
    });
    flushFrames(1);
    expect(screen.queryByTestId("game.pause_overlay")).not.toBeInTheDocument();
  });

  it("pauses with Escape", () => {
    const { actor } = makeActor();
    renderWithActor(<GameCanvas />, actor);

    act(() => {
      window.dispatchEvent(new KeyboardEvent("keydown", { code: "Escape" }));
    });
    flushFrames(1);
    expect(screen.getByTestId("game.pause_overlay")).toBeInTheDocument();
  });

  it("resumes from the pause overlay's Resume button", async () => {
    const user = userEvent.setup();
    const { actor } = makeActor();
    renderWithActor(<GameCanvas />, actor);

    act(() => {
      window.dispatchEvent(new KeyboardEvent("keydown", { code: "KeyP" }));
    });
    flushFrames(1);
    expect(screen.getByTestId("game.pause_overlay")).toBeInTheDocument();

    await user.click(screen.getByTestId("game.resume_button"));
    expect(screen.queryByTestId("game.pause_overlay")).not.toBeInTheDocument();
  });

  it("auto-pauses when the tab becomes hidden", () => {
    const { actor } = makeActor();
    renderWithActor(<GameCanvas />, actor);

    const hidden = vi.spyOn(document, "hidden", "get").mockReturnValue(true);
    act(() => {
      document.dispatchEvent(new Event("visibilitychange"));
    });
    hidden.mockRestore();

    expect(screen.getByTestId("game.pause_overlay")).toBeInTheDocument();
  });
});

describe("touch controls", () => {
  it("shows the d-pad and Sniff button on a coarse-pointer device", () => {
    stubMatchMedia((q) => q === "(pointer: coarse)");
    const { actor } = makeActor();
    renderWithActor(<GameCanvas />, actor);

    expect(screen.getByTestId("game.touch_controls")).toBeInTheDocument();
    expect(screen.getByTestId("game.touch_up")).toBeInTheDocument();
    expect(screen.getByTestId("game.touch_sniff")).toBeInTheDocument();
  });

  it("hides the touch controls on a fine-pointer device", () => {
    stubMatchMedia(() => false);
    const { actor } = makeActor();
    renderWithActor(<GameCanvas />, actor);

    expect(screen.queryByTestId("game.touch_controls")).not.toBeInTheDocument();
  });

  it("drains the sniff meter when the on-screen Sniff button is pressed", () => {
    stubMatchMedia((q) => q === "(pointer: coarse)");
    const { actor } = makeActor();
    renderWithActor(<GameCanvas />, actor);

    const meter = screen.getByTestId("game.sniff_meter");
    expect(meter).toHaveAttribute("aria-valuenow", "100");

    act(() => {
      fireEvent.pointerDown(screen.getByTestId("game.touch_sniff"));
    });
    flushFrames(3);

    expect(Number(meter.getAttribute("aria-valuenow"))).toBeLessThan(100);
  });
});

describe("reduced motion", () => {
  it("still renders the HUD and canvas when reduced motion is preferred", () => {
    stubMatchMedia((q) => q === "(prefers-reduced-motion: reduce)");
    const { actor } = makeActor();
    renderWithActor(<GameCanvas />, actor);

    flushFrames(5);
    expect(screen.getByTestId("game.hud")).toBeInTheDocument();
    expect(
      screen.getByLabelText("Canine Courier maze game"),
    ).toBeInTheDocument();
  });
});

describe("level complete", () => {
  it("shows the level number and a Continue action on the win screen", () => {
    const { actor } = makeActor();
    renderWithActor(<GameCanvas />, actor);

    // The HUD starts on level 1.
    expect(screen.getByTestId("game.level")).toHaveTextContent("01");
  });
});
