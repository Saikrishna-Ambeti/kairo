import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vite-plus/test";

import { ComposerFeaturesMenuContent } from "./ComposerFeaturesMenu";
import { Menu } from "../ui/menu";

describe("ComposerFeaturesMenuContent", () => {
  it("labels Deep Research as a composer feature with its slash command", () => {
    const markup = renderToStaticMarkup(
      <Menu>
        <ComposerFeaturesMenuContent onDeepResearchSelect={() => {}} />
      </Menu>,
    );

    expect(markup).toContain("Features");
    expect(markup).toContain("Deep Research");
    expect(markup).toContain("/research");
  });
});
