# Kairo Cloud API

Kairo Cloud API is a Vercel-hosted service for account-backed Kairo features. Its first feature is a narrow Supermemory gateway. Kairo Connect relay is not involved.

The service exchanges an authenticated Clerk session for a signed installation grant, accepts semantic memory requests from Kairo servers, derives the tenant container tag, and calls Supermemory with a Vercel-only API key. Callers cannot select an upstream URL, path, key, or container tag.

## Vercel setup

Create a dedicated Vercel project with Root Directory set to `infra/cloud-api`. Node.js 24 is selected from this package's `engines` field. Default `*.vercel.app` domain is enough.

Configure these runtime values in Vercel:

- `CLERK_SECRET_KEY`, sensitive
- `CLERK_JWT_AUDIENCE`, matching the audience in Kairo's existing Clerk JWT template
- `SUPERMEMORY_API_KEY`, sensitive
- `KAIRO_CLOUD_TOKEN_PRIVATE_KEY`, sensitive
- `KAIRO_CLOUD_TOKEN_PUBLIC_KEY`
- `KAIRO_MEMORY_NAMESPACE_HMAC_KEY`, sensitive
- `KAIRO_CLOUD_ISSUER`, defaults to `kairo-cloud`
- `SUPERMEMORY_API_URL`, defaults to `https://api.supermemory.ai`

Do not pass runtime secrets as build arguments or GitHub Actions secrets. The function reads them from Vercel at runtime.

Generate the installation-grant key pair once:

```sh
openssl genpkey -algorithm Ed25519 -out kairo-cloud-private.pem
openssl pkey -in kairo-cloud-private.pem -pubout -out kairo-cloud-public.pem
```

Put both keys in Vercel. Kairo clients use their existing Clerk configuration; no Supermemory or
Kairo Cloud key is added to GitHub, the app build, or a user's machine. The local Kairo server
automatically stores and renews its installation grant after Clerk sign-in.

`KAIRO_CLOUD_API_URL` only needs to be set in a self-hosted Kairo server build that targets a
non-default Cloud API deployment. Start a new provider session after enabling Memory.

## Local checks

```sh
vp test run infra/cloud-api/src/http/App.test.ts
vp run --filter kairo-cloud-api typecheck
```
