import * as Schema from "effect/Schema";
import { describe, expect, it } from "vite-plus/test";

import { parseKairoProjectFile, KairoProjectFileFromJson } from "./kairoProjectFile.ts";

const decodeJson = Schema.decodeUnknownSync(KairoProjectFileFromJson);

describe("KairoProjectFileFromJson", () => {
  it("decodes lenient JSONC with comments and trailing commas", () => {
    const decoded = decodeJson(`{
      // team scripts
      "iconPath": "assets/logo.svg",
      "scripts": [
        { "name": "Dev", "command": "pnpm dev", "stopOnSettle": true, },
      ],
    }`);

    expect(decoded.iconPath).toBe("assets/logo.svg");
    expect(decoded.scripts?.[0]).toEqual({ name: "Dev", command: "pnpm dev", stopOnSettle: true });
  });
});

describe("parseKairoProjectFile", () => {
  it("reads project defaults from JSONC with a URL in a block comment", () => {
    expect(
      parseKairoProjectFile(`{
        /* See https://kairo.codes/schema/kairo.json */
        "defaultThreadEnvMode": "worktree"
      }`),
    ).toEqual({ defaultThreadEnvMode: "worktree" });
  });
});
