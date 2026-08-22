import { afterEach, describe, expect, it, vi } from "vite-plus/test";

import {
  CloudPublicConfigMissingError,
  hasCloudIdentityConfig,
  hasManagedRelayConfig,
  resolveCloudClerkTokenOptions,
} from "./publicConfig.ts";

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("cloud public configuration", () => {
  it("enables Clerk identity without a relay URL", () => {
    vi.stubEnv("VITE_CLERK_PUBLISHABLE_KEY", "");
    vi.stubEnv("VITE_CLERK_JWT_TEMPLATE", "");
    vi.stubEnv("VITE_KAIRO_RELAY_URL", "");
    expect(hasCloudIdentityConfig()).toBe(false);
    expect(hasManagedRelayConfig()).toBe(false);

    vi.stubEnv("VITE_CLERK_PUBLISHABLE_KEY", "pk_test_example");
    expect(hasCloudIdentityConfig()).toBe(false);
    expect(hasManagedRelayConfig()).toBe(false);

    vi.stubEnv("VITE_CLERK_JWT_TEMPLATE", "kairo-relay");
    expect(hasCloudIdentityConfig()).toBe(true);
    expect(hasManagedRelayConfig()).toBe(false);
  });

  it("enables managed relay when identity and relay URL are configured", () => {
    vi.stubEnv("VITE_CLERK_PUBLISHABLE_KEY", "pk_test_example");
    vi.stubEnv("VITE_CLERK_JWT_TEMPLATE", "kairo-relay");
    vi.stubEnv("VITE_KAIRO_RELAY_URL", "https://relay.example.test");

    expect(hasCloudIdentityConfig()).toBe(true);
    expect(hasManagedRelayConfig()).toBe(true);
  });

  it("rejects an insecure relay URL", () => {
    vi.stubEnv("VITE_CLERK_PUBLISHABLE_KEY", "pk_test_example");
    vi.stubEnv("VITE_CLERK_JWT_TEMPLATE", "kairo-relay");
    vi.stubEnv("VITE_KAIRO_RELAY_URL", "http://relay.example.test");

    expect(hasCloudIdentityConfig()).toBe(true);
    expect(hasManagedRelayConfig()).toBe(false);
  });

  it("reports the missing Clerk JWT template as structured configuration", () => {
    vi.stubEnv("VITE_CLERK_JWT_TEMPLATE", "");

    expect(() => resolveCloudClerkTokenOptions()).toThrowError(
      new CloudPublicConfigMissingError({ key: "KAIRO_CLERK_JWT_TEMPLATE" }),
    );
  });
});
