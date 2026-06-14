import { makeEnvironmentHttpApiClient } from "@kairo/client-runtime";
import * as Context from "effect/Context";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";

import { resolvePrimaryEnvironmentHttpUrl } from "./target";

export type PrimaryEnvironmentHttpClientShape = Effect.Success<
  ReturnType<typeof makeEnvironmentHttpApiClient>
>;

export class PrimaryEnvironmentHttpClient extends Context.Service<
  PrimaryEnvironmentHttpClient,
  PrimaryEnvironmentHttpClientShape
>()("@kairo/web/environments/primary/httpClient/PrimaryEnvironmentHttpClient") {}

export const primaryEnvironmentHttpClientLive = Layer.effect(
  PrimaryEnvironmentHttpClient,
  Effect.suspend(() => makeEnvironmentHttpApiClient(resolvePrimaryEnvironmentHttpUrl("/"))),
);
