import { KairoCloudPrincipal, KairoCloudScope } from "@kairo/contracts/cloud";
import * as Context from "effect/Context";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import * as Schema from "effect/Schema";
import { importPKCS8, importSPKI, jwtVerify, SignJWT } from "jose";

import { CloudApiConfiguration } from "../Config.ts";

export const INSTALLATION_GRANT_TYPE = "kairo-cloud-installation+jwt";
export const INSTALLATION_GRANT_AUDIENCE = "kairo-cloud-api";
export const INSTALLATION_GRANT_KEY_ID = "v1";

const InstallationGrantClaims = Schema.Struct({
  iss: Schema.String,
  aud: Schema.Union([Schema.String, Schema.Array(Schema.String)]),
  sub: Schema.String.check(Schema.isNonEmpty(), Schema.isMaxLength(256)),
  jti: Schema.String.check(Schema.isNonEmpty(), Schema.isMaxLength(256)),
  iat: Schema.Int,
  exp: Schema.Int,
  memoryNamespace: Schema.String.check(Schema.isNonEmpty(), Schema.isMaxLength(256)),
  scope: Schema.Array(KairoCloudScope).check(Schema.isMinLength(1)),
});

export type InstallationGrantClaims = typeof InstallationGrantClaims.Type;

class InstallationGrantVerificationError extends Schema.TaggedErrorClass<InstallationGrantVerificationError>()(
  "InstallationGrantVerificationError",
  { cause: Schema.Defect() },
) {}

export class InstallationGrantVerifier extends Context.Service<
  InstallationGrantVerifier,
  {
    readonly verify: (
      token: string,
    ) => Effect.Effect<KairoCloudPrincipal["Service"], InstallationGrantVerificationError>;
  }
>()("kairo-cloud-api/auth/InstallationGrant/InstallationGrantVerifier") {}

const decodeClaims = Schema.decodeUnknownEffect(InstallationGrantClaims);

const makeVerifier = Effect.gen(function* () {
  const configuration = yield* CloudApiConfiguration;
  const publicKey = yield* Effect.tryPromise({
    try: () => importSPKI(configuration.tokenPublicKey, "EdDSA"),
    catch: (cause) => new InstallationGrantVerificationError({ cause }),
  });

  const verify: InstallationGrantVerifier["Service"]["verify"] = Effect.fn(
    "cloudApi.installationGrant.verify",
  )(function* (token) {
    const verified = yield* Effect.tryPromise({
      try: () =>
        jwtVerify(token, publicKey, {
          algorithms: ["EdDSA"],
          audience: INSTALLATION_GRANT_AUDIENCE,
          issuer: configuration.tokenIssuer,
          typ: INSTALLATION_GRANT_TYPE,
        }),
      catch: (cause) => new InstallationGrantVerificationError({ cause }),
    });
    if (verified.protectedHeader.kid !== INSTALLATION_GRANT_KEY_ID) {
      return yield* new InstallationGrantVerificationError({ cause: "unexpected_key_id" });
    }
    const claims = yield* decodeClaims(verified.payload).pipe(
      Effect.mapError((cause) => new InstallationGrantVerificationError({ cause })),
    );
    return {
      subjectId: claims.sub,
      memoryNamespace: claims.memoryNamespace,
      scopes: new Set(claims.scope),
    };
  });

  return InstallationGrantVerifier.of({ verify });
});

export const layer = Layer.effect(InstallationGrantVerifier, makeVerifier);

export const issueInstallationGrant = Effect.fn("cloudApi.installationGrant.issue")(
  function* (input: {
    readonly privateKey: string;
    readonly issuer: string;
    readonly subjectId: string;
    readonly tokenId: string;
    readonly memoryNamespace: string;
    readonly scopes: ReadonlyArray<KairoCloudScope>;
    readonly issuedAtEpochSeconds: number;
    readonly expiresAtEpochSeconds: number;
  }) {
    return yield* Effect.tryPromise({
      try: async () => {
        const privateKey = await importPKCS8(input.privateKey, "EdDSA");
        return new SignJWT({
          memoryNamespace: input.memoryNamespace,
          scope: [...input.scopes],
        })
          .setProtectedHeader({
            alg: "EdDSA",
            kid: INSTALLATION_GRANT_KEY_ID,
            typ: INSTALLATION_GRANT_TYPE,
          })
          .setIssuer(input.issuer)
          .setAudience(INSTALLATION_GRANT_AUDIENCE)
          .setSubject(input.subjectId)
          .setJti(input.tokenId)
          .setIssuedAt(input.issuedAtEpochSeconds)
          .setExpirationTime(input.expiresAtEpochSeconds)
          .sign(privateKey);
      },
      catch: (cause) => new InstallationGrantVerificationError({ cause }),
    });
  },
);
