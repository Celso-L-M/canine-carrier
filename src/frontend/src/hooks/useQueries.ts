/**
 * Canine Courier — backend query and mutation hooks.
 *
 * All persistence (best score, total items collected, and player settings)
 * flows through the generated actor bindings. React Query owns the cache.
 */

import { createActor } from "@/backend";
import type { PlayerSettings, PlayerStats } from "@/backend";
import { useActor } from "@caffeineai/core-infrastructure";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

/** The caller's best score and lifetime items collected. */
export function useMyStats() {
  const { actor, isFetching } = useActor(createActor);
  return useQuery<PlayerStats | null>({
    queryKey: ["myStats"],
    queryFn: async () => {
      if (!actor) return null;
      return actor.getMyStats();
    },
    enabled: !!actor && !isFetching,
  });
}

/** The caller's saved control scheme and sound preference. */
export function useMySettings() {
  const { actor, isFetching } = useActor(createActor);
  return useQuery<PlayerSettings | null>({
    queryKey: ["mySettings"],
    queryFn: async () => {
      if (!actor) return null;
      return actor.getMySettings();
    },
    enabled: !!actor && !isFetching,
  });
}

/** Record a finished run and refresh the stats cache. */
export function useRecordRun() {
  const { actor } = useActor(createActor);
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({
      score,
      itemsCollected,
    }: {
      score: number;
      itemsCollected: number;
    }) => {
      if (!actor) throw new Error("Backend is not ready");
      return actor.recordRun(BigInt(score), BigInt(itemsCollected));
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["myStats"] });
    },
  });
}

/** Persist the caller's settings and refresh the settings cache. */
export function useSaveSettings() {
  const { actor } = useActor(createActor);
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (value: PlayerSettings) => {
      if (!actor) throw new Error("Backend is not ready");
      return actor.saveMySettings(value);
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["mySettings"] });
    },
  });
}
