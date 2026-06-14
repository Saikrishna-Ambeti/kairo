import { SupermemoryError } from "@kairo/contracts";
import * as Effect from "effect/Effect";

import * as ServerSecretStore from "../auth/ServerSecretStore.ts";

const textEncoder = new TextEncoder();
const textDecoder = new TextDecoder();

export const SUPERMEMORY_HOSTED_API_KEY_SECRET = "supermemory.hosted.apiKey";

const SUPERMEMORY_KEY_PATTERN = /sm_[A-Za-z0-9_-]+/g;

export function redactSupermemorySecrets(value: string): string {
  return value.replace(SUPERMEMORY_KEY_PATTERN, "sm_***");
}

export const getSupermemoryApiKey = (): Effect.Effect<
  string | null,
  SupermemoryError,
  ServerSecretStore.ServerSecretStore
> =>
  Effect.gen(function* () {
    const secretStore = yield* ServerSecretStore.ServerSecretStore;
    const secret = yield* secretStore.get(SUPERMEMORY_HOSTED_API_KEY_SECRET).pipe(
      Effect.mapError(
        (cause) =>
          new SupermemoryError({
            message: "Failed to read Supermemory API key.",
            cause,
          }),
      ),
    );
    return secret ? textDecoder.decode(secret) : null;
  });

export const setSupermemoryApiKey = (
  apiKey: string,
): Effect.Effect<void, SupermemoryError, ServerSecretStore.ServerSecretStore> =>
  Effect.gen(function* () {
    const secretStore = yield* ServerSecretStore.ServerSecretStore;
    yield* secretStore.set(SUPERMEMORY_HOSTED_API_KEY_SECRET, textEncoder.encode(apiKey)).pipe(
      Effect.mapError(
        (cause) =>
          new SupermemoryError({
            message: "Failed to store Supermemory API key.",
            cause,
          }),
      ),
    );
  });
