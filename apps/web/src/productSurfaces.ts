import {
  DEFAULT_PRODUCT_SURFACE_CONFIG,
  type ProductSurfaceConfig,
  type ServerConfig,
} from "@kairo/contracts";
import { useAtomValue } from "@effect/atom-react";

import { primaryServerConfigAtom } from "./state/server";

function resolveProductSurfaceConfig(
  config: Pick<ServerConfig, "surface"> | null | undefined,
): ProductSurfaceConfig {
  return config?.surface ?? DEFAULT_PRODUCT_SURFACE_CONFIG;
}

export function useProductSurfaceConfig(): ProductSurfaceConfig {
  return resolveProductSurfaceConfig(useAtomValue(primaryServerConfigAtom));
}

export function isSourceControlVisible(surface: ProductSurfaceConfig): boolean {
  return surface.sourceControl === "enabled";
}
