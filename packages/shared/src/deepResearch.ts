const DEEP_RESEARCH_COMMAND = /^\/research(?=\s|$)/i;

export type DeepResearchRequest = {
  readonly query: string;
  readonly commandLength: number;
};

export function parseDeepResearchRequest(input: string): DeepResearchRequest | null {
  const match = DEEP_RESEARCH_COMMAND.exec(input);
  if (!match) return null;

  return {
    query: input.slice(match[0].length).trimStart(),
    commandLength: match[0].length,
  };
}

export function activateDeepResearchPrompt(input: string): string {
  if (parseDeepResearchRequest(input)) return input;
  return input.length === 0 ? "/research " : `/research ${input}`;
}
