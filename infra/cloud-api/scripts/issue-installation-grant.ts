import * as NodeCrypto from "node:crypto";
import * as Console from "effect/Console";
import * as DateTime from "effect/DateTime";
import * as Effect from "effect/Effect";
import * as Redacted from "effect/Redacted";
import * as NodeRuntime from "@effect/platform-node/NodeRuntime";

import { issueInstallationGrant } from "../src/auth/InstallationGrant.ts";

const DAYS_30_SECONDS = 30 * 24 * 60 * 60;

Effect.gen(function* () {
  const privateKey = process.env.KAIRO_CLOUD_TOKEN_PRIVATE_KEY?.trim();
  if (!privateKey) {
    return yield* Effect.die(
      "KAIRO_CLOUD_TOKEN_PRIVATE_KEY is required to issue an installation grant.",
    );
  }
  const subjectId = process.env.KAIRO_CLOUD_SUBJECT_ID?.trim();
  if (!subjectId) {
    return yield* Effect.die("KAIRO_CLOUD_SUBJECT_ID is required to issue an installation grant.");
  }
  const memoryNamespace = process.env.KAIRO_CLOUD_MEMORY_NAMESPACE?.trim();
  if (!memoryNamespace) {
    return yield* Effect.die(
      "KAIRO_CLOUD_MEMORY_NAMESPACE is required to issue an installation grant.",
    );
  }
  const issuer = process.env.KAIRO_CLOUD_ISSUER?.trim() || "kairo-cloud";
  const issuedAt = Math.floor((yield* DateTime.now).epochMilliseconds / 1_000);
  const tokenId = NodeCrypto.randomBytes(18).toString("base64url");
  const token = yield* issueInstallationGrant({
    privateKey: Redacted.value(Redacted.make(privateKey.replace(/\\n/gu, "\n"))),
    issuer,
    subjectId,
    tokenId,
    memoryNamespace,
    scopes: ["memory:read", "memory:write"],
    issuedAtEpochSeconds: issuedAt,
    expiresAtEpochSeconds: issuedAt + DAYS_30_SECONDS,
  });

  yield* Console.log(token);
}).pipe(NodeRuntime.runMain);
