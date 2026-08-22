# Kairo Cloud API

Kairo Cloud API is a Vercel-hosted service for account-backed Kairo features. It owns Supermemory and Composio credentials. Kairo Connect relay is not involved.

The service exchanges an authenticated Clerk session for a signed installation grant. Memory requests use a derived tenant container tag. Composio requests use a per-user session and a cloud proxy. Neither vendor key leaves Vercel.

## Vercel setup

Create a dedicated Vercel project with Root Directory set to `infra/cloud-api`. Node.js 24 is selected from this package's `engines` field. Default `*.vercel.app` domain is enough.

Configure these runtime values in Vercel:

- `CLERK_SECRET_KEY`, sensitive
- `CLERK_JWT_AUDIENCE`, `kairo-code-relay`, matching Kairo's `kairo-relay` JWT template
- `SUPERMEMORY_API_KEY`, sensitive
- `COMPOSIO_API_KEY`, sensitive, required to advertise Composio support
- `KAIRO_CLOUD_TOKEN_PRIVATE_KEY`, sensitive
- `KAIRO_CLOUD_TOKEN_PUBLIC_KEY`
- `KAIRO_MEMORY_NAMESPACE_HMAC_KEY`, sensitive
- `KAIRO_CLOUD_ISSUER`, defaults to `kairo-cloud`
- `SUPERMEMORY_API_URL`, defaults to `https://api.supermemory.ai`
- `COMPOSIO_API_URL`, defaults to `https://backend.composio.dev`

Do not pass runtime secrets as build arguments or GitHub Actions secrets. The function reads them from Vercel at runtime.

Generate the installation-grant key pair once:

```sh
openssl genpkey -algorithm Ed25519 -out kairo-cloud-private.pem
openssl pkey -in kairo-cloud-private.pem -pubout -out kairo-cloud-public.pem
```

Put both signing keys in Vercel. Kairo clients use their existing Clerk configuration. No
Supermemory, Composio, or Kairo Cloud key is added to GitHub or the app build. Local Kairo server
stores renewable scoped grants after Clerk sign-in.

`KAIRO_CLOUD_API_URL` only needs to be set in a self-hosted Kairo server build that targets a
non-default Cloud API deployment. Start a new provider session after enabling Memory.

## Local checks

```sh
vp test run infra/cloud-api/src/http/App.test.ts
vp run --filter kairo-cloud-api typecheck
```
