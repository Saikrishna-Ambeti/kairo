import { ComposioError } from "@kairo/contracts";
import * as Effect from "effect/Effect";
import * as Option from "effect/Option";

import * as ServerSecretStore from "../auth/ServerSecretStore.ts";

const textEncoder = new TextEncoder();
const textDecoder = new TextDecoder();

export const COMPOSIO_API_KEY_SECRET = "composio.cloud.apiKey";

export const getComposioApiKey = (): Effect.Effect<
  string | null,
  ComposioError,
  ServerSecretStore.ServerSecretStore
> =>
  Effect.gen(function* () {
    const secretStore = yield* ServerSecretStore.ServerSecretStore;
    const secret = yield* secretStore
      .get(COMPOSIO_API_KEY_SECRET)
      .pipe(
        Effect.mapError(
          (cause) => new ComposioError({ message: "Failed to read Composio API key.", cause }),
        ),
      );
    return Option.match(secret, {
      onNone: () => null,
      onSome: (value) => textDecoder.decode(value),
    });
  });

export const setComposioApiKey = (
  apiKey: string,
): Effect.Effect<void, ComposioError, ServerSecretStore.ServerSecretStore> =>
  Effect.gen(function* () {
    const secretStore = yield* ServerSecretStore.ServerSecretStore;
    yield* secretStore
      .set(COMPOSIO_API_KEY_SECRET, textEncoder.encode(apiKey))
      .pipe(
        Effect.mapError(
          (cause) => new ComposioError({ message: "Failed to store Composio API key.", cause }),
        ),
      );
  });

export const removeComposioApiKey = (): Effect.Effect<
  void,
  ComposioError,
  ServerSecretStore.ServerSecretStore
> =>
  Effect.gen(function* () {
    const secretStore = yield* ServerSecretStore.ServerSecretStore;
    yield* secretStore
      .remove(COMPOSIO_API_KEY_SECRET)
      .pipe(
        Effect.mapError(
          (cause) => new ComposioError({ message: "Failed to remove Composio API key.", cause }),
        ),
      );
  });
