import { GTProvider, initializeGT } from "gt-react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vite-plus/test";

import { ComposerFeaturesMenuContent } from "./ComposerFeaturesMenu";
import { Menu } from "../ui/menu";

initializeGT({ defaultLocale: "en", locales: ["en"] });

describe("ComposerFeaturesMenuContent", () => {
  it("labels Deep Research as a composer feature with its slash command", () => {
    const markup = renderToStaticMarkup(
      <GTProvider locale="en" translations={{}}>
        <Menu>
          <ComposerFeaturesMenuContent onDeepResearchSelect={() => {}} />
        </Menu>
      </GTProvider>,
    );

    expect(markup).toContain("Features");
    expect(markup).toContain("Deep Research");
    expect(markup).toContain("/research");
  });
});
