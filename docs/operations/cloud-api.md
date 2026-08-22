# Operate Kairo Cloud API

Create a Vercel project whose root directory is `infra/cloud-api`. The generated `*.vercel.app`
domain works; buying or configuring a domain is optional.

Set these runtime environment variables in Vercel:

- `CLERK_SECRET_KEY` is sensitive. Use the same Clerk instance as the Kairo clients.
- `CLERK_JWT_AUDIENCE` must be `kairo-code-relay`, matching Kairo's `kairo-relay` JWT template.
- `SUPERMEMORY_API_KEY` is sensitive.
- `KAIRO_CLOUD_TOKEN_PRIVATE_KEY` is sensitive.
- `KAIRO_CLOUD_TOKEN_PUBLIC_KEY`
- `KAIRO_MEMORY_NAMESPACE_HMAC_KEY` is sensitive and needs at least 32 random bytes.
- `KAIRO_CLOUD_ISSUER` is optional and defaults to `kairo-cloud`.
- `SUPERMEMORY_API_URL` is optional and defaults to `https://api.supermemory.ai`.

Generate an Ed25519 key pair:

```sh
openssl genpkey -algorithm Ed25519 -out kairo-cloud-private.pem
openssl pkey -in kairo-cloud-private.pem -pubout -out kairo-cloud-public.pem
openssl rand -base64 32
```

Put both key-pair values and the random namespace key in Vercel. The private key never enters the
repository or a client build. Kairo exchanges the signed-in user's existing Clerk token and stores
the returned installation grant automatically. Users do not add an environment variable, GitHub
secret, Supermemory key, or Clerk key.

The web, desktop, and mobile builds keep using their existing Clerk publishable key and JWT
template configuration. Do not add a Cloud API secret to an app build. Self-hosted Kairo servers
set `KAIRO_CLOUD_API_URL` only when targeting a non-default Cloud API deployment.

The GitHub deployment workflow needs `VERCEL_TOKEN`, `VERCEL_ORG_ID`, and
`VERCEL_CLOUD_API_PROJECT_ID`. No Cloud API runtime secret belongs in GitHub; those values live only
in the Vercel project.
