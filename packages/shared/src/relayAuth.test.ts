import { describe, expect, it } from "vite-plus/test";

import {
  clerkFrontendApiHostnameFromPublishableKey,
  isAllowedClerkFrontendApiHostname,
} from "./relayAuth.ts";

const clerkPublishableKey = (hostname: string): string => `pk_test_${btoa(`${hostname}$`)}`;

describe("Clerk relay auth", () => {
  it("derives a custom Frontend API hostname from a Clerk publishable key", () => {
    expect(
      clerkFrontendApiHostnameFromPublishableKey(clerkPublishableKey("clerk.kairo.codes")),
    ).toBe("clerk.kairo.codes");
  });

  it("allows standard Clerk hosts and an exact configured custom hostname", () => {
    expect(isAllowedClerkFrontendApiHostname("example.clerk.accounts.dev", null)).toBe(true);
    expect(isAllowedClerkFrontendApiHostname("example.clerk.accounts.com", null)).toBe(true);
    expect(isAllowedClerkFrontendApiHostname("clerk.kairo.codes", "clerk.kairo.codes")).toBe(true);
    expect(isAllowedClerkFrontendApiHostname("attacker.example", "clerk.kairo.codes")).toBe(false);
    expect(isAllowedClerkFrontendApiHostname("nested.clerk.kairo.codes", "clerk.kairo.codes")).toBe(
      false,
    );
  });
});
