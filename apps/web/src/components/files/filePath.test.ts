import { describe, expect, it } from "vite-plus/test";

import {
  breadcrumbPathOf,
  fileBreadcrumbChildren,
  fileBreadcrumbs,
  isListableHostFolder,
  retainedBreadcrumbTrail,
} from "./filePath";

describe("fileBreadcrumbs", () => {
  it("starts host paths outside the workspace at the filesystem root", () => {
    expect(fileBreadcrumbs("kairo", "/tmp/kairo-cleanup/report.md")).toEqual([
      { label: "tmp", path: "/tmp", kind: "directory" },
      { label: "kairo-cleanup", path: "/tmp/kairo-cleanup", kind: "directory" },
      { label: "report.md", path: "/tmp/kairo-cleanup/report.md", kind: "file" },
    ]);
    expect(fileBreadcrumbs("kairo", "C:\\Temp\\report.md")).toEqual([
      { label: "C:", path: "C:\\", kind: "directory" },
      { label: "Temp", path: "C:\\Temp", kind: "directory" },
      { label: "report.md", path: "C:\\Temp\\report.md", kind: "file" },
    ]);
    expect(fileBreadcrumbs("kairo", "\\\\server\\share\\report.md").map((c) => c.path)).toEqual([
      "\\\\server",
      "\\\\server\\share",
      "\\\\server\\share\\report.md",
    ]);
  });

  it("builds home-relative breadcrumbs with navigable folders", () => {
    expect(fileBreadcrumbs("kairo", "~/.claude/CLAUDE.md")).toEqual([
      { label: "~", path: "~/", kind: "directory" },
      { label: ".claude", path: "~/.claude", kind: "directory" },
      { label: "CLAUDE.md", path: "~/.claude/CLAUDE.md", kind: "file" },
    ]);
    expect(fileBreadcrumbs("kairo", "~\\.claude/CLAUDE.md")).toEqual([
      { label: "~", path: "~/", kind: "directory" },
      { label: ".claude", path: "~/.claude", kind: "directory" },
      { label: "CLAUDE.md", path: "~/.claude/CLAUDE.md", kind: "file" },
    ]);
    expect(isListableHostFolder("~/")).toBe(true);
    expect(isListableHostFolder("~/.claude")).toBe(true);
  });

  it("keeps a literal backslash inside a workspace path segment", () => {
    expect(fileBreadcrumbs("kairo", "dir\\one/report.txt")).toEqual([
      { label: "kairo", path: "", kind: "project" },
      { label: "dir\\one", path: "dir\\one", kind: "directory" },
      { label: "report.txt", path: "dir\\one/report.txt", kind: "file" },
    ]);
  });

  it("keeps a project folder named ~ inside the project", () => {
    expect(fileBreadcrumbs("kairo", "~").map((crumb) => crumb.path)).toEqual(["", "~"]);
  });
});

describe("breadcrumbPathOf", () => {
  it("keeps the home root listable", () => {
    expect(breadcrumbPathOf("~/")).toBe("~/");
  });
});

describe("fileBreadcrumbChildren", () => {
  const entries = [
    { path: "README.md", kind: "file" as const },
    { path: "src", kind: "directory" as const },
    { path: "src-old", kind: "directory" as const },
    { path: "src/index.ts", kind: "file" as const },
    { path: "src/lib", kind: "directory" as const },
    { path: "src/lib/file10.ts", kind: "file" as const },
    { path: "src/lib/file2.ts", kind: "file" as const },
    { path: "src-old/index.ts", kind: "file" as const },
  ];

  it("honors segment boundaries and sorts folders before files", () => {
    expect(fileBreadcrumbChildren(entries, "src")).toEqual([
      { path: "src/lib", kind: "directory", label: "lib" },
      { path: "src/index.ts", kind: "file", label: "index.ts" },
    ]);
  });
});

describe("retainedBreadcrumbTrail", () => {
  it.each([
    ["apps/web/src", "apps/web", "apps/web/src"],
    ["apps/web/src", "", "apps/web/src"],
    ["apps/web/src", "apps/web/src", "apps/web/src"],
    ["apps/web/src", "apps/mobile", "apps/mobile"],
    ["src/lib", "src-old", "src-old"],
    ["apps/web", "apps/web/src/main.tsx", "apps/web/src/main.tsx"],
    ["apps/web/src", "/tmp/report", "/tmp/report"],
    ["/tmp/report", "", ""],
    ["C:\\Temp\\a", "", ""],
    ["/Users/me/projects/scope", "/Users/me", "/Users/me/projects/scope"],
    ["/Users/me/projects/scope", "/Users/me/proj", "/Users/me/proj"],
    ["/Volumes/Work/a", "/Volumes/Work/a/", "/Volumes/Work/a"],
    ["C:\\Users\\me\\scope", "C:\\", "C:\\Users\\me\\scope"],
    ["C:\\Users\\me\\scope", "C:\\Users", "C:\\Users\\me\\scope"],
    ["C:\\Users\\me\\scope", "D:\\", "D:\\"],
    ["\\\\nas\\share\\docs\\notes", "\\\\nas\\share", "\\\\nas\\share\\docs\\notes"],
  ])("from trail %j to %j keeps %j", (trail, path, expected) => {
    expect(retainedBreadcrumbTrail(trail, path)).toBe(expected);
  });
});
