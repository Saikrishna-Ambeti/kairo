# Hosted Supermemory

Kairo exposes memory through its authenticated `/mcp` endpoint. Providers receive a short-lived
Kairo MCP credential with a `memory` capability; they never receive the Supermemory API key or
connect to a separate Supermemory MCP server.

`SupermemoryService` sends three semantic operations to Kairo Cloud: save, recall, and context.
The Kairo server cannot choose a Supermemory URL, endpoint, API key, or container tag. Kairo Cloud
verifies the installation grant, derives the tenant container tag, and makes the upstream call.

The local host exchanges the user's existing Clerk session through Kairo Cloud and writes the
installation grant to `ServerSecretStore` under `kairo.cloud.accessToken`.
`KAIRO_CLOUD_ACCESS_TOKEN` remains a self-hosting fallback. The Supermemory credential, signing
private key, and namespace HMAC key exist only in the Cloud API's Vercel environment. They never
enter settings JSON, provider configuration, WebSocket contracts, or client state.

Connection startup, status, and configuration refresh the grant from Clerk when a session is
available. Status and configuration then probe `/v1/capabilities`. A present but invalid or expired
grant does not make the service ready. Kairo Connect relay and the local Supermemory CLI are not
part of the memory request path.

`CloudSession.clerkToken` comes from Clerk identity, not managed relay availability. Web, desktop,
and mobile keep that session available for local, direct, Tailscale, and relay-backed connections.
The client connection driver sends the token through `serverProvisionMemoryAccess` after any
environment session becomes ready. The legacy RPC name now provisions shared Kairo Cloud access,
including a separate Composio-only provider grant. A missing relay URL leaves relay discovery
dormant and does not change grant provisioning.
