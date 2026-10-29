/**
 * Canine Courier — canvas host component.
 *
 * Owns the requestAnimationFrame loop, wires keyboard + touch input to the
 * engine, and renders the HUD + overlay around the canvas. The canvas is sized
 * to its container with a device-pixel-ratio-aware backing store so it stays
 * crisp and undistorted at any screen size.
 */

import { CONFIG, advanceLevel, createGame, step } from "@/game/engine";
import { createExternalInput, createInput } from "@/game/input";
import { render } from "@/game/render";
import type { GameState } from "@/game/types";
import { useCallback, useEffect, useRef, useState } from "react";
import { Hud } from "./Hud";
import { Overlay } from "./Overlay";
import { TouchControls } from "./TouchControls";

interface GameCanvasProps {
  /** Called once when a run ends, with the final score and items collected. */
  onRunEnd?: (score: number, itemsCollected: number) => void;
}

/** Snapshot of the values the HUD needs, refreshed each frame. */
interface HudSnapshot {
  score: number;
  lives: number;
  sniff: number;
  status: GameState["status"];
  collected: number;
  totalItems: number;
  level: number;
  losingLife: boolean;
}

/** True when the device reports a coarse pointer (touch-first). */
function detectTouch(): boolean {
  if (typeof window === "undefined" || !window.matchMedia) return false;
  return window.matchMedia("(pointer: coarse)").matches;
}

