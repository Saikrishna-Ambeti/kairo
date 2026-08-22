import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vite-plus/test";

import { PanelLayoutControls } from "./PanelLayoutControls";

describe("PanelLayoutControls", () => {
  it("keeps unavailable panel tooltip triggers interactive", () => {
    const markup = renderToStaticMarkup(
      <PanelLayoutControls
        rightPanelAvailable={false}
        rightPanelOpen={false}
        rightPanelShortcutLabel={null}
        liveAgentCount={0}
        onToggleRightPanel={() => {}}
      />,
    );

    expect(markup.match(/data-slot="tooltip-trigger"/g)).toHaveLength(1);
    expect(markup.match(/data-slot="tooltip-trigger"[^>]*><button[^>]*disabled=""/g)).toHaveLength(
      1,
    );
  });
});
