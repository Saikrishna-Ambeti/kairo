import { EnvironmentId, ThreadId } from "@kairo/contracts";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vite-plus/test";

vi.mock("./PreviewFaviconIcon", () => ({
  PreviewFaviconIcon: () => <span data-favicon-icon />,
}));

import { PreviewEmptyState } from "./PreviewEmptyState";

const environmentId = EnvironmentId.make("env-1");
const threadRef = { environmentId, threadId: ThreadId.make("thread-1") };

function render(recentEntries: Array<{ url: string; lastVisitedAt: number; title?: string }>) {
  return renderToStaticMarkup(
    <PreviewEmptyState
      threadRef={threadRef}
      recentEntries={recentEntries}
      onRemoveRecent={() => undefined}
      onOpenUrl={() => undefined}
    />,
  );
}

describe("PreviewEmptyState", () => {
  it("renders recent browser history", () => {
    const html = render([
      { url: "https://myapp.test/admin#users", lastVisitedAt: Date.now(), title: "Admin" },
      { url: "http://localhost:5173/", lastVisitedAt: Date.now(), title: "Recent Local" },
    ]);
    expect(html).toContain("Recently used");
    expect(html).toContain("myapp.test/admin#users");
    expect(html).toContain("Admin");
    expect(html).toContain("Recent Local");
    expect(html).not.toContain("Local servers");
  });

  it("shows URL guidance when history is empty", () => {
    const html = render([]);
    expect(html).toContain("No preview yet");
    expect(html).toContain("Type a URL above to open a page.");
  });

  it("renders an out-of-range lastVisitedAt entry without throwing", () => {
    let html = "";
    expect(() => {
      html = render([{ url: "https://myapp.test/", lastVisitedAt: 1e20 }]);
    }).not.toThrow();
    expect(html).toContain("myapp.test");
    expect(html).toContain("Remove");
  });
});
