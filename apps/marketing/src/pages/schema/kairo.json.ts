import type { APIRoute } from "astro";

import { buildKairoProjectFileJsonSchema } from "@kairo/shared/kairoProjectFile";

// Rendered at build time; published at https://kairo-marketing-ebon.vercel.app/schema/kairo.json so
// kairo.json files can reference it via "$schema" for editor/LSP support.
export const GET: APIRoute = () =>
  new Response(`${JSON.stringify(buildKairoProjectFileJsonSchema(), null, 2)}\n`, {
    headers: { "Content-Type": "application/json" },
  });
