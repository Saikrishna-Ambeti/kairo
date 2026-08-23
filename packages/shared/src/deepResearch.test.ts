import { describe, expect, it } from "vite-plus/test";

import { activateDeepResearchPrompt, parseDeepResearchRequest } from "./deepResearch.ts";

describe("deep research prompt", () => {
  it("parses the built-in command without matching longer command names", () => {
    expect(parseDeepResearchRequest("/research compare two sources")).toEqual({
      query: "compare two sources",
      commandLength: 9,
    });
    expect(parseDeepResearchRequest("/RESEARCH\ncompare two sources")?.query).toBe(
      "compare two sources",
    );
    expect(parseDeepResearchRequest("/researcher compare two sources")).toBeNull();
  });

  it("activates research once and keeps the existing draft", () => {
    expect(activateDeepResearchPrompt("")).toBe("/research ");
    expect(activateDeepResearchPrompt("compare two sources")).toBe("/research compare two sources");
    expect(activateDeepResearchPrompt("/research compare two sources")).toBe(
      "/research compare two sources",
    );
  });
});
