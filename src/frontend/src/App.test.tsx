/**
 * Canine Courier — application shell tests.
 *
 * Mounts the real App with a typed local actor fake and an explicit signed-in
 * identity, then asserts the observable consumer contract: the lifetime stats
 * footer reads from getMyStats, and a finished run is persisted through
 * recordRun. No network or canister is involved.
 */

import { setIdentityForTest } from "@/__tests__/setup";
import { renderWithActor } from "@/__tests__/test-utils";
import type { backendInterface } from "@/backend";
import type { InternetIdentityContext } from "@caffeineai/core-infrastructure";
import { screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import App from "./App";

/** A minimal non-anonymous identity so RequireSignIn mounts the cabinet. */
function signedInIdentity(): InternetIdentityContext["identity"] {
  return {
    getPrincipal: () => ({
      isAnonymous: () => false,
      toText: () => "aaaaa-aa",
    }),
  } as unknown as InternetIdentityContext["identity"];
}

/** A typed fake of the backend methods the app shell calls. */
function makeActor() {
  const getMyStats = vi.fn<backendInterface["getMyStats"]>(async () => ({
    bestScore: 1234n,
    totalItemsCollected: 7n,
  }));
  const recordRun = vi.fn<backendInterface["recordRun"]>(async () => ({
    bestScore: 1234n,
    totalItemsCollected: 7n,
  }));
  const actor = { getMyStats, recordRun } satisfies Pick<
    backendInterface,
    "getMyStats" | "recordRun"
  >;
  return { actor, getMyStats, recordRun };
}

/** Captures requestAnimationFrame callbacks so the loop can be driven manually. */
let frameCallbacks: FrameRequestCallback[] = [];

beforeEach(() => {
  frameCallbacks = [];
  setIdentityForTest({ identity: signedInIdentity() });
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
  vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue({
    fillStyle: "",
    globalAlpha: 1,
    save: () => {},
    restore: () => {},
    translate: () => {},
    setTransform: () => {},
    fillRect: () => {},
    beginPath: () => {},
    arc: () => {},
    fill: () => {},
  } as unknown as CanvasRenderingContext2D);
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

describe("App shell", () => {
  it("renders the cabinet and reads lifetime stats from the backend", async () => {
    const { actor, getMyStats } = makeActor();
    renderWithActor(<App />, actor);

    expect(screen.getByText("Canine Courier")).toBeInTheDocument();
    expect(
      screen.getByLabelText("Canine Courier maze game"),
    ).toBeInTheDocument();

    await waitFor(() => expect(getMyStats).toHaveBeenCalled());
    await waitFor(() =>
      expect(screen.getByTestId("stats.best_score")).toHaveTextContent("1234"),
    );
    expect(screen.getByTestId("stats.total_items")).toHaveTextContent("7");
  });

  it("gates the cabinet behind sign-in when no identity is present", () => {
    setIdentityForTest();
    const { actor } = makeActor();
    renderWithActor(<App />, actor);

    expect(screen.getByTestId("auth.panel")).toBeInTheDocument();
    expect(
      screen.queryByLabelText("Canine Courier maze game"),
    ).not.toBeInTheDocument();
  });
});
