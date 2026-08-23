import { describe, expect, it } from "vite-plus/test";

import { resolveDeepResearchProviderInput } from "./deepResearchPrompt.ts";

describe("deep research provider input", () => {
  it("turns /research into a provider-neutral research brief", () => {
    const result = resolveDeepResearchProviderInput("/research compare the two proposals");

    expect(result.deepResearch).toBe(true);
    expect(result.input).toContain("Run the research as background work");
    expect(result.input).toContain("Prefer primary sources");
    expect(result.input).toContain("Research request:\ncompare the two proposals");
    expect(result.input).not.toContain("/research");
  });

  it("leaves ordinary provider input unchanged", () => {
    expect(resolveDeepResearchProviderInput("compare the two proposals")).toEqual({
      deepResearch: false,
      input: "compare the two proposals",
    });
  });

  it("supports attachment-led research", () => {
    expect(resolveDeepResearchProviderInput("/research").input).toContain(
      "Research the attached material",
    );
  });
});
