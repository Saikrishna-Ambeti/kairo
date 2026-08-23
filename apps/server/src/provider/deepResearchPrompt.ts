import { parseDeepResearchRequest } from "@kairo/shared/deepResearch";

const DEEP_RESEARCH_BRIEF = `This is a deep research request. Run the research as background work so the user can continue elsewhere in Kairo. Use background agents for independent lines of inquiry when the provider supports them. Prefer primary sources, verify material claims across independent sources, include source links, and separate facts from inference. State important gaps or conflicts. Do not edit project files or take external actions unless the user asks.`;

export type ResolvedDeepResearchInput = {
  readonly deepResearch: boolean;
  readonly input: string | undefined;
};

export function resolveDeepResearchProviderInput(
  input: string | undefined,
): ResolvedDeepResearchInput {
  if (input === undefined) {
    return { deepResearch: false, input };
  }

  const request = parseDeepResearchRequest(input);
  if (!request) {
    return { deepResearch: false, input };
  }

  const query = request.query.trim();
  return {
    deepResearch: true,
    input: `${DEEP_RESEARCH_BRIEF}\n\nResearch request:\n${query || "Research the attached material and report what you find."}`,
  };
}
