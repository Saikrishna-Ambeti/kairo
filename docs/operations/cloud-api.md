# Operate Kairo Cloud API

Create a Vercel project whose root directory is `infra/cloud-api`. The generated `*.vercel.app`
domain works; buying or configuring a domain is optional.

Set these runtime environment variables in Vercel:

- `SUPERMEMORY_API_KEY` — sensitive
- `KAIRO_CLOUD_TOKEN_PUBLIC_KEY`
- `KAIRO_MEMORY_NAMESPACE_HMAC_KEY` — sensitive, at least 32 random bytes
- `KAIRO_CLOUD_ISSUER` — optional, defaults to `kairo-cloud`
- `SUPERMEMORY_API_URL` — optional, defaults to `https://api.supermemory.ai`

Generate an Ed25519 key pair:

```sh
openssl genpkey -algorithm Ed25519 -out kairo-cloud-private.pem
openssl pkey -in kairo-cloud-private.pem -pubout -out kairo-cloud-public.pem
openssl rand -base64 32
```

Put the public key and random namespace key in Vercel. Keep the private key outside Vercel and the
repository. Issue an invite grant locally:

```sh
KAIRO_CLOUD_TOKEN_PRIVATE_KEY="$(<kairo-cloud-private.pem)" \
  KAIRO_CLOUD_SUBJECT_ID="installation_<stable-random-id>" \
  KAIRO_CLOUD_MEMORY_NAMESPACE="memory_<stable-random-id>" \
  vp run --filter kairo-cloud-api issue-installation-grant
```

Record the subject and memory namespace. Use the same values when renewing the 30-day grant or the
installation will no longer address its existing memories.

On the machine running Kairo, set the printed value as `KAIRO_CLOUD_ACCESS_TOKEN`. Self-hosters
using a different deployment also set `KAIRO_CLOUD_API_URL` to its HTTPS origin. Alternatively,
store the raw token bytes under the `kairo.cloud.accessToken` key in Kairo's secret store.

The GitHub deployment workflow needs `VERCEL_TOKEN`, `VERCEL_ORG_ID`, and
`VERCEL_CLOUD_API_PROJECT_ID`. Do not put `SUPERMEMORY_API_KEY` in GitHub: it is a runtime secret in
Vercel, not a build or deployment secret.
