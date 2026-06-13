import { describe, expect, it } from "vite-plus/test";
import * as Schema from "effect/Schema";

import {
  ConfigureMemoryInput,
  DEFAULT_MEMORY_SETTINGS,
  InstallMemoryProvidersInput,
  SupermemoryStatus,
  TestMemoryConnectionInput,
} from "./memory.ts";
import { ProviderInstanceId } from "./providerInstance.ts";
import { DEFAULT_SERVER_SETTINGS, ServerSettings, ServerSettingsPatch } from "./settings.ts";

const decodeServerSettings = Schema.decodeUnknownSync(ServerSettings);
const decodeServerSettingsPatch = Schema.decodeUnknownSync(ServerSettingsPatch);
const encodeServerSettings = Schema.encodeSync(ServerSettings);
const decodeConfigureMemoryInput = Schema.decodeUnknownSync(ConfigureMemoryInput);
const decodeTestMemoryConnectionInput = Schema.decodeUnknownSync(TestMemoryConnectionInput);
const decodeInstallMemoryProvidersInput = Schema.decodeUnknownSync(InstallMemoryProvidersInput);
const decodeSupermemoryStatus = Schema.decodeUnknownSync(SupermemoryStatus);

describe("ServerSettings.providerInstances (slice-2 invariant)", () => {
  it("defaults to an empty record so legacy configs without the key still decode", () => {
    expect(DEFAULT_SERVER_SETTINGS.providerInstances).toEqual({});
  });

  it("decodes a fully empty config (legacy on-disk shape) without complaint", () => {
    const decoded = decodeServerSettings({});
    expect(decoded.providerInstances).toEqual({});
    // Legacy `providers` struct is still hydrated with its per-driver defaults
    // so existing call sites keep working through the migration.
    expect(decoded.providers.codex.enabled).toBe(true);
  });

  it("decodes a multi-instance map mixing first-party and fork drivers", () => {
    const decoded = decodeServerSettings({
      providerInstances: {
        codex_personal: {
          driver: "codex",
          displayName: "Codex (personal)",
          config: { homePath: "~/.codex_personal" },
        },
        codex_work: {
          driver: "codex",
          config: { homePath: "~/.codex_work" },
        },
        ollama_local: {
          driver: "ollama",
          displayName: "Ollama (local)",
          config: { endpoint: "http://localhost:11434" },
        },
      },
    });
    const personalId = ProviderInstanceId.make("codex_personal");
    const workId = ProviderInstanceId.make("codex_work");
    const ollamaId = ProviderInstanceId.make("ollama_local");

    expect(decoded.providerInstances[personalId]?.driver).toBe("codex");
    expect(decoded.providerInstances[workId]?.config).toEqual({ homePath: "~/.codex_work" });
    // Critical: a config naming a driver this build does not know about
    // (`ollama` is not in `ProviderDriverKind`) must round-trip without loss.
    // The runtime handles "driver not installed" — the schema must not.
    expect(decoded.providerInstances[ollamaId]?.driver).toBe("ollama");
    expect(decoded.providerInstances[ollamaId]?.config).toEqual({
      endpoint: "http://localhost:11434",
    });
  });

  it("rejects instance keys that violate the slug pattern", () => {
    expect(() =>
      decodeServerSettings({
        providerInstances: { "1bad": { driver: "codex" } },
      }),
    ).toThrow();
  });
});

describe("ServerSettingsPatch.providerInstances", () => {
  it("treats providerInstances as an optional whole-map replacement", () => {
    const patch = decodeServerSettingsPatch({});
    expect(patch.providerInstances).toBeUndefined();

    const replacement = decodeServerSettingsPatch({
      providerInstances: {
        codex_personal: { driver: "codex", config: { homePath: "~/.codex" } },
      },
    });
    expect(replacement.providerInstances).toBeDefined();
    expect(replacement.providerInstances?.[ProviderInstanceId.make("codex_personal")]?.driver).toBe(
      "codex",
    );
  });

  it("preserves a fork-defined driver entry through patch decoding", () => {
    const patch = decodeServerSettingsPatch({
      providerInstances: {
        ollama_local: {
          driver: "ollama",
          config: { endpoint: "http://localhost:11434" },
        },
      },
    });
    const ollamaId = ProviderInstanceId.make("ollama_local");
    expect(patch.providerInstances?.[ollamaId]?.driver).toBe("ollama");
  });
});

