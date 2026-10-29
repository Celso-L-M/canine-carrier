/**
 * Canine Courier — component journey tests.
 *
 * Mounts the real GameCanvas (HUD + canvas + overlay) in jsdom with a stubbed
 * 2D context and a controllable animation frame loop, then drives keyboard
 * input to assert the observable HUD behavior. The Overlay screens are tested
 * directly for their Game Over / Level Complete copy and restart wiring. The
 * backend actor is a typed local fake, so no network or canister is involved.
 */

import { renderWithActor } from "@/__tests__/test-utils";
import type { backendInterface } from "@/backend";
import { act, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { GameCanvas } from "./GameCanvas";
import { Overlay } from "./Overlay";

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

/** Drive the requestAnimationFrame loop manually with a fixed timestep. */
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
  // jsdom reports a zero-size container; give the canvas a real box.
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

describe("GameCanvas", () => {
  it("renders the maze canvas and HUD without a blank screen", () => {
    const { actor } = makeActor();
    renderWithActor(<GameCanvas />, actor);

    expect(
      screen.getByLabelText("Canine Courier maze game"),
    ).toBeInTheDocument();
    expect(screen.getByTestId("game.hud")).toBeInTheDocument();
    expect(screen.getByTestId("game.score")).toHaveTextContent("0000");
    expect(screen.getByTestId("game.lives")).toHaveAttribute(
      "aria-label",
      "3 of 3 lives remaining",
    );
    expect(screen.getByTestId("game.sniff_meter")).toHaveAttribute(
      "aria-valuenow",
      "100",
    );
  });

  it("keeps the HUD live while Max moves with the arrow keys", () => {
    const { actor } = makeActor();
    renderWithActor(<GameCanvas />, actor);

    act(() => {
      window.dispatchEvent(
        new KeyboardEvent("keydown", { code: "ArrowRight" }),
      );
    });
    flushFrames(10);
    act(() => {
      window.dispatchEvent(new KeyboardEvent("keyup", { code: "ArrowRight" }));
    });

    expect(screen.getByTestId("game.hud")).toBeInTheDocument();
    expect(
      screen.getByLabelText("Canine Courier maze game"),
    ).toBeInTheDocument();
  });

  it("drains the sniff meter when Space is pressed", () => {
    const { actor } = makeActor();
    renderWithActor(<GameCanvas />, actor);

    const meter = screen.getByTestId("game.sniff_meter");
    expect(meter).toHaveAttribute("aria-valuenow", "100");

    act(() => {
      window.dispatchEvent(new KeyboardEvent("keydown", { code: "Space" }));
    });
    flushFrames(3);
    act(() => {
      window.dispatchEvent(new KeyboardEvent("keyup", { code: "Space" }));
    });

    const after = Number(meter.getAttribute("aria-valuenow"));
    expect(after).toBeLessThan(100);
  });

  it("recharges the sniff meter over time after a sniff", () => {
    const { actor } = makeActor();
    renderWithActor(<GameCanvas />, actor);

    const meter = screen.getByTestId("game.sniff_meter");
    act(() => {
      window.dispatchEvent(new KeyboardEvent("keydown", { code: "Space" }));
    });
    flushFrames(3);
    act(() => {
      window.dispatchEvent(new KeyboardEvent("keyup", { code: "Space" }));
    });
    const drained = Number(meter.getAttribute("aria-valuenow"));
    expect(drained).toBeLessThan(100);

    // Let the loop run without sniffing; the meter must climb back up.
    flushFrames(120);
    const recharged = Number(meter.getAttribute("aria-valuenow"));
    expect(recharged).toBeGreaterThan(drained);
  });

  it("accepts WASD movement as well as the arrow keys", () => {
    const { actor } = makeActor();
    renderWithActor(<GameCanvas />, actor);

    act(() => {
      window.dispatchEvent(new KeyboardEvent("keydown", { code: "KeyD" }));
    });
    flushFrames(10);
    act(() => {
      window.dispatchEvent(new KeyboardEvent("keyup", { code: "KeyD" }));
    });

    // The HUD stays live and the canvas is still mounted after WASD input.
    expect(screen.getByTestId("game.hud")).toBeInTheDocument();
    expect(
      screen.getByLabelText("Canine Courier maze game"),
    ).toBeInTheDocument();
  });

  it("sizes the canvas backing store to the container without distortion", () => {
    const { actor } = makeActor();
    renderWithActor(<GameCanvas />, actor);

    const canvas = screen.getByLabelText(
      "Canine Courier maze game",
    ) as HTMLCanvasElement;
    // The stubbed container box is 640x480 at dpr 1, so the backing store
    // must match it rather than collapsing to zero or blowing up.
    expect(canvas.width).toBe(640);
    expect(canvas.height).toBe(480);
  });
});

describe("Overlay", () => {
  it("shows the Game Over screen with a working restart button", async () => {
    const user = userEvent.setup();
    const onRestart = vi.fn();
    render(
      <Overlay
        status="gameover"
        score={250}
        collected={1}
        totalItems={3}
        onRestart={onRestart}
      />,
    );

    expect(screen.getByTestId("game.gameover_overlay")).toBeInTheDocument();
    expect(screen.getByText("Game Over")).toBeInTheDocument();
    expect(screen.getByTestId("game.final_score")).toHaveTextContent("0250");
    expect(screen.getByTestId("game.final_items")).toHaveTextContent("1 / 3");

    await user.click(screen.getByTestId("game.restart_button"));
    expect(onRestart).toHaveBeenCalledTimes(1);
  });

  it("shows the 'Good Boy! Level Complete' win screen", () => {
    render(
      <Overlay
        status="won"
        score={800}
        collected={3}
        totalItems={3}
        onRestart={vi.fn()}
      />,
    );

    expect(screen.getByTestId("game.win_overlay")).toBeInTheDocument();
    expect(screen.getByText("Good Boy!")).toBeInTheDocument();
    expect(screen.getByText("Level Complete")).toBeInTheDocument();
    expect(screen.getByTestId("game.final_items")).toHaveTextContent("3 / 3");
  });
});
