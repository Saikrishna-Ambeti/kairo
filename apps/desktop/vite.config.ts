import { defineConfig } from "vite-plus";

import { loadRepoEnv } from "../../scripts/lib/public-config.ts";

const repoEnv = loadRepoEnv();
const shouldLaunchElectronAfterPack = process.env.KAIRO_DESKTOP_DEV === "1";
const publicConfigDefine = {
  __KAIRO_BUILD_CLERK_PUBLISHABLE_KEY__: JSON.stringify(
    repoEnv.KAIRO_CLERK_PUBLISHABLE_KEY?.trim() ?? "",
  ),
};

export default defineConfig({
  run: {
    tasks: {
      build: {
        command: "vp pack",
        dependsOn: ["kairo#build"],
        cache: false,
      },
      dev: {
        command: "cross-env KAIRO_DESKTOP_DEV=1 vp pack --watch",
        dependsOn: ["kairo#build"],
        cache: false,
      },
      "dev:bundle": {
        command: "vp pack --watch",
        cache: false,
      },
      "dev:electron": {
        command: "node scripts/dev-electron.mjs",
        dependsOn: ["kairo#build"],
        cache: false,
      },
    },
  },
  pack: [
    {
      format: "cjs",
      outDir: "dist-electron",
      sourcemap: true,
      outExtensions: () => ({ js: ".cjs" }),
      define: publicConfigDefine,
      entry: ["src/main.ts"],
      clean: true,
      deps: {
        alwaysBundle: (id) => id.startsWith("@kairo/"),
      },
      ...(shouldLaunchElectronAfterPack ? { onSuccess: "node scripts/dev-electron.mjs" } : {}),
    },
    {
      format: "cjs",
      outDir: "dist-electron",
      sourcemap: true,
      outExtensions: () => ({ js: ".cjs" }),
      define: publicConfigDefine,
      entry: ["src/preload.ts"],
    },
  ],
});
