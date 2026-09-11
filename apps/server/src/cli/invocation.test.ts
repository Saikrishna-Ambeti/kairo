import { assert, it } from "@effect/vitest";

import { formatCliCommand } from "./invocation.ts";

it("formats package runner commands from their cache entry paths", () => {
  for (const [entryPath, expected] of [
    ["/home/theo/.npm/_npx/abc123/node_modules/kairo/dist/bin.mjs", "npx kairo serve"],
    [
      "C:\\Users\\theo\\AppData\\Local\\npm-cache\\_npx\\abc\\node_modules\\kairo\\dist\\bin.mjs",
      "npx kairo serve",
    ],
    ["/home/theo/.cache/pnpm/dlx/abc/node_modules/kairo/dist/bin.mjs", "pnpm dlx kairo serve"],
    [
      "/home/theo/.local/share/pnpm/.pnpm/dlx/abc/node_modules/kairo/dist/bin.mjs",
      "pnpm dlx kairo serve",
    ],
    [
      "C:\\Users\\theo\\AppData\\Local\\pnpm-cache\\dlx\\abc\\node_modules\\kairo\\dist\\bin.mjs",
      "pnpm dlx kairo serve",
    ],
    ["/home/theo/.bun/install/cache/kairo@0.0.31/dist/bin.mjs", "bunx kairo serve"],
    ["/tmp/bunx-1000-kairo@latest/node_modules/kairo/dist/bin.mjs", "bunx kairo serve"],
    [
      "C:\\Users\\theo\\AppData\\Local\\Temp\\bunx-0-kairo@latest\\node_modules\\kairo\\dist\\bin.mjs",
      "bunx kairo serve",
    ],
  ] as const) {
    assert.equal(formatCliCommand({ subcommand: "serve", entryPath, version: "0.0.31" }), expected);
  }
});

it("treats stable installs as direct invocations", () => {
  for (const entryPath of [
    "/usr/local/lib/node_modules/kairo/dist/bin.mjs",
    "/home/theo/Code/work/kairo/apps/server/dist/bin.mjs",
    "/home/theo/.kairo/runtime/0.0.31/node_modules/kairo/dist/bin.mjs",
    "",
  ]) {
    assert.equal(
      formatCliCommand({ subcommand: "serve", entryPath, version: "0.0.31" }),
      "kairo serve",
    );
  }
});

it("re-suggests the nightly channel only for nightly builds", () => {
  for (const [version, expected] of [
    ["0.0.31-nightly.20260729", "npx kairo@nightly serve"],
    ["0.0.31", "npx kairo serve"],
  ] as const) {
    assert.equal(
      formatCliCommand({
        subcommand: "serve",
        entryPath: "/home/theo/.npm/_npx/abc123/node_modules/kairo/dist/bin.mjs",
        version,
      }),
      expected,
    );
  }
});

it("formats serve suggestions to match the launching command", () => {
  assert.equal(
    formatCliCommand({
      subcommand: "serve",
      entryPath: "/home/theo/.npm/_npx/abc/node_modules/kairo/dist/bin.mjs",
      version: "0.0.31-nightly.20260729",
    }),
    "npx kairo@nightly serve",
  );
  assert.equal(
    formatCliCommand({
      subcommand: "serve",
      entryPath: "/tmp/bunx-1000-kairo@latest/node_modules/kairo/dist/bin.mjs",
      version: "0.0.31",
    }),
    "bunx kairo serve",
  );
  assert.equal(
    formatCliCommand({
      subcommand: "serve",
      entryPath: "/usr/local/lib/node_modules/kairo/dist/bin.mjs",
      version: "0.0.31-nightly.20260729",
    }),
    "kairo serve",
  );
});
