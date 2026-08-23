import type * as EffectAcpSchema from "effect-acp/schema";

import { COMPOSIO_AUTHORIZATION_ENV, COMPOSIO_MCP_URL_ENV } from "./ComposioProviderBindings.ts";

function getComposioMcpConnection(environment: NodeJS.ProcessEnv | undefined) {
  const url = environment?.[COMPOSIO_MCP_URL_ENV]?.trim();
  const authorization = environment?.[COMPOSIO_AUTHORIZATION_ENV]?.trim();
  return url && authorization ? { url, authorization } : null;
}

export function getComposioMcpUrl(environment: NodeJS.ProcessEnv | undefined): string | null {
  return getComposioMcpConnection(environment)?.url ?? null;
}

export function buildComposioMcpHeaders(
  environment: NodeJS.ProcessEnv | undefined,
): Record<string, string> | null {
  const connection = getComposioMcpConnection(environment);
  return connection ? { authorization: connection.authorization } : null;
}

export function buildComposioAcpMcpServers(
  environment: NodeJS.ProcessEnv | undefined,
): ReadonlyArray<EffectAcpSchema.McpServer> {
  const headers = buildComposioMcpHeaders(environment);
  const connection = getComposioMcpConnection(environment);
  if (!headers || !connection) return [];
  return [
    {
      type: "http",
      name: "composio",
      url: connection.url,
      headers: Object.entries(headers).map(([name, value]) => ({ name, value })),
    },
  ];
}

export function buildComposioCodexArgs(
  environment: NodeJS.ProcessEnv | undefined,
): ReadonlyArray<string> {
  const connection = getComposioMcpConnection(environment);
  if (!connection) return [];
  return [
    "-c",
    `mcp_servers.composio.url=${JSON.stringify(connection.url)}`,
    "-c",
    `mcp_servers.composio.env_http_headers={ "Authorization" = ${JSON.stringify(COMPOSIO_AUTHORIZATION_ENV)} }`,
  ];
}
