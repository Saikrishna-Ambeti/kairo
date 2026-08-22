# Kairo Cloud API

Kairo Cloud API is a Vercel-hosted service for account-backed Kairo features. Its first feature is a narrow Supermemory gateway. Kairo Connect relay is not involved.

The service accepts semantic memory requests from Kairo servers, verifies a signed installation grant, derives the tenant container tag, and calls Supermemory with a Vercel-only API key. Callers cannot select an upstream URL, path, key, or container tag.

## Vercel setup

Create a dedicated Vercel project with Root Directory set to `infra/cloud-api`. Node.js 24 is selected from this package's `engines` field. Default `*.vercel.app` domain is enough.

Configure these runtime values in Vercel:

- `SUPERMEMORY_API_KEY`, sensitive
- `KAIRO_CLOUD_TOKEN_PUBLIC_KEY`
- `KAIRO_MEMORY_NAMESPACE_HMAC_KEY`, sensitive
- `KAIRO_CLOUD_ISSUER`, defaults to `kairo-cloud`
- `SUPERMEMORY_API_URL`, defaults to `https://api.supermemory.ai`

Do not pass `SUPERMEMORY_API_KEY` as a build argument or GitHub Actions secret. The function reads it from Vercel at runtime.

## Installation grants

V1 is invite-only until Clerk authentication exists. Generate an Ed25519 key pair:

```sh
openssl genpkey -algorithm Ed25519 -out kairo-cloud-private.pem
openssl pkey -in kairo-cloud-private.pem -pubout -out kairo-cloud-public.pem
```

Put public key in Vercel. Keep private key outside repository. Issue a 30-day grant locally:

```sh
KAIRO_CLOUD_TOKEN_PRIVATE_KEY="$(<kairo-cloud-private.pem)" \
  KAIRO_CLOUD_SUBJECT_ID="installation_<stable-random-id>" \
  KAIRO_CLOUD_MEMORY_NAMESPACE="memory_<stable-random-id>" \
  vp run --filter kairo-cloud-api issue-installation-grant
```

Keep both IDs for renewal. Reusing the memory namespace preserves access to existing memories.

Set the printed grant on the machine running Kairo:

```sh
export KAIRO_CLOUD_ACCESS_TOKEN='<printed grant>'
```

The server also supports storing the raw grant bytes at:

```text
<KAIRO_HOME>/userdata/secrets/kairo.cloud.accessToken.bin
```

Use mode `0600`. `KAIRO_CLOUD_API_URL` only needs to be set when using a non-default Cloud API
deployment. Start a new provider session after enabling Memory.

## Local checks

```sh
vp test run infra/cloud-api/src/http/App.test.ts
vp run --filter kairo-cloud-api typecheck
```
