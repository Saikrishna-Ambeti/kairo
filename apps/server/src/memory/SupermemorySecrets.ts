import { SupermemoryError } from "@kairo/contracts";
import * as Config from "effect/Config";
import * as Effect from "effect/Effect";
import * as Option from "effect/Option";
import * as Redacted from "effect/Redacted";

import * as ServerSecretStore from "../auth/ServerSecretStore.ts";

const textDecoder = new TextDecoder();

export const KAIRO_CLOUD_ACCESS_TOKEN_SECRET = "kairo.cloud.accessToken";

const readSecret = (
  name: string,
): Effect.Effect<string | undefined, SupermemoryError, ServerSecretStore.ServerSecretStore> =>
  Effect.gen(function* () {
    const secretStore = yield* ServerSecretStore.ServerSecretStore;
    const secret = yield* secretStore.get(name).pipe(
      Effect.mapError(
        (cause) =>
          new SupermemoryError({
            message: "Failed to read hosted Supermemory configuration.",
            cause,
          }),
      ),
    );
    return Option.match(secret, {
      onNone: () => undefined,
      onSome: (value) => textDecoder.decode(value).trim() || undefined,
    });
  });

export const getKairoCloudAccessToken = (): Effect.Effect<
  Redacted.Redacted<string> | null,
  SupermemoryError,
  ServerSecretStore.ServerSecretStore
> =>
  Effect.gen(function* () {
    const stored = yield* readSecret(KAIRO_CLOUD_ACCESS_TOKEN_SECRET);
    if (stored) return Redacted.make(stored);

    const fromEnvironment = yield* Config.redacted("KAIRO_CLOUD_ACCESS_TOKEN").pipe(
      Config.option,
      Effect.mapError(
        (cause) =>
          new SupermemoryError({
            message: "Failed to read Kairo Cloud access configuration.",
            cause,
          }),
      ),
    );
    return Option.match(fromEnvironment, {
      onNone: () => null,
      onSome: (value) => (Redacted.value(value).trim() ? value : null),
    });
  });
