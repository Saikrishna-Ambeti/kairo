import { describe, expect, it } from "@effect/vitest";
import { EnvironmentId } from "@kairo/contracts";
import * as ConfigProvider from "effect/ConfigProvider";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import * as Redacted from "effect/Redacted";
import * as Schema from "effect/Schema";
import { HttpClient, HttpClientResponse } from "effect/unstable/http";

import { KairoCloudClient, layer as KairoCloudClientLayer } from "./KairoCloudClient.ts";

const decodeUnknownJson = Schema.decodeUnknownSync(Schema.fromJsonString(Schema.Unknown));

describe("KairoCloudClient", () => {
  it.effect("uses the configured gateway and installation grant", () =>
    Effect.gen(function* () {
      const requests: Array<{
        readonly url: string;
        readonly authorization: string | undefined;
        readonly body: unknown;
      }> = [];
      const httpLayer = Layer.succeed(
        HttpClient.HttpClient,
        HttpClient.make((request) =>
          Effect.sync(() => {
            const body =
              request.body._tag === "Uint8Array"
                ? decodeUnknownJson(new TextDecoder().decode(request.body.body))
                : undefined;
            requests.push({
              url: request.url,
              authorization: request.headers.authorization,
              body,
            });
            return HttpClientResponse.fromWeb(
              request,
              Response.json(
                request.url.endsWith("/v1/installations/exchange")
                  ? { accessToken: "installation_grant", expiresAtEpochSeconds: 2_000_000_000 }
                  : request.url.endsWith("/v1/composio/access")
                    ? { accessToken: "composio_grant", expiresAtEpochSeconds: 2_000_000_000 }
                    : { id: "memory_1", status: "queued" },
              ),
            );
          }),
        ),
      );
      const configLayer = ConfigProvider.layer(
        ConfigProvider.fromEnv({
          env: { KAIRO_CLOUD_API_URL: "https://memory-gateway.test" },
        }),
      );
      const clientLayer = KairoCloudClientLayer.pipe(
        Layer.provide(httpLayer),
        Layer.provide(configLayer),
      );

      const response = yield* Effect.gen(function* () {
        const client = yield* KairoCloudClient;
        const grant = yield* client.exchangeInstallationGrant(Redacted.make("clerk_session"), {
          environmentId: EnvironmentId.make("environment_test"),
        });
        expect(grant.accessToken).toBe("installation_grant");
        const composio = yield* client.issueComposioAccess(Redacted.make("installation_grant"));
        expect(composio.accessToken).toBe("composio_grant");
        return yield* client.saveMemory(Redacted.make("installation_grant"), {
          content: "Prefers compact answers",
        });
      }).pipe(Effect.provide(clientLayer));

      expect(response).toEqual({ id: "memory_1", status: "queued" });
      expect(requests).toEqual([
        {
          url: "https://memory-gateway.test/v1/installations/exchange",
          authorization: "Bearer clerk_session",
          body: { environmentId: "environment_test" },
        },
        {
          url: "https://memory-gateway.test/v1/composio/access",
          authorization: "Bearer installation_grant",
          body: undefined,
        },
        {
          url: "https://memory-gateway.test/v1/memory/save",
          authorization: "Bearer installation_grant",
          body: { content: "Prefers compact answers" },
        },
      ]);
    }),
  );

  it.effect("reports an invalid or expired grant without exposing it", () =>
    Effect.gen(function* () {
      const httpLayer = Layer.succeed(
        HttpClient.HttpClient,
        HttpClient.make((request) =>
          Effect.succeed(HttpClientResponse.fromWeb(request, new Response(null, { status: 401 }))),
        ),
      );
      const result = yield* Effect.gen(function* () {
        const client = yield* KairoCloudClient;
        return yield* Effect.result(client.getCapabilities(Redacted.make("secret_grant_value")));
      }).pipe(Effect.provide(KairoCloudClientLayer.pipe(Layer.provide(httpLayer))));

      expect(result._tag).toBe("Failure");
      if (result._tag === "Failure") {
        expect(result.failure.message).toContain("invalid or expired");
        expect(result.failure.message).not.toContain("secret_grant_value");
      }
    }),
  );
});
