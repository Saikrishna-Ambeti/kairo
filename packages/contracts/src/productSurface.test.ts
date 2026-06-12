import { describe, expect, it } from "vite-plus/test";
import * as Schema from "effect/Schema";

import {
  DEFAULT_PRODUCT_SURFACE_CONFIG,
  DEVELOPER_PRODUCT_SURFACES,
  NON_TECHNICAL_AI_SURFACES,
  ProductSurfaceConfigWithDefault,
  SurfaceUnavailableError,
} from "./productSurface.ts";

const decodeProductSurfaceConfig = Schema.decodeUnknownSync(ProductSurfaceConfigWithDefault);
const decodeSurfaceUnavailableError = Schema.decodeUnknownSync(SurfaceUnavailableError);

describe("ProductSurfaceConfigWithDefault", () => {
  it("defaults omitted snapshots to the non-technical AI surface", () => {
    expect(decodeProductSurfaceConfig(undefined)).toEqual(DEFAULT_PRODUCT_SURFACE_CONFIG);
    expect(DEFAULT_PRODUCT_SURFACE_CONFIG).toEqual(NON_TECHNICAL_AI_SURFACES);
  });

  it("decodes the full developer surface for explicit opt-in snapshots", () => {
    expect(decodeProductSurfaceConfig(DEVELOPER_PRODUCT_SURFACES)).toEqual(
      DEVELOPER_PRODUCT_SURFACES,
    );
  });
});

describe("SurfaceUnavailableError", () => {
  it("round-trips the disabled surface key", () => {
    const error = decodeSurfaceUnavailableError({
      _tag: "SurfaceUnavailableError",
      code: "SURFACE_DISABLED",
      surface: "terminal",
      message: "Terminal is not available.",
    });

    expect(error).toBeInstanceOf(SurfaceUnavailableError);
    expect(error._tag).toBe("SurfaceUnavailableError");
    expect(error.code).toBe("SURFACE_DISABLED");
    expect(error.surface).toBe("terminal");
    expect(error.message).toBe("Terminal is not available.");
  });
});
