/**
 * Canine Courier — arcade HUD.
 *
 * Shows level, score, remaining lives (hearts) and the Sniff meter. Styled as
 * a chunky pixel panel using the shared design tokens. The heart that was just
 * lost plays a short shake-and-fade animation.
 */

interface HudProps {
  score: number;
  lives: number;
  /** Sniff charge, 0..1. */
  sniff: number;
  /** Total lives Max starts with, used to render empty hearts. */
  maxLives: number;
  /** Current level number. */
  level: number;
  /** True while the heart-loss animation is playing. */
  losingLife: boolean;
}

/** A single pixel heart, filled or empty. */
function Heart({ filled, losing }: { filled: boolean; losing: boolean }) {
  return (
    <svg
      viewBox="0 0 16 16"
      className={`h-6 w-6 sm:h-7 sm:w-7 ${losing ? "animate-heart-loss" : ""}`}
      aria-hidden="true"
      shapeRendering="crispEdges"
    >
      <path
        d="M2 4h3v2h2V4h2v2h2V4h3v2h1v4h-1v2h-2v2H8v2H6v-2H4v-2H3V8H2V6h0z"
        fill={filled ? "oklch(var(--accent))" : "transparent"}
        stroke={
          filled ? "oklch(0.1 0.02 155)" : "oklch(var(--muted-foreground))"
        }
        strokeWidth="1"
      />
    </svg>
  );
}

export function Hud({
  score,
  lives,
  sniff,
  maxLives,
  level,
  losingLife,
}: HudProps) {
  const pct = Math.round(sniff * 100);
  return (
    <div
      data-ocid="game.hud"
      className="pixel-panel flex w-full items-center justify-between gap-2 px-3 py-2 sm:gap-5 sm:px-5 sm:py-3"
    >
      {/* Level */}
      <div className="flex flex-col">
        <span className="text-arcade text-[10px] text-accent sm:text-xs">
          Level
        </span>
        <span
          data-ocid="game.level"
          className="text-arcade text-lg leading-none text-foreground sm:text-2xl"
        >
          {String(level).padStart(2, "0")}
        </span>
      </div>

      {/* Score */}
      <div className="flex flex-col">
        <span className="text-arcade text-[10px] text-accent sm:text-xs">
          Score
        </span>
        <span
          data-ocid="game.score"
          className="text-arcade text-lg leading-none text-foreground sm:text-2xl"
        >
          {String(score).padStart(4, "0")}
        </span>
      </div>

      {/* Lives */}
      <div className="flex flex-col items-center">
        <span className="text-arcade text-[10px] text-accent sm:text-xs">
          Lives
        </span>
        <div
          data-ocid="game.lives"
          className="flex items-center gap-0.5"
          aria-label={`${lives} of ${maxLives} lives remaining`}
        >
          {Array.from({ length: maxLives }, (_, i) => `heart-${i}`).map(
            (id, i) => (
              <Heart
                key={id}
                filled={i < lives}
                // Animate the heart that was just lost (the first empty one).
                losing={losingLife && i === lives}
              />
            ),
          )}
        </div>
      </div>

      {/* Sniff meter */}
      <div className="flex min-w-0 flex-1 flex-col items-end">
        <span className="text-arcade text-[10px] text-accent sm:text-xs">
          Sniff
        </span>
        <div
          data-ocid="game.sniff_meter"
          role="meter"
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={pct}
          aria-label="Sniff meter"
          className="h-3 w-full max-w-[160px] border-2 border-border bg-background sm:h-4"
        >
          <div
            className="sniff-fill h-full transition-[width] duration-100"
            style={{ width: `${pct}%` }}
          />
        </div>
      </div>
    </div>
  );
}
