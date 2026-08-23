import { managedRelaySessionAtom } from "@kairo/client-runtime/relay";
import { it as effectIt } from "@effect/vitest";
import * as Effect from "effect/Effect";
import { afterEach, describe, expect, it, vi } from "vite-plus/test";

import { appAtomRegistry } from "../../state/atom-registry";
import { activateCloudAccount, deactivateCloudAccount } from "./CloudAuthProvider";
import { setAgentAwarenessRelayTokenProvider } from "../agent-awareness/remoteRegistration";

vi.mock("@clerk/expo", () => ({
  ClerkProvider: vi.fn(),
  useAuth: vi.fn(),
}));

vi.mock("@clerk/expo/token-cache", () => ({
  tokenCache: {},
}));

vi.mock("../../lib/runtime", () => ({
  runtime: {
    runPromiseExit: vi.fn(),
  },
}));

vi.mock("../../connection/catalog", () => ({
  environmentCatalog: {
    removeRelayEnvironments: {},
  },
}));

vi.mock("./publicConfig", () => ({
  hasCloudIdentityConfig: vi.fn(() => false),
  hasManagedRelayConfig: vi.fn(() => false),
  resolveCloudPublicConfig: vi.fn(() => ({
    clerk: { publishableKey: null, jwtTemplate: null },
    relay: { url: null },
  })),
  resolveCloudClerkTokenOptions: vi.fn(),
}));

vi.mock("../agent-awareness/remoteRegistration", () => ({
  setAgentAwarenessRelayTokenProvider: vi.fn(),
  unregisterAgentAwarenessDeviceForCurrentUser: vi.fn(),
}));

afterEach(() => {
  deactivateCloudAccount();
  vi.clearAllMocks();
});

describe("CloudAuthProvider account isolation", () => {
  effectIt.effect("keeps Clerk token available when managed relay is disabled", () =>
    Effect.gen(function* () {
      const tokenProvider = async () => "account-1-token";

      activateCloudAccount("account-1", tokenProvider, false);

      const session = appAtomRegistry.get(managedRelaySessionAtom);
      expect(yield* session!.readClerkToken()).toBe("account-1-token");
      expect(vi.mocked(setAgentAwarenessRelayTokenProvider)).toHaveBeenLastCalledWith(null);
    }),
  );

  it("clears relay and agent-awareness credentials before cleanup can fail", async () => {
    const tokenProvider = async () => "account-1-token";
    activateCloudAccount("account-1", tokenProvider);
    expect(appAtomRegistry.get(managedRelaySessionAtom)?.accountId).toBe("account-1");

    deactivateCloudAccount();
    const cleanup = Promise.reject(new Error("Persistence removal failed.")).catch(() => undefined);

    expect(appAtomRegistry.get(managedRelaySessionAtom)).toBeNull();
    expect(vi.mocked(setAgentAwarenessRelayTokenProvider)).toHaveBeenLastCalledWith(null);
    await cleanup;
  });
});
