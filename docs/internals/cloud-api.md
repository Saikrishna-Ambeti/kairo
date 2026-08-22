# Kairo Cloud API

Kairo Cloud API is a small account-service boundary hosted separately from Kairo Connect relay. It
owns third-party service credentials and exposes Kairo-shaped operations. Supermemory is its first
integration. Clerk authenticates grant exchange without changing the semantic memory routes.

## Trust boundary

- The client sends its existing Clerk JWT through an operate-scoped provisioning RPC.
- The Cloud API verifies the Clerk JWT and issues an account-scoped installation grant.
- The Kairo server stores the grant in its secret store and renews it automatically.
- The Cloud API verifies grant issuer, audience, type, key id, expiry, and scopes.
- The grant names an opaque memory namespace, not an upstream container tag.
- The Cloud API derives the container tag with HMAC and a server-only key.
- The Supermemory key, upstream URL, endpoint paths, and derived tag never come from callers.
- Request and response bodies are schema-validated and bounded.

The public surface is intentionally narrow:

- `GET /health`
- `POST /v1/installations/exchange`
- `GET /v1/capabilities`
- `POST /v1/memory/save`
- `POST /v1/memory/recall`
- `POST /v1/memory/context`

There is no generic proxy route. Relay deployment, Cloudflare DNS, tunnels, and Tailscale are not
required. A Vercel `*.vercel.app` hostname is sufficient.

Clients treat public configuration as two capabilities. Cloud identity requires the Clerk
publishable key and JWT template. Managed relay requires Cloud identity plus a valid HTTPS relay
URL. Clients mount Clerk and exchange installation grants when only Cloud identity is configured;
they do not start relay discovery or relay requests.

The exchange issues a 30-day Ed25519 grant. Its subject identifies the Kairo environment, its
memory namespace is stable for the Clerk user across environments, and its scopes permit only
memory reads and writes. The Supermemory routes accept the installation grant, never the Clerk JWT.