describe("ServerSettingsPatch string normalization", () => {
  it("trims string settings while decoding patches", () => {
    const patch = decodeServerSettingsPatch({
      addProjectBaseDirectory: "  ~/Development  ",
      textGenerationModelSelection: { model: "  gpt-5.4-mini  " },
      observability: {
        otlpTracesUrl: "  http://localhost:4318/v1/traces  ",
      },
      providers: {
        codex: {
          binaryPath: "  /opt/homebrew/bin/codex  ",
          homePath: "  ~/.codex  ",
        },
      },
      providerInstances: {
        codex_personal: {
          driver: "  codex  ",
          displayName: "  Codex Personal  ",
          config: { homePath: "  ~/.codex-personal  " },
        },
      },
    });

    expect(patch.addProjectBaseDirectory).toBe("~/Development");
    expect(patch.textGenerationModelSelection?.model).toBe("gpt-5.4-mini");
    expect(patch.observability?.otlpTracesUrl).toBe("http://localhost:4318/v1/traces");
    expect(patch.providers?.codex?.binaryPath).toBe("/opt/homebrew/bin/codex");
    expect(patch.providers?.codex?.homePath).toBe("~/.codex");
    expect(patch.providerInstances?.[ProviderInstanceId.make("codex_personal")]?.driver).toBe(
      "codex",
    );
    expect(patch.providerInstances?.[ProviderInstanceId.make("codex_personal")]?.displayName).toBe(
      "Codex Personal",
    );
    expect(patch.providerInstances?.[ProviderInstanceId.make("codex_personal")]?.config).toEqual({
      homePath: "  ~/.codex-personal  ",
    });
  });

  it("trims encoded server settings values before validation", () => {
    const defaultSettings = decodeServerSettings({});
    const encoded = encodeServerSettings({
      ...defaultSettings,
      addProjectBaseDirectory: "  ~/Development  ",
      providers: {
        ...defaultSettings.providers,
        codex: {
          ...defaultSettings.providers.codex,
          binaryPath: "  /opt/homebrew/bin/codex  ",
        },
      },
    });

    expect(encoded.addProjectBaseDirectory).toBe("~/Development");
    expect(encoded.providers?.codex?.binaryPath).toBe("/opt/homebrew/bin/codex");
  });
});

describe("ServerSettings.memory", () => {
  it("defaults Supermemory to disabled hosted user-scoped memory", () => {
    expect(DEFAULT_MEMORY_SETTINGS.supermemory).toEqual({
      enabled: false,
      mode: "hosted",
      scope: "user",
      providerInstanceIds: [],
      hosted: {
        apiUrl: "https://api.supermemory.ai",
      },
    });
    expect(DEFAULT_SERVER_SETTINGS.memory).toEqual(DEFAULT_MEMORY_SETTINGS);
  });

  it("decodes legacy settings without a memory key", () => {
    const decoded = decodeServerSettings({});

    expect(decoded.memory).toEqual(DEFAULT_MEMORY_SETTINGS);
  });

  it("decodes removed local Supermemory mode as hosted", () => {
    const decoded = decodeServerSettings({
      memory: {
        supermemory: {
          enabled: true,
          mode: "local",
          providerInstanceIds: ["codex"],
        },
      },
    });

    expect(decoded.memory.supermemory.mode).toBe("hosted");
    expect(decoded.memory.supermemory.providerInstanceIds).toEqual([
      ProviderInstanceId.make("codex"),
    ]);
  });

  it("decodes memory patches without requiring secrets in settings JSON", () => {
    const patch = decodeServerSettingsPatch({
      memory: {
        supermemory: {
          enabled: true,
          providerInstanceIds: ["codex", "claudeAgent"],
        },
      },
    });

    expect(patch.memory?.supermemory?.providerInstanceIds).toEqual([
      ProviderInstanceId.make("codex"),
      ProviderInstanceId.make("claudeAgent"),
    ]);
    expect(patch.memory?.supermemory).not.toHaveProperty("apiKey");
  });
});

describe("memory RPC schemas", () => {
  it("decodes configure/test/install payloads", () => {
    expect(
      decodeConfigureMemoryInput({
        apiKey: "sm_test",
        providerInstanceIds: ["codex"],
      }),
    ).toEqual({
      apiKey: "sm_test",
      providerInstanceIds: [ProviderInstanceId.make("codex")],
    });

    expect(decodeTestMemoryConnectionInput({ apiKey: "sm_test" })).toEqual({
      apiKey: "sm_test",
    });

    expect(decodeInstallMemoryProvidersInput({ providerInstanceIds: ["codex"] })).toEqual({
      providerInstanceIds: [ProviderInstanceId.make("codex")],
    });
  });

  it("decodes redacted Supermemory status without API key material", () => {
    const decoded = decodeSupermemoryStatus({
      enabled: true,
      mode: "hosted",
      scope: "user",
      auth: {
        hasApiKey: true,
        lastTestedAt: "2026-06-13T00:00:00.000Z",
      },
      providers: [
        {
          instanceId: "codex",
          driver: "codex",
          displayName: "Codex",
          selected: true,
          supported: true,
          status: "ready",
        },
      ],
    });

    expect(decoded.auth.hasApiKey).toBe(true);
    expect(decoded.providers[0]?.instanceId).toBe(ProviderInstanceId.make("codex"));
    expect(decoded).not.toHaveProperty("apiKey");
  });
});
