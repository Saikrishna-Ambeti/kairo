import {
  normalizeMarkdownLinkDestination,
  splitMarkdownLinkSearchAndHash,
} from "@kairo/shared/markdownLinks";

export {
  classifyMarkdownImageSource,
  type MarkdownImageSource,
} from "@kairo/shared/markdownLinks";

export function markdownImageSourceFragment(source: string): string {
  return splitMarkdownLinkSearchAndHash(normalizeMarkdownLinkDestination(source)).hash;
}
