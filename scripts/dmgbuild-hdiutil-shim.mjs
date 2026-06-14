#!/usr/bin/env node

import { cp, mkdir, mkdtemp, readFile, rm, symlink } from "node:fs/promises";
import { tmpdir } from "node:os";
import { basename, dirname, join } from "node:path";
import { spawn } from "node:child_process";

function usage() {
  console.error("Usage: dmgbuild-hdiutil-shim -s <settings.json> <volumeName> <artifactPath>");
}

function parseArgs(argv) {
  const settingsFlagIndex = argv.indexOf("-s");
  if (settingsFlagIndex < 0 || settingsFlagIndex + 1 >= argv.length) {
    usage();
    process.exit(2);
  }

  const settingsPath = argv[settingsFlagIndex + 1];
  const positional = argv.filter(
    (_, index) => index !== settingsFlagIndex && index !== settingsFlagIndex + 1,
  );
  if (positional.length !== 2) {
    usage();
    process.exit(2);
  }

  return {
    settingsPath,
    volumeName: positional[0],
    artifactPath: positional[1],
  };
}

function run(command, args) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, { stdio: "inherit" });
    child.on("error", reject);
    child.on("exit", (code, signal) => {
      if (code === 0) {
        resolve();
        return;
      }
      reject(new Error(`${command} exited with ${signal ?? code}`));
    });
  });
}

function contentName(content) {
  if (typeof content.name === "string" && content.name.length > 0) {
    return content.name;
  }
  if (typeof content.path === "string" && content.path.length > 0) {
    return basename(content.path);
  }
  return undefined;
}

async function stageContents(settings, sourceDir) {
  const contents = Array.isArray(settings.contents) ? settings.contents : [];
  for (const content of contents) {
    if (!content || typeof content !== "object") continue;
    const name = contentName(content);
    if (!name) continue;

    const targetPath = join(sourceDir, name);
    if (content.type === "link") {
      if (typeof content.path !== "string" || content.path.length === 0) continue;
      await symlink(content.path, targetPath);
      continue;
    }

    if (typeof content.path !== "string" || content.path.length === 0) continue;
    await cp(content.path, targetPath, {
      recursive: true,
      preserveTimestamps: true,
      verbatimSymlinks: true,
    });
  }
}

async function main() {
  const { settingsPath, volumeName, artifactPath } = parseArgs(process.argv.slice(2));
  const settings = JSON.parse(await readFile(settingsPath, "utf8"));
  const tmpRoot = await mkdtemp(join(tmpdir(), "kairo-dmg-"));

  try {
    const sourceDir = join(tmpRoot, "contents");
    await mkdir(sourceDir, { recursive: true });
    await mkdir(dirname(artifactPath), { recursive: true });
    await stageContents(settings, sourceDir);

    const args = [
      "create",
      "-volname",
      volumeName,
      "-srcfolder",
      sourceDir,
      "-ov",
      "-format",
      typeof settings.format === "string" && settings.format.length > 0 ? settings.format : "UDZO",
    ];

    if (typeof settings.size === "string" && settings.size.trim().length > 0) {
      args.push("-size", settings.size.trim());
    }

    args.push(artifactPath);
    await run("hdiutil", args);
  } finally {
    await rm(tmpRoot, { recursive: true, force: true });
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.stack : error);
  process.exit(1);
});