/** True when the user has asked the OS to reduce motion. */
function detectReducedMotion(): boolean {
  if (typeof window === "undefined" || !window.matchMedia) return false;
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

export function GameCanvas({ onRunEnd }: GameCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const stateRef = useRef<GameState>(createGame());
  const reportedRef = useRef(false);
  // Shared touch-input channel, written by TouchControls and read by the loop.
  const externalRef = useRef(createExternalInput());

  // Keep the latest callback in a ref so the game loop never restarts when
  // the parent re-renders with a new function identity.
  const onRunEndRef = useRef(onRunEnd);
  onRunEndRef.current = onRunEnd;

  const [hud, setHud] = useState<HudSnapshot>(() => snapshot(stateRef.current));
  const [paused, setPaused] = useState(false);
  const [isTouch, setIsTouch] = useState(detectTouch);
  const [reducedMotion, setReducedMotion] = useState(detectReducedMotion);

  // Keep the pause flag readable inside the RAF loop without restarting it.
  const pausedRef = useRef(paused);
  pausedRef.current = paused;
  const reducedMotionRef = useRef(reducedMotion);
  reducedMotionRef.current = reducedMotion;

  /** Restart the run from level 1 with a fresh maze. */
  const restart = useCallback(() => {
    stateRef.current = createGame();
    reportedRef.current = false;
    setPaused(false);
    setHud(snapshot(stateRef.current));
  }, []);

  /** Advance to the next level, keeping score and lives. */
  const continueLevel = useCallback(() => {
    stateRef.current = advanceLevel(stateRef.current);
    setPaused(false);
    setHud(snapshot(stateRef.current));
  }, []);

  /** Toggle pause (used by the P/Escape key and the pause overlay). */
  const togglePause = useCallback(() => {
    setPaused((p) => !p);
  }, []);

  // React to pointer-type and reduced-motion preference changes.
  useEffect(() => {
    if (typeof window === "undefined" || !window.matchMedia) return;
    const coarse = window.matchMedia("(pointer: coarse)");
    const motion = window.matchMedia("(prefers-reduced-motion: reduce)");
    const onCoarse = () => setIsTouch(coarse.matches);
    const onMotion = () => setReducedMotion(motion.matches);
    coarse.addEventListener("change", onCoarse);
    motion.addEventListener("change", onMotion);
    return () => {
      coarse.removeEventListener("change", onCoarse);
      motion.removeEventListener("change", onMotion);
    };
  }, []);

  // Auto-pause when the tab loses focus so the run is never lost off-screen.
  useEffect(() => {
    const onVisibility = () => {
      if (document.hidden) setPaused(true);
    };
    const onWindowBlur = () => setPaused(true);
    document.addEventListener("visibilitychange", onVisibility);
    window.addEventListener("blur", onWindowBlur);
    return () => {
      document.removeEventListener("visibilitychange", onVisibility);
      window.removeEventListener("blur", onWindowBlur);
    };
  }, []);

  // Main game loop: fixed-timestep simulation + render.
  useEffect(() => {
    const canvas = canvasRef.current;
    const container = containerRef.current;
    if (!canvas || !container) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const input = createInput(window, externalRef.current);
    let raf = 0;
    let last = performance.now();

    // Resize the backing store to match the container at device pixel ratio.
    // The canvas element itself is sized by CSS (`absolute inset-0`), so we
    // only sync the pixel buffer here — never the element's layout size, which
    // is what previously fed back into the container and blew it up.
    const resize = () => {
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      const rect = container.getBoundingClientRect();
      const width = Math.max(1, Math.floor(rect.width * dpr));
      const height = Math.max(1, Math.floor(rect.height * dpr));
      if (canvas.width !== width) canvas.width = width;
      if (canvas.height !== height) canvas.height = height;
    };
    resize();

    const observer = new ResizeObserver(resize);
    observer.observe(container);

    const frame = (now: number) => {
      const dt = Math.min((now - last) / 1000, 0.05);
      last = now;

      const state = stateRef.current;
      const { direction, sniffPressed, pausePressed } = input.read();

      // Pause toggles from the keyboard, and the loop freezes while paused.
      if (pausePressed && state.status === "playing") {
        setPaused((p) => !p);
      }
      if (!pausedRef.current) {
        step(state, direction, sniffPressed, dt);
      }

      // Report the finished run exactly once — only when all lives are lost.
      if (state.status === "gameover" && !reportedRef.current) {
        reportedRef.current = true;
        onRunEndRef.current?.(state.score, state.collected);
      }

      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      render(
        ctx,
        state,
        canvas.width / dpr,
        canvas.height / dpr,
        reducedMotionRef.current,
      );

      setHud(snapshot(state));
      raf = requestAnimationFrame(frame);
    };
    raf = requestAnimationFrame(frame);

    return () => {
      cancelAnimationFrame(raf);
      observer.disconnect();
      input.dispose();
    };
  }, []);

  // The overlay shows the pause screen while paused, otherwise the run status.
  const overlayStatus = paused ? "paused" : hud.status;

  return (
    // `min-h-0` + `flex-1` lets this column shrink to the space its parent
    // actually has, so the canvas stage is bounded by the viewport.
    <div className="flex min-h-0 w-full flex-1 flex-col gap-3">
      <Hud
        score={hud.score}
        lives={hud.lives}
        sniff={hud.sniff}
        maxLives={3}
        level={hud.level}
        losingLife={hud.losingLife}
      />

      <div
        ref={containerRef}
        data-ocid="game.canvas_target"
        className="relative min-h-0 flex-1 overflow-hidden border-4 border-border bg-background shadow-pixel-lg"
      >
        {/* The canvas is absolutely positioned so its backing-store size can
            never feed back into the container's layout height (which caused
            the runaway 12000px canvas). The container alone defines the box. */}
        <canvas
          ref={canvasRef}
          className="absolute inset-0 block h-full w-full"
          aria-label="Canine Courier maze game"
        />
        {overlayStatus !== "playing" && (
          <Overlay
            status={overlayStatus}
            score={hud.score}
            collected={hud.collected}
            totalItems={hud.totalItems}
            level={hud.level}
            onRestart={restart}
            onContinue={continueLevel}
            onResume={togglePause}
          />
        )}
      </div>

      {/* Touch controls only appear on coarse-pointer devices. */}
      {isTouch && <TouchControls input={externalRef.current} />}

      <p className="text-arcade text-center text-[10px] text-muted-foreground sm:text-xs">
        WASD / Arrows to move — Space to sniff
      </p>
      <p
        data-ocid="game.how_to_play"
        className="text-arcade text-center text-[10px] text-muted-foreground sm:text-xs"
      >
        How to Play: Move with WASD or Arrows · Sniff with Space · Pause with P
        or Esc
      </p>
    </div>
  );
}

/** Build a HUD snapshot from the live game state. */
function snapshot(state: GameState): HudSnapshot {
  return {
    score: state.score,
    lives: state.lives,
    sniff: state.sniff,
    status: state.status,
    collected: state.collected,
    totalItems: state.items.length,
    level: state.level ?? 1,
    losingLife: (state.heartLoss ?? 0) > 0,
  };
}

/** Expose the level bonus for the win screen copy. */
export const LEVEL_BONUS = CONFIG.levelBonus;
