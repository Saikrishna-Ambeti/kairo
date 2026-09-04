import type { PreviewSessionSnapshot, ProjectScript } from "@kairo/contracts";
import { describe, expect, it } from "vite-plus/test";

import { getConfiguredPreviewUrls, shouldShowPreviewEmptyState } from "./previewEmptyStateLogic";

const snapshot = (navStatus: PreviewSessionSnapshot["navStatus"]): PreviewSessionSnapshot => ({
  threadId: "thread-1",
  tabId: "tab-1",
  navStatus,
  canGoBack: false,
  canGoForward: false,
  updatedAt: "2026-06-12T20:00:00.000Z",
});

describe("preview empty state", () => {
  it("shows quick-open options only for an idle browser tab", () => {
    expect(shouldShowPreviewEmptyState(snapshot({ _tag: "Idle" }))).toBe(true);
    expect(
      shouldShowPreviewEmptyState(
        snapshot({ _tag: "Loading", url: "http://localhost:5173", title: "" }),
      ),
    ).toBe(false);
  });

  it("collects configured preview URLs from project scripts", () => {
    const scripts = [
      { previewUrl: "http://localhost:5173" },
      {},
      { previewUrl: "http://localhost:3000" },
    ] as ProjectScript[];

    expect(getConfiguredPreviewUrls(scripts)).toEqual([
      "http://localhost:5173",
      "http://localhost:3000",
    ]);
  });
});
