import { verifyToken } from "@clerk/backend";
import * as Context from "effect/Context";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import * as Redacted from "effect/Redacted";
import * as Schema from "effect/Schema";

import { CloudApiConfiguration } from "../Config.ts";

export interface ClerkSessionPrincipal {
  readonly subjectId: string;
}

export class ClerkSessionVerificationError extends Schema.TaggedErrorClass<ClerkSessionVerificationError>()(
  "ClerkSessionVerificationError",
  { cause: Schema.Defect() },
) {}

export class ClerkSessionVerifier extends Context.Service<
  ClerkSessionVerifier,
  {
    readonly verify: (
      token: string,
    ) => Effect.Effect<ClerkSessionPrincipal, ClerkSessionVerificationError>;
  }
>()("kairo-cloud-api/auth/ClerkSession/ClerkSessionVerifier") {}

const make = Effect.gen(function* () {
  const configuration = yield* CloudApiConfiguration;
  const secretKeys = [
    configuration.clerkSecretKey,
    ...(configuration.clerkDevelopmentSecretKey ? [configuration.clerkDevelopmentSecretKey] : []),
  ];

  const verify: ClerkSessionVerifier["Service"]["verify"] = Effect.fn(
    "cloudApi.clerkSession.verify",
  )(function* (token) {
    const verified = yield* Effect.tryPromise({
      try: async () => {
        let lastError: unknown;
        for (const secretKey of secretKeys) {
          try {
            return await verifyToken(token, {
              secretKey: Redacted.value(secretKey),
              audience: configuration.clerkJwtAudience,
            });
          } catch (error) {
            lastError = error;
          }
        }
        throw lastError;
      },
      catch: (cause) => new ClerkSessionVerificationError({ cause }),
    });
    if (typeof verified.sub !== "string" || verified.sub.length === 0) {
      return yield* new ClerkSessionVerificationError({ cause: "missing_subject" });
    }
    return { subjectId: verified.sub };
  });

  return ClerkSessionVerifier.of({ verify });
});

export const layer = Layer.effect(ClerkSessionVerifier, make);
