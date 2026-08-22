import { defineConfig } from "astro/config";

export default defineConfig({
  site: "https://kairo-marketing-ebon.vercel.app",
  server: {
    port: Number(process.env.PORT ?? 4173),
  },
});
