import { ProviderDriverKind, ProviderInstanceId } from "@kairo/contracts";
import { describe, expect, it } from "@effect/vitest";
import { Tool } from "effect/unstable/ai";

import { MemoryContextTool, MemoryTool, RecallTool } from "../mcp/toolkits/memory/tools.ts";
import { computeProviderMemoryStatus, isSupermemoryDriverSupported } from "./SupermemoryMcp.ts";

const codex = ProviderDriverKind.make("codex");
const codexInstanceId = ProviderInstanceId.make("codex");

describe("hosted Supermemory", () => {
  it("supports every built-in provider through Kairo's MCP server", () => {
    expect(
      ["codex", "claudeAgent", "cursor", "grok", "opencode"].every((driver) =>
        isSupermemoryDriverSupported(ProviderDriverKind.make(driver)),
      ),
    ).toBe(true);
  });

  it("marks a selected provider ready when the hosted service is configured", () => {
    expect(
      computeProviderMemoryStatus({
        instanceId: codexInstanceId,
        driver: codex,
        displayName: "Codex",
        selected: true,
        serviceConfigured: true,
      }),
    ).toMatchObject({ selected: true, supported: true, status: "ready" });
  });

  it("reports server service availability without asking the user for a key", () => {
    const status = computeProviderMemoryStatus({
      instanceId: codexInstanceId,
      driver: codex,
      displayName: "Codex",
      selected: true,
      serviceConfigured: false,
    });

    expect(status).toMatchObject({ status: "needs_action" });
    expect(status.message).toBe("Hosted Supermemory is unavailable on this server.");
  });

  it("does not expose containerTag in any provider-facing tool input", () => {
    const schemas = [MemoryTool, RecallTool, MemoryContextTool].map((tool) =>
      JSON.stringify(Tool.getJsonSchema(tool)),
    );

    expect(schemas.every((schema) => !schema.includes("containerTag"))).toBe(true);
  });
});
