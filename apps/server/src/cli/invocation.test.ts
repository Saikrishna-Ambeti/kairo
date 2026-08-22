import { assert, it } from "@effect/vitest";

import { detectCliRunner, formatCliCommand, suggestedPackageSpec } from "./invocation.ts";

it("detects package runners from their cache entry paths", () => {
  assert.equal(
    detectCliRunner("/home/theo/.npm/_npx/abc123/node_modules/kairo/dist/bin.mjs"),
    "npx",
  );
  assert.equal(
    detectCliRunner(
      "C:\\Users\\theo\\AppData\\Local\\npm-cache\\_npx\\abc\\node_modules\\kairo\\dist\\bin.mjs",
    ),
    "npx",
  );
  assert.equal(
    detectCliRunner("/home/theo/.cache/pnpm/dlx/abc/node_modules/kairo/dist/bin.mjs"),
    "pnpm dlx",
  );
  assert.equal(
    detectCliRunner("/home/theo/.local/share/pnpm/.pnpm/dlx/abc/node_modules/kairo/dist/bin.mjs"),
    "pnpm dlx",
  );
  assert.equal(
    detectCliRunner(
      "C:\\Users\\theo\\AppData\\Local\\pnpm-cache\\dlx\\abc\\node_modules\\kairo\\dist\\bin.mjs",
    ),
    "pnpm dlx",
  );
  assert.equal(detectCliRunner("/home/theo/.bun/install/cache/kairo@0.0.31/dist/bin.mjs"), "bunx");
  assert.equal(
    detectCliRunner("/tmp/bunx-1000-kairo@latest/node_modules/kairo/dist/bin.mjs"),
    "bunx",
  );
  assert.equal(
    detectCliRunner(
      "C:\\Users\\theo\\AppData\\Local\\Temp\\bunx-0-kairo@latest\\node_modules\\kairo\\dist\\bin.mjs",
    ),
    "bunx",
  );
});

it("treats stable installs as direct invocations", () => {
  assert.isNull(detectCliRunner("/usr/local/lib/node_modules/kairo/dist/bin.mjs"));
  assert.isNull(detectCliRunner("/home/theo/Code/work/kairo/apps/server/dist/bin.mjs"));
  assert.isNull(
    detectCliRunner("/home/theo/.kairo/runtime/0.0.31/node_modules/kairo/dist/bin.mjs"),
  );
  assert.isNull(detectCliRunner(""));
});

it("re-suggests the nightly channel only for nightly builds", () => {
  assert.equal(suggestedPackageSpec("0.0.31-nightly.20260729"), "kairo@nightly");
  assert.equal(suggestedPackageSpec("0.0.31"), "kairo");
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
