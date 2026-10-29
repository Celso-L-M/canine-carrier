/**
 * Canine Courier — backend behavior lane (PocketIC).
 *
 * Installs the app's own compiled wasm into the platform's PocketIC replica and
 * calls the real public API. This is the only place the backend is exercised:
 * the frontend suite mocks the actor, so it would pass against a canister whose
 * methods all trap.
 *
 * The declarations' shapes apply here, not the app wrapper's: `?T` is `[] | [T]`,
 * `Nat` is `bigint`, and a unit return decodes to `null`.
 */

import { PocketIc, createIdentity } from "@dfinity/pic";
import type { Actor, CanisterFixture } from "@dfinity/pic";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { idlFactory } from "../../src/frontend/src/declarations/backend.did.js";
import type { _SERVICE } from "../../src/frontend/src/declarations/backend.did";

const PIC_URL = process.env.POCKET_IC_URL ?? "";
const BACKEND_WASM = process.env.BACKEND_WASM ?? "";

let pic: PocketIc | undefined;
let actor: Actor<_SERVICE>;
let canisterId: CanisterFixture<_SERVICE>["canisterId"];

beforeAll(async () => {
  pic = await PocketIc.create(PIC_URL);
  ({ actor, canisterId } = await pic.setupCanister<_SERVICE>({
    idlFactory,
    wasm: BACKEND_WASM,
  }));
});

afterAll(async () => {
  await pic?.tearDown();
});

describe("Canine Courier backend", () => {
  it("answers an empty-state stats read instead of trapping", async () => {
    await expect(actor.getMyStats()).resolves.toEqual([]);
  });

  it("answers an empty-state settings read instead of trapping", async () => {
    await expect(actor.getMySettings()).resolves.toEqual([]);
  });

  it("round-trips a run through recordRun and getMyStats", async () => {
    const stats = await actor.recordRun(300n, 2n);
    expect(stats).toEqual({ bestScore: 300n, totalItemsCollected: 2n });

    const read = await actor.getMyStats();
    expect(read).toEqual([{ bestScore: 300n, totalItemsCollected: 2n }]);
  });

  it("keeps the higher score and accumulates collected items across runs", async () => {
    // A lower score must not replace the best, but items still accumulate.
    const lower = await actor.recordRun(100n, 1n);
    expect(lower.bestScore).toBe(300n);
    expect(lower.totalItemsCollected).toBe(3n);

    // A higher score replaces the best.
    const higher = await actor.recordRun(900n, 1n);
    expect(higher.bestScore).toBe(900n);
    expect(higher.totalItemsCollected).toBe(4n);
  });

  it("round-trips settings through saveMySettings and getMySettings", async () => {
    const saved = await actor.saveMySettings({
      controlScheme: { wasd: null },
      soundEnabled: false,
    });
    expect(saved).toEqual({
      controlScheme: { wasd: null },
      soundEnabled: false,
    });

    const read = await actor.getMySettings();
    expect(read).toEqual([
      { controlScheme: { wasd: null }, soundEnabled: false },
    ]);
  });

  it("keeps each caller's stats isolated", async () => {
    // A distinct caller starts with no stats of their own.
    const other = pic!.createActor<_SERVICE>(idlFactory, canisterId);
    other.setIdentity(createIdentity("bob"));
    await expect(other.getMyStats()).resolves.toEqual([]);
  });
});
