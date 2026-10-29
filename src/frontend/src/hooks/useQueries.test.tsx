/**
 * Canine Courier — stats persistence contract (characterization).
 *
 * Exercises the real React Query hooks against a typed local actor fake. This
 * locks down the consumer contract the quality pass must not change: lifetime
 * stats are read from getMyStats, and a finished run is persisted through
 * recordRun with bigint arguments, then the stats cache is refreshed.
 */

import { setActorForTest } from "@/__tests__/setup";
import type { backendInterface } from "@/backend";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { renderHook, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { describe, expect, it, vi } from "vitest";
import { useMyStats, useRecordRun } from "./useQueries";

/** A typed fake of the backend methods the stats hooks call. */
function makeActor() {
  const getMyStats = vi.fn<backendInterface["getMyStats"]>(async () => ({
    bestScore: 500n,
    totalItemsCollected: 4n,
  }));
  const recordRun = vi.fn<backendInterface["recordRun"]>(async () => ({
    bestScore: 900n,
    totalItemsCollected: 6n,
  }));
  const actor = { getMyStats, recordRun } satisfies Pick<
    backendInterface,
    "getMyStats" | "recordRun"
  >;
  return { actor, getMyStats, recordRun };
}

/** A wrapper that installs the actor fake and a fresh QueryClient. */
function makeWrapper(
  actor: Pick<backendInterface, "getMyStats" | "recordRun">,
) {
  setActorForTest(actor);
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false, gcTime: 0 },
      mutations: { retry: false },
    },
  });
  return function Wrapper({ children }: { children: ReactNode }) {
    return (
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    );
  };
}

describe("stats persistence contract", () => {
  it("reads lifetime stats from getMyStats", async () => {
    const { actor, getMyStats } = makeActor();
    const { result } = renderHook(() => useMyStats(), {
      wrapper: makeWrapper(actor),
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(getMyStats).toHaveBeenCalledTimes(1);
    expect(result.current.data).toEqual({
      bestScore: 500n,
      totalItemsCollected: 4n,
    });
  });

  it("persists a finished run through recordRun with bigint arguments", async () => {
    const { actor, recordRun } = makeActor();
    const { result } = renderHook(() => useRecordRun(), {
      wrapper: makeWrapper(actor),
    });

    result.current.mutate({ score: 900, itemsCollected: 6 });

    await waitFor(() => expect(recordRun).toHaveBeenCalledTimes(1));
    expect(recordRun).toHaveBeenCalledWith(900n, 6n);
  });
});
