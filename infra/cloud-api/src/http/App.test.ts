import { describe, expect, it } from "@effect/vitest";
import * as NodeCrypto from "node:crypto";
import * as Effect from "effect/Effect";
import * as Redacted from "effect/Redacted";
import * as Schema from "effect/Schema";
import { KairoCloudMemorySaveRequest } from "@kairo/contracts/cloud";
import { importSPKI, jwtVerify } from "jose";

import type { CloudApiConfigurationShape } from "../Config.ts";
import { ClerkSessionVerificationError, ClerkSessionVerifier } from "../auth/ClerkSession.ts";
import { issueInstallationGrant } from "../auth/InstallationGrant.ts";
import { makeCloudApiHandler } from "./App.ts";

const keyPair = NodeCrypto.generateKeyPairSync("ed25519", {
  privateKeyEncoding: { format: "pem", type: "pkcs8" },
  publicKeyEncoding: { format: "pem", type: "spki" },
});

const configuration: CloudApiConfigurationShape = {
  clerkSecretKey: Redacted.make("sk_test_clerk"),
  clerkJwtAudience: "kairo-test",
  supermemoryApiKey: Redacted.make("sm_service_owned"),
  supermemoryApiUrl: new URL("https://api.supermemory.test"),
  tokenPrivateKey: Redacted.make(keyPair.privateKey),
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

const clerkSessionVerifier = ClerkSessionVerifier.of({
  verify: (token) =>
    token.startsWith("clerk_")
      ? Effect.succeed({ subjectId: token.slice("clerk_".length) })
      : Effect.fail(new ClerkSessionVerificationError({ cause: "invalid" })),
});

describe("Kairo Cloud API", () => {
  it.effect("exchanges a Clerk session for an account-scoped installation grant", () =>
    Effect.gen(function* () {
      const app = yield* Effect.acquireRelease(
        Effect.sync(() =>
          makeCloudApiHandler(configuration, globalThis.fetch, clerkSessionVerifier),
        ),
        (value) => Effect.promise(() => value.dispose()),
      );
      const exchange = (clerkToken: string, environmentId: string) =>
        Effect.promise(() =>
          app.handler(
            new Request("https://cloud.test/v1/installations/exchange", {
              method: "POST",
              headers: {
                authorization: `Bearer ${clerkToken}`,
                "content-type": "application/json",
              },
              body: encodeUnknownJson({ environmentId }),
            }),
          ),
        ).pipe(
          Effect.flatMap((response) =>
            Effect.promise(async () => ({ status: response.status, body: await response.json() })),
          ),
        );

      const first = yield* exchange("clerk_user_one", "environment_one");
      const second = yield* exchange("clerk_user_one", "environment_two");
      const other = yield* exchange("clerk_user_two", "environment_three");
      expect(first.status).toBe(200);
      expect(second.status).toBe(200);
      expect(other.status).toBe(200);

      const publicKey = yield* Effect.promise(() => importSPKI(keyPair.publicKey, "EdDSA"));
      const firstClaims = yield* Effect.promise(() =>
        jwtVerify((first.body as { accessToken: string }).accessToken, publicKey),
      );
      const secondClaims = yield* Effect.promise(() =>
        jwtVerify((second.body as { accessToken: string }).accessToken, publicKey),
      );
      const otherClaims = yield* Effect.promise(() =>
        jwtVerify((other.body as { accessToken: string }).accessToken, publicKey),
      );

      expect(firstClaims.payload.sub).toBe("environment:environment_one");
      expect(firstClaims.payload.memoryNamespace).toBe(secondClaims.payload.memoryNamespace);
      expect(firstClaims.payload.memoryNamespace).not.toBe(otherClaims.payload.memoryNamespace);
    }),
  );

  it.effect("rejects an invalid Clerk session without issuing a grant", () =>
    Effect.gen(function* () {
      const app = yield* Effect.acquireRelease(
        Effect.sync(() =>
          makeCloudApiHandler(configuration, globalThis.fetch, clerkSessionVerifier),
        ),
        (value) => Effect.promise(() => value.dispose()),
      );
      const response = yield* Effect.promise(() =>
        app.handler(
          new Request("https://cloud.test/v1/installations/exchange", {
            method: "POST",
            headers: {
              authorization: "Bearer invalid",
              "content-type": "application/json",
            },
            body: encodeUnknownJson({ environmentId: "environment_one" }),
          }),
        ),
      );

      expect(response.status).toBe(401);
      expect(yield* Effect.promise(() => response.json())).toMatchObject({
        code: "auth_invalid",
      });
    }),
  );

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

  it.effect("routes rewritten Vercel API paths to the Cloud API handler", () =>
    Effect.gen(function* () {
      const app = yield* Effect.acquireRelease(
        Effect.sync(() => makeCloudApiHandler(configuration, globalThis.fetch)),
        (value) => Effect.promise(() => value.dispose()),
      );
      const token = yield* issueTestGrant;
      const response = yield* Effect.promise(() =>
        app.handler(
          new Request("https://cloud.test/api/v1?__kairo_path=capabilities", {
            headers: { authorization: `Bearer ${token}` },
          }),
        ),
      );

      expect(response.status).toBe(200);
      expect(yield* Effect.promise(() => response.json())).toEqual({
        memory: true,
        principal: "installation",
      });
    }),
  );
});
