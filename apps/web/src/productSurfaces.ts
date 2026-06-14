import {
  DEFAULT_PRODUCT_SURFACE_CONFIG,
  type ProductSurfaceConfig,
  type ServerConfig,
} from "@kairo/contracts";

import { useServerConfig } from "./rpc/serverState";

export function resolveProductSurfaceConfig(
  config: Pick<ServerConfig, "surface"> | null | undefined,
): ProductSurfaceConfig {
  return config?.surface ?? DEFAULT_PRODUCT_SURFACE_CONFIG;
}

export function useProductSurfaceConfig(): ProductSurfaceConfig {
  return resolveProductSurfaceConfig(useServerConfig());
}

export function isSourceControlVisible(surface: ProductSurfaceConfig): boolean {
  return surface.sourceControl === "enabled";
}

export function areSourceControlProvidersVisible(surface: ProductSurfaceConfig): boolean {
  return surface.sourceControlProviders === "enabled";
}

export function isDiffViewerVisible(surface: ProductSurfaceConfig): boolean {
  return surface.diffViewer === "enabled";
}

export function isCheckpointRollbackVisible(surface: ProductSurfaceConfig): boolean {
  return surface.checkpointRollback === "enabled";
}

export function isTerminalEnabled(surface: ProductSurfaceConfig): boolean {
  return surface.terminal === "enabled";
}

export function areDeveloperKeybindingsVisible(surface: ProductSurfaceConfig): boolean {
  return surface.developerKeybindings === "enabled";
}
