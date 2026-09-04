import type { DiscoveredLocalServer } from "@kairo/contracts";
import { describe, expect, it } from "vite-plus/test";

import { mergeServers } from "./useDiscoveredLocalServers";

const scannerServer = (
  overrides: Partial<DiscoveredLocalServer & { requestedUrl: string }>,
): DiscoveredLocalServer & { requestedUrl: string } => ({
  host: "localhost",
  port: 5173,
  url: "http://localhost:5173",
  requestedUrl: overrides.url ?? "http://localhost:5173",
  processName: "vite",
  pid: 1234,
  terminal: null,
  ...overrides,
});

describe("mergeServers", () => {
  it("marks a matching live configured server and keeps its process metadata", () => {
    const result = mergeServers({
      scanner: [scannerServer({ processName: "node", pid: 9999 })],
      configuredUrls: ["http://localhost:5173"],
    });

    expect(result[0]).toMatchObject({
      port: 5173,
      source: "configured",
      processName: "node",
      pid: 9999,
    });
  });

  it("ignores configured servers that are not live", () => {
    expect(mergeServers({ scanner: [], configuredUrls: ["http://localhost:5173"] })).toHaveLength(
      0,
    );
  });

  it("matches loopback aliases and prefers configured servers when sorting", () => {
    const result = mergeServers({
      scanner: [
        scannerServer({ host: "localhost", port: 3000 }),
        scannerServer({ host: "localhost", port: 8080 }),
      ],
      configuredUrls: ["http://127.0.0.1:8080"],
    });

    expect(result.map((server) => `${server.source}:${server.port}`)).toEqual([
      "configured:8080",
      "scanner:3000",
    ]);
  });

  it("uses a configured path only when the server cannot probe paths", () => {
    const result = mergeServers({
      scanner: [scannerServer({ requestedUrl: "http://localhost:5173/" })],
      configuredUrls: ["https://localhost:5173/docs?mode=test#results"],
      configuredUrlProbing: false,
    });

    expect(result[0]?.requestedUrl).toBe("https://localhost:5173/docs?mode=test#results");
  });
});
