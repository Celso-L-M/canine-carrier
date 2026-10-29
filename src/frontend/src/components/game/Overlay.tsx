/**
 * Canine Courier — overlay screens.
 *
 * Renders the Level Complete, Game Over and Pause states on top of the canvas.
 * Level Complete offers a Continue action that advances to the next level;
 * Game Over and Pause offer a restart.
 */

interface OverlayProps {
  status: "gameover" | "won" | "paused";
  score: number;
  collected: number;
  totalItems: number;
  onRestart: () => void;
  /** Level just cleared / reached, shown on the win and game-over screens. */
  level?: number;
  /** Advance to the next level (Level Complete only). */
  onContinue?: () => void;
  /** Resume play (Pause only). */
  onResume?: () => void;
}

export function Overlay({
  status,
  score,
  collected,
  totalItems,
  onRestart,
  level = 1,
  onContinue,
  onResume,
}: OverlayProps) {
  const won = status === "won";
  const paused = status === "paused";

  const ocid = won
    ? "game.win_overlay"
    : paused
      ? "game.pause_overlay"
      : "game.gameover_overlay";

  const heading = won ? "Good Boy!" : paused ? "Paused" : "Game Over";
  const sub = won
    ? "Level Complete"
    : paused
      ? "Take a breather"
      : "Max is out of lives";

  return (
    <div
      data-ocid={ocid}
      className="absolute inset-0 z-10 flex items-center justify-center bg-background/85 p-4"
    >
      <div className="pixel-panel animate-pixel-pop flex w-full max-w-sm flex-col items-center gap-4 px-6 py-8 text-center">
        <h2
          className={`text-arcade text-2xl sm:text-3xl ${
            won ? "text-primary" : paused ? "text-accent" : "text-destructive"
          }`}
        >
          {heading}
        </h2>
        <p className="text-arcade text-sm text-accent">{sub}</p>

        <dl className="w-full space-y-1 text-arcade text-xs text-foreground">
          <div className="flex justify-between">
            <dt>Level</dt>
            <dd data-ocid="game.final_level">
              {String(level).padStart(2, "0")}
            </dd>
          </div>
          <div className="flex justify-between">
            <dt>Score</dt>
            <dd data-ocid="game.final_score">
              {String(score).padStart(4, "0")}
            </dd>
          </div>
          <div className="flex justify-between">
            <dt>Items Found</dt>
            <dd data-ocid="game.final_items">
              {collected} / {totalItems}
            </dd>
          </div>
        </dl>

        <div className="mt-2 flex flex-wrap items-center justify-center gap-3">
          {won && onContinue && (
            <button
              type="button"
              data-ocid="game.continue_button"
              onClick={onContinue}
              className="pixel-button px-6 py-3 text-sm"
            >
              Continue
            </button>
          )}
          {paused && onResume && (
            <button
              type="button"
              data-ocid="game.resume_button"
              onClick={onResume}
              className="pixel-button px-6 py-3 text-sm"
            >
              Resume
            </button>
          )}
          <button
            type="button"
            data-ocid="game.restart_button"
            onClick={onRestart}
            className="pixel-button px-6 py-3 text-sm"
          >
            {won ? "Play Again" : "Restart"}
          </button>
        </div>
      </div>
    </div>
  );
}
