import { relayClerkTokenOptions } from "@kairo/shared/relayAuth";
import { normalizeSecureRelayUrl } from "@kairo/shared/relayUrl";

export interface CloudPublicConfig {
  readonly clerkPublishableKey: string | null;
  readonly clerkJwtTemplate: string | null;
  readonly relayUrl: string | null;
}

function trimNonEmpty(value: string | undefined): string | null {
  return value?.trim() || null;
}

export function resolveCloudPublicConfig(): CloudPublicConfig {
  return {
    clerkPublishableKey: trimNonEmpty(
      import.meta.env.VITE_CLERK_PUBLISHABLE_KEY as string | undefined,
    ),
    clerkJwtTemplate: trimNonEmpty(import.meta.env.VITE_CLERK_JWT_TEMPLATE as string | undefined),
    relayUrl: normalizeSecureRelayUrl(
      (import.meta.env.VITE_KAIRO_RELAY_URL as string | undefined) ?? "",
    ),
  };
}

export function hasCloudPublicConfig(): boolean {
  const config = resolveCloudPublicConfig();
  return Boolean(config.clerkPublishableKey && config.clerkJwtTemplate && config.relayUrl);
}

export function resolveRelayClerkTokenOptions() {
  const { clerkJwtTemplate } = resolveCloudPublicConfig();
  if (!clerkJwtTemplate) {
    throw new Error("KAIRO_CLERK_JWT_TEMPLATE is not configured.");
  }
  return relayClerkTokenOptions(clerkJwtTemplate);
}
