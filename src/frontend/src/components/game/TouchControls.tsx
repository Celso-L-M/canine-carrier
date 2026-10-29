/**
 * Canine Courier — on-screen touch controls.
 *
 * A directional pad plus a Sniff button for pointer/coarse devices. The pad
 * writes into the shared `ExternalInput` channel so the game loop reads touch
 * and keyboard input through the same path. Hidden on fine-pointer devices.
 */

import type { ExternalInput } from "@/game/input";
import type { Vec2 } from "@/game/types";
import { useCallback } from "react";

interface TouchControlsProps {
  /** Shared input channel the game loop reads each frame. */
  input: ExternalInput;
}

/** One direction button on the pad. */
function PadButton({
  label,
  ocid,
  dir,
  input,
}: {
  label: string;
  ocid: string;
  dir: Vec2;
  input: ExternalInput;
}) {
  const press = useCallback(() => {
    input.direction = dir;
  }, [input, dir]);

  const release = useCallback(() => {
    input.direction = { x: 0, y: 0 };
  }, [input]);

  return (
    <button
      type="button"
      data-ocid={ocid}
      aria-label={label}
      onPointerDown={(e) => {
        e.preventDefault();
        press();
      }}
      onPointerUp={release}
      onPointerLeave={release}
      onPointerCancel={release}
      className="pixel-button flex h-12 w-12 items-center justify-center text-base sm:h-14 sm:w-14"
    >
      {label}
    </button>
  );
}

export function TouchControls({ input }: TouchControlsProps) {
  const sniff = useCallback(() => {
    input.sniffQueued = true;
  }, [input]);

  return (
    <div
      data-ocid="game.touch_controls"
      className="flex w-full items-center justify-between gap-4 px-1"
    >
      {/* Directional pad */}
      <div className="grid grid-cols-3 grid-rows-3 gap-1">
        <span />
        <PadButton
          label="▲"
          ocid="game.touch_up"
          dir={{ x: 0, y: -1 }}
          input={input}
        />
        <span />
        <PadButton
          label="◀"
          ocid="game.touch_left"
          dir={{ x: -1, y: 0 }}
          input={input}
        />
        <span />
        <PadButton
          label="▶"
          ocid="game.touch_right"
          dir={{ x: 1, y: 0 }}
          input={input}
        />
        <span />
        <PadButton
          label="▼"
          ocid="game.touch_down"
          dir={{ x: 0, y: 1 }}
          input={input}
        />
        <span />
      </div>

      {/* Sniff button */}
      <button
        type="button"
        data-ocid="game.touch_sniff"
        aria-label="Sniff"
        onPointerDown={(e) => {
          e.preventDefault();
          sniff();
        }}
        className="pixel-button flex h-16 w-16 items-center justify-center text-[10px] sm:h-20 sm:w-20 sm:text-xs"
      >
        Sniff
      </button>
    </div>
  );
}
