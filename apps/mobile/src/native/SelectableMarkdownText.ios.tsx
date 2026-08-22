import {
  SelectableMarkdownText as KairoSelectableMarkdownText,
  type SelectableMarkdownTextProps,
} from "@kairo/mobile-markdown-text/renderer";

import { highlightCodeSnippet } from "../features/review/shikiReviewHighlighter";

type MobileSelectableMarkdownTextProps = Omit<SelectableMarkdownTextProps, "highlightCode">;

export type {
  NativeMarkdownTextStyle,
  SelectableMarkdownSkill,
} from "@kairo/mobile-markdown-text/types";

export function hasNativeSelectableMarkdownText(): boolean {
  return true;
}

export function SelectableMarkdownText(props: MobileSelectableMarkdownTextProps) {
  return <KairoSelectableMarkdownText {...props} highlightCode={highlightCodeSnippet} />;
}
