import type * as EffectAcpSchema from "effect-acp/schema";

import { COMPOSIO_API_KEY_ENV, COMPOSIO_MCP_URL } from "./ComposioProviderBindings.ts";

export function getComposioMcpApiKey(environment: NodeJS.ProcessEnv | undefined): string | null {
  return environment?.[COMPOSIO_API_KEY_ENV]?.trim() || null;
}

export function buildComposioMcpHeaders(
  environment: NodeJS.ProcessEnv | undefined,
): Record<string, string> | null {
  const apiKey = getComposioMcpApiKey(environment);
  return apiKey ? { "x-consumer-api-key": apiKey } : null;
}

export function buildComposioAcpMcpServers(
  environment: NodeJS.ProcessEnv | undefined,
): ReadonlyArray<EffectAcpSchema.McpServer> {
  const headers = buildComposioMcpHeaders(environment);
  if (!headers) return [];
  return [
    {
      type: "http",
      name: "composio",
      url: COMPOSIO_MCP_URL,
      headers: Object.entries(headers).map(([name, value]) => ({ name, value })),
    },
  ];
}

export function buildComposioCodexArgs(
  environment: NodeJS.ProcessEnv | undefined,
): ReadonlyArray<string> {
  if (!getComposioMcpApiKey(environment)) return [];
  return [
    "-c",
    `mcp_servers.composio.url=${JSON.stringify(COMPOSIO_MCP_URL)}`,
    "-c",
    `mcp_servers.composio.env_http_headers={ "x-consumer-api-key" = ${JSON.stringify(COMPOSIO_API_KEY_ENV)} }`,
  ];
}
