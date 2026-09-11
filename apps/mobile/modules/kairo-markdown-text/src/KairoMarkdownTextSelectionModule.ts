import { requireOptionalNativeModule } from "expo";

interface KairoMarkdownTextSelectionNativeModule {
  readonly installCopySanitizer: (reactTag: number) => void;
}

const nativeModule =
  requireOptionalNativeModule<KairoMarkdownTextSelectionNativeModule>("KairoMarkdownTextSelection");

export function installMarkdownCopySanitizer(reactTag: number): void {
  nativeModule?.installCopySanitizer(reactTag);
}
