import { routes, type VercelConfig } from "@vercel/config/v1";

export const config: VercelConfig = {
  git: {
    deploymentEnabled: false,
  },
  installCommand:
    "npm install -g vite-plus && vp install --ignore-scripts --filter 'kairo-cloud-api...'",
  functions: {
    "api/**/*.ts": {
      includeFiles: "../../packages/contracts/src/**",
    },
  },
  rewrites: [
    routes.rewrite("/health", "/api/health"),
    routes.rewrite("/v1/(.*)", "/api/v1?__kairo_path=$1"),
  ],
};
