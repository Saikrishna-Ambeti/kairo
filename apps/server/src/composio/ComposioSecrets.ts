import { ComposioError } from "@kairo/contracts";
import * as Effect from "effect/Effect";
import * as Option from "effect/Option";
import * as Redacted from "effect/Redacted";

import * as ServerSecretStore from "../auth/ServerSecretStore.ts";

const textEncoder = new TextEncoder();
const textDecoder = new TextDecoder();

export const COMPOSIO_ACCESS_TOKEN_SECRET = "composio.cloud.accessToken";
const LEGACY_COMPOSIO_API_KEY_SECRET = "composio.cloud.apiKey";

export const getComposioAccessToken = (): Effect.Effect<
  Redacted.Redacted<string> | null,
  ComposioError,
  ServerSecretStore.ServerSecretStore
> =>
  Effect.gen(function* () {
    const secretStore = yield* ServerSecretStore.ServerSecretStore;
    const secret = yield* secretStore
      .get(COMPOSIO_ACCESS_TOKEN_SECRET)
      .pipe(
        Effect.mapError(
          (cause) => new ComposioError({ message: "Failed to read Composio access.", cause }),
        ),
      );
    return Option.match(secret, {
      onNone: () => null,
      onSome: (value) => Redacted.make(textDecoder.decode(value)),
    });
  });

export const setComposioAccessToken = (
  accessToken: string,
): Effect.Effect<void, ComposioError, ServerSecretStore.ServerSecretStore> =>
  Effect.gen(function* () {
    const secretStore = yield* ServerSecretStore.ServerSecretStore;
    yield* secretStore
      .set(COMPOSIO_ACCESS_TOKEN_SECRET, textEncoder.encode(accessToken))
      .pipe(
        Effect.mapError(
          (cause) => new ComposioError({ message: "Failed to store Composio access.", cause }),
        ),
      );
    yield* secretStore
      .remove(LEGACY_COMPOSIO_API_KEY_SECRET)
      .pipe(
        Effect.mapError(
          (cause) =>
            new ComposioError({ message: "Failed to remove legacy Composio access.", cause }),
        ),
      );
  });

export const removeComposioAccessToken = (): Effect.Effect<
  void,
  ComposioError,
  ServerSecretStore.ServerSecretStore
> =>
  Effect.gen(function* () {
    const secretStore = yield* ServerSecretStore.ServerSecretStore;
    yield* secretStore
      .remove(COMPOSIO_ACCESS_TOKEN_SECRET)
      .pipe(
        Effect.mapError(
          (cause) => new ComposioError({ message: "Failed to remove Composio access.", cause }),
        ),
      );
    yield* secretStore
      .remove(LEGACY_COMPOSIO_API_KEY_SECRET)
      .pipe(
        Effect.mapError(
          (cause) =>
            new ComposioError({ message: "Failed to remove legacy Composio access.", cause }),
        ),
      );
  });
