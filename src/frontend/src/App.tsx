/**
 * Canine Courier — application shell.
 *
 * Wraps the game in the arcade-cabinet layout: a compact header, the
 * full-viewport canvas stage, and a footer with the player's lifetime stats.
 * Persistence requires an identity, so the game lives inside AuthenticatedApp.
 */

import { AuthenticatedApp, SignInButton } from "@/components/InternetIdentity";
import { GameCanvas } from "@/components/game/GameCanvas";
import { useMyStats, useRecordRun } from "@/hooks/useQueries";
import { useCallback } from "react";

/** Lifetime stats strip shown under the cabinet. */
function StatsFooter() {
  const { data: stats } = useMyStats();
  return (
    <footer className="flex items-center justify-center gap-4 text-arcade text-[10px] text-muted-foreground sm:text-xs">
      <span data-ocid="stats.best_score">
        Best {String(Number(stats?.bestScore ?? 0)).padStart(4, "0")}
      </span>
      <span aria-hidden="true">•</span>
      <span data-ocid="stats.total_items">
        Items {Number(stats?.totalItemsCollected ?? 0)}
      </span>
    </footer>
  );
}

/** The playable cabinet: header, canvas stage, stats footer. */
function ArcadeCabinet() {
  const recordRun = useRecordRun();

  // Persist each finished run to the backend.
  const handleRunEnd = useCallback(
    (score: number, itemsCollected: number) => {
      recordRun.mutate({ score, itemsCollected });
    },
    [recordRun],
  );

  return (
    // `h-dvh` (not `min-h-dvh`) gives the column a definite height so the
    // canvas stage can actually fill the leftover space instead of collapsing.
    <div className="flex h-dvh flex-col overflow-hidden bg-background">
      <header className="flex shrink-0 items-center justify-between border-b-4 border-border bg-card px-4 py-3 shadow-pixel">
        <h1 className="text-arcade text-base text-primary sm:text-xl">
          Canine Courier
        </h1>
        <SignInButton className="pixel-button px-3 py-2 text-[10px] sm:text-xs" />
      </header>

      {/* `min-h-0` lets this flex child shrink below its content size so the
          canvas stage is bounded by the viewport, not by the canvas itself. */}
      <main className="mx-auto flex w-full max-w-3xl min-h-0 flex-1 flex-col gap-3 p-3 sm:p-5">
        <GameCanvas onRunEnd={handleRunEnd} />
      </main>

      <div className="shrink-0 border-t-4 border-border bg-card px-4 py-3">
        <StatsFooter />
      </div>
    </div>
  );
}

export default function App() {
  return (
    <AuthenticatedApp
      title="Canine Courier"
      description="Sign in with Internet Identity to save your best score and track every lost item Max recovers."
      className="flex min-h-dvh flex-col items-center justify-center gap-4 bg-background px-6 text-center text-foreground"
      buttonClassName="pixel-button px-6 py-3 text-sm"
    >
      <ArcadeCabinet />
    </AuthenticatedApp>
  );
}
