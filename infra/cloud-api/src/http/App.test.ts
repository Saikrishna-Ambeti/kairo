import { describe, expect, it } from "@effect/vitest";
import * as NodeCrypto from "node:crypto";
import * as Effect from "effect/Effect";
import * as Redacted from "effect/Redacted";
import * as Schema from "effect/Schema";
import { KairoCloudMemorySaveRequest } from "@kairo/contracts/cloud";

import type { CloudApiConfigurationShape } from "../Config.ts";
import { issueInstallationGrant } from "../auth/InstallationGrant.ts";
import { makeCloudApiHandler } from "./App.ts";

const keyPair = NodeCrypto.generateKeyPairSync("ed25519", {
  privateKeyEncoding: { format: "pem", type: "pkcs8" },
  publicKeyEncoding: { format: "pem", type: "spki" },
});

const configuration: CloudApiConfigurationShape = {
  supermemoryApiKey: Redacted.make("sm_service_owned"),
  supermemoryApiUrl: new URL("https://api.supermemory.test"),
  tokenPublicKey: keyPair.publicKey,
  tokenIssuer: "kairo-cloud-test",
  namespaceHmacKey: Redacted.make("test-namespace-hmac-key-with-32-bytes"),
};

const issueTestGrant = issueInstallationGrant({
  privateKey: keyPair.privateKey,
  issuer: configuration.tokenIssuer,
  subjectId: "installation_test",
  tokenId: "grant_test",
  memoryNamespace: "namespace_test",
  scopes: ["memory:read", "memory:write"],
  issuedAtEpochSeconds: 1_900_000_000,
  expiresAtEpochSeconds: 2_000_000_000,
});

const encodeSaveRequest = Schema.encodeSync(Schema.fromJsonString(KairoCloudMemorySaveRequest));
const encodeUnknownJson = Schema.encodeSync(Schema.fromJsonString(Schema.Unknown));

describe("Kairo Cloud API", () => {
  it.effect("authenticates installation and injects service-owned Supermemory fields", () =>
    Effect.gen(function* () {
      const upstreamRequests: Array<{
        readonly authorization: string | null;
        readonly body: unknown;
      }> = [];
      const fetchImplementation: typeof globalThis.fetch = async (input, init) => {
        const request = new Request(input, init);
        upstreamRequests.push({
          authorization: request.headers.get("authorization"),
          body: await request.json(),
        });
        return Response.json({ id: "memory_1", status: "queued" });
      };
      const app = yield* Effect.acquireRelease(
        Effect.sync(() => makeCloudApiHandler(configuration, fetchImplementation)),
        (value) => Effect.promise(() => value.dispose()),
      );
      const token = yield* issueTestGrant;
      const response = yield* Effect.promise(() =>
        app.handler(
          new Request("https://cloud.test/v1/memory/save", {
            method: "POST",
            headers: {
              authorization: `Bearer ${token}`,
              "content-type": "application/json",
              "x-request-id": "request_1",
            },
            body: encodeUnknownJson({
              content: "Prefers compact answers",
              containerTag: "attacker_controlled",
            }),
          }),
        ),
      );

      expect(response.status).toBe(200);
      expect(yield* Effect.promise(() => response.json())).toEqual({
        id: "memory_1",
        status: "queued",
      });
      expect(upstreamRequests).toHaveLength(1);
      expect(upstreamRequests[0]?.authorization).toBe("Bearer sm_service_owned");
      expect(upstreamRequests[0]?.body).toEqual({
        content: "Prefers compact answers",
        containerTag: expect.stringMatching(/^kairo_v1_[A-Za-z0-9_-]+$/u),
      });
    }),
  );

  it.effect("rejects invalid grants before calling Supermemory", () =>
    Effect.gen(function* () {
      let upstreamCalls = 0;
      const fetchImplementation: typeof globalThis.fetch = async () => {
        upstreamCalls += 1;
        return Response.json({ id: "unexpected", status: "unexpected" });
      };
      const app = yield* Effect.acquireRelease(
        Effect.sync(() => makeCloudApiHandler(configuration, fetchImplementation)),
        (value) => Effect.promise(() => value.dispose()),
      );
      const response = yield* Effect.promise(() =>
        app.handler(
          new Request("https://cloud.test/v1/memory/save", {
            method: "POST",
            headers: {
              authorization: "Bearer invalid",
              "content-type": "application/json",
              "x-request-id": "request_2",
            },
            body: encodeSaveRequest({ content: "must not be saved" }),
          }),
        ),
      );

      expect(response.status).toBe(401);
      expect(yield* Effect.promise(() => response.json())).toMatchObject({
        requestId: "request_2",
        code: "auth_invalid",
      });
      expect(upstreamCalls).toBe(0);
    }),
  );
});
