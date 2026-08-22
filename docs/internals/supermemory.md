# Hosted Supermemory

Kairo exposes memory through its authenticated `/mcp` endpoint. Providers receive a short-lived
Kairo MCP credential with a `memory` capability; they never receive the Supermemory API key or
connect to a separate Supermemory MCP server.

`SupermemoryService` sends three semantic operations to Kairo Cloud: save, recall, and context.
The Kairo server cannot choose a Supermemory URL, endpoint, API key, or container tag. Kairo Cloud
verifies the installation grant, derives the tenant container tag, and makes the upstream call.

The local host reads its installation grant from `ServerSecretStore` under
`kairo.cloud.accessToken`, with `KAIRO_CLOUD_ACCESS_TOKEN` as an operator-friendly fallback. The
Supermemory credential and namespace HMAC key exist only in the Cloud API's Vercel environment.
Neither belongs in settings JSON, provider configuration, WebSocket contracts, or client state.

Status and configuration probe `/v1/capabilities`. A present but invalid or expired grant does not
make the service ready. Kairo Connect relay and the local Supermemory CLI are not part of this path.
