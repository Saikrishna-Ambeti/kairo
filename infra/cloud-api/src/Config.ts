import * as Context from "effect/Context";
import * as Layer from "effect/Layer";
import * as Redacted from "effect/Redacted";
import * as Schema from "effect/Schema";

const NonEmptyString = Schema.String.check(Schema.isNonEmpty());
const NamespaceHmacKey = Schema.String.check(Schema.isMinLength(32));

const CloudApiEnvironment = Schema.Struct({
  CLERK_SECRET_KEY: NonEmptyString,
  CLERK_DEVELOPMENT_SECRET_KEY: Schema.optionalKey(NonEmptyString),
  CLERK_JWT_AUDIENCE: NonEmptyString,
  SUPERMEMORY_API_KEY: NonEmptyString,
  COMPOSIO_API_KEY: Schema.optionalKey(NonEmptyString),
  KAIRO_CLOUD_TOKEN_PRIVATE_KEY: NonEmptyString,
  KAIRO_CLOUD_TOKEN_PUBLIC_KEY: NonEmptyString,
  KAIRO_MEMORY_NAMESPACE_HMAC_KEY: NamespaceHmacKey,
  KAIRO_CLOUD_ISSUER: Schema.optionalKey(NonEmptyString),
  SUPERMEMORY_API_URL: Schema.optionalKey(Schema.URLFromString),
  COMPOSIO_API_URL: Schema.optionalKey(Schema.URLFromString),
});
const decodeCloudApiEnvironment = Schema.decodeUnknownSync(CloudApiEnvironment);

export interface CloudApiConfigurationShape {
  readonly clerkSecretKey: Redacted.Redacted<string>;
  readonly clerkDevelopmentSecretKey: Redacted.Redacted<string> | null;
  readonly clerkJwtAudience: string;
  readonly supermemoryApiKey: Redacted.Redacted<string>;
  readonly supermemoryApiUrl: URL;
  readonly composioApiKey: Redacted.Redacted<string> | null;
  readonly composioApiUrl: URL;
  readonly tokenPrivateKey: Redacted.Redacted<string>;
  readonly tokenPublicKey: string;
  readonly tokenIssuer: string;
  readonly namespaceHmacKey: Redacted.Redacted<string>;
}

export class CloudApiConfiguration extends Context.Service<
  CloudApiConfiguration,
  CloudApiConfigurationShape
>()("kairo-cloud-api/Config/CloudApiConfiguration") {}

export const make = (configuration: CloudApiConfigurationShape) =>
  CloudApiConfiguration.of(configuration);

export const layer = (configuration: CloudApiConfigurationShape) =>
  Layer.succeed(CloudApiConfiguration, make(configuration));

export function fromEnv(
  env: Readonly<Record<string, string | undefined>>,
): CloudApiConfigurationShape {
  const decoded = decodeCloudApiEnvironment({
    CLERK_SECRET_KEY: env.CLERK_SECRET_KEY,
    CLERK_DEVELOPMENT_SECRET_KEY: env.CLERK_DEVELOPMENT_SECRET_KEY,
    CLERK_JWT_AUDIENCE: env.CLERK_JWT_AUDIENCE,
    SUPERMEMORY_API_KEY: env.SUPERMEMORY_API_KEY,
    COMPOSIO_API_KEY: env.COMPOSIO_API_KEY,
    KAIRO_CLOUD_TOKEN_PRIVATE_KEY: env.KAIRO_CLOUD_TOKEN_PRIVATE_KEY,
    KAIRO_CLOUD_TOKEN_PUBLIC_KEY: env.KAIRO_CLOUD_TOKEN_PUBLIC_KEY,
    KAIRO_MEMORY_NAMESPACE_HMAC_KEY: env.KAIRO_MEMORY_NAMESPACE_HMAC_KEY,
    ...(env.KAIRO_CLOUD_ISSUER ? { KAIRO_CLOUD_ISSUER: env.KAIRO_CLOUD_ISSUER } : {}),
    ...(env.SUPERMEMORY_API_URL ? { SUPERMEMORY_API_URL: env.SUPERMEMORY_API_URL } : {}),
    ...(env.COMPOSIO_API_URL ? { COMPOSIO_API_URL: env.COMPOSIO_API_URL } : {}),
  });

  return make({
    clerkSecretKey: Redacted.make(decoded.CLERK_SECRET_KEY),
    clerkDevelopmentSecretKey: decoded.CLERK_DEVELOPMENT_SECRET_KEY
      ? Redacted.make(decoded.CLERK_DEVELOPMENT_SECRET_KEY)
      : null,
    clerkJwtAudience: decoded.CLERK_JWT_AUDIENCE,
    supermemoryApiKey: Redacted.make(decoded.SUPERMEMORY_API_KEY),
    supermemoryApiUrl: decoded.SUPERMEMORY_API_URL ?? new URL("https://api.supermemory.ai"),
    composioApiKey: decoded.COMPOSIO_API_KEY ? Redacted.make(decoded.COMPOSIO_API_KEY) : null,
    composioApiUrl: decoded.COMPOSIO_API_URL ?? new URL("https://backend.composio.dev"),
    tokenPrivateKey: Redacted.make(decoded.KAIRO_CLOUD_TOKEN_PRIVATE_KEY.replace(/\\n/gu, "\n")),
    tokenPublicKey: decoded.KAIRO_CLOUD_TOKEN_PUBLIC_KEY.replace(/\\n/gu, "\n"),
    tokenIssuer: decoded.KAIRO_CLOUD_ISSUER ?? "kairo-cloud",
    namespaceHmacKey: Redacted.make(decoded.KAIRO_MEMORY_NAMESPACE_HMAC_KEY),
  });
}
