# Kairo Cloud API

Kairo Cloud API is a small account-service boundary hosted separately from Kairo Connect relay. It
owns third-party service credentials and exposes Kairo-shaped operations. Supermemory is its first
integration; Clerk can later replace the temporary installation-grant issuer without changing the
memory routes.

## Trust boundary

- The Kairo server holds a signed installation grant.
- The Cloud API verifies grant issuer, audience, type, key id, expiry, and scopes.
- The grant names an opaque memory namespace, not an upstream container tag.
- The Cloud API derives the container tag with HMAC and a server-only key.
- The Supermemory key, upstream URL, endpoint paths, and derived tag never come from callers.
- Request and response bodies are schema-validated and bounded.

The public surface is intentionally narrow:

- `GET /health`
- `GET /v1/capabilities`
- `POST /v1/memory/save`
- `POST /v1/memory/recall`
- `POST /v1/memory/context`

There is no generic proxy route. Relay deployment, Cloudflare DNS, tunnels, and Tailscale are not
required. A Vercel `*.vercel.app` hostname is sufficient.

## Authentication evolution

V1 uses operator-issued, 30-day Ed25519 installation grants. The token contains an installation
subject, an opaque memory namespace, and explicit read/write scopes. Clerk should later mint or
exchange equivalent grants; callers and semantic memory routes should remain unchanged.
