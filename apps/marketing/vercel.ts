import type { VercelConfig } from "@vercel/config/v1";

export const config: VercelConfig = {
  installCommand: "npm install -g vite-plus && vp install --filter '@kairo/marketing'",
  buildCommand: "vp run --filter @kairo/marketing build",
  outputDirectory: "dist",
};
