/**
 * Canine Courier — keyboard + touch input.
 *
 * Tracks the currently held movement keys and exposes a single direction
 * vector plus a one-shot Sniff trigger. WASD and Arrow keys are equivalent.
 * An optional `ExternalInput` channel lets the on-screen touch controls feed
 * the same direction/sniff signals without a keyboard.
 */

import type { Vec2 } from "./types";

export interface InputState {
  /** Normalised movement direction for this frame. */
  direction: Vec2;
  /** True on the frame the Sniff key was pressed. */
  sniffPressed: boolean;
  /** True on the frame P or Escape was pressed (pause toggle). */
  pausePressed: boolean;
}

/** Mutable channel the touch controls write into. */
export interface ExternalInput {
  direction: Vec2;
  sniffQueued: boolean;
}

/** Create an empty external input channel for the touch controls. */
export function createExternalInput(): ExternalInput {
  return { direction: { x: 0, y: 0 }, sniffQueued: false };
}

const LEFT = new Set(["ArrowLeft", "KeyA"]);
const RIGHT = new Set(["ArrowRight", "KeyD"]);
const UP = new Set(["ArrowUp", "KeyW"]);
const DOWN = new Set(["ArrowDown", "KeyS"]);
const SNIFF = new Set(["Space"]);
const PAUSE = new Set(["KeyP", "Escape"]);

/** Attaches key listeners and returns a live input reader plus a detach fn. */
export function createInput(
  target: Window,
  external?: ExternalInput,
): {
  read: () => InputState;
  dispose: () => void;
} {
  const held = new Set<string>();
  let sniffQueued = false;
  let pauseQueued = false;

  const onKeyDown = (e: KeyboardEvent) => {
    // Stop the page from scrolling while playing.
    if (
      LEFT.has(e.code) ||
      RIGHT.has(e.code) ||
      UP.has(e.code) ||
      DOWN.has(e.code) ||
      SNIFF.has(e.code)
    ) {
      e.preventDefault();
    }
    if (SNIFF.has(e.code) && !e.repeat) sniffQueued = true;
    if (PAUSE.has(e.code) && !e.repeat) pauseQueued = true;
    held.add(e.code);
  };

  const onKeyUp = (e: KeyboardEvent) => {
    held.delete(e.code);
  };

  // Releasing focus should not leave keys stuck down.
  const onBlur = () => held.clear();

  target.addEventListener("keydown", onKeyDown);
  target.addEventListener("keyup", onKeyUp);
  target.addEventListener("blur", onBlur);

  return {
    read: () => {
      let x = 0;
      let y = 0;
      for (const code of held) {
        if (LEFT.has(code)) x -= 1;
        if (RIGHT.has(code)) x += 1;
        if (UP.has(code)) y -= 1;
        if (DOWN.has(code)) y += 1;
      }
      // Fold in any on-screen touch input.
      if (external) {
        x += external.direction.x;
        y += external.direction.y;
      }
      // Clamp to a unit vector so diagonals are not faster.
      const len = Math.hypot(x, y);
      const direction: Vec2 =
        len > 0 ? { x: x / len, y: y / len } : { x: 0, y: 0 };
      const sniffPressed = sniffQueued || (external?.sniffQueued ?? false);
      sniffQueued = false;
      if (external) external.sniffQueued = false;
      const pausePressed = pauseQueued;
      pauseQueued = false;
      return { direction, sniffPressed, pausePressed };
    },
    dispose: () => {
      target.removeEventListener("keydown", onKeyDown);
      target.removeEventListener("keyup", onKeyUp);
      target.removeEventListener("blur", onBlur);
    },
  };
}
