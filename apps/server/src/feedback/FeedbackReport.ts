import { AgentFeedbackKind, AgentFeedbackTrace } from "@kairo/contracts";
import { resolveT3McpToolId } from "@kairo/shared/kairoMcpToolPresentation";
import * as Effect from "effect/Effect";
import * as Schema from "effect/Schema";
import * as Struct from "effect/Struct";

// Code points, as the scrubber caps them, so a valid input stays a valid report after redaction.
const FeedbackText = Schema.String.check(Schema.isMaxCodePoints(300));

/** Turns the outline of a requested report covers at least. */
export const FEEDBACK_TRACE_TURNS = 5;

const reportFields = {
  kind: AgentFeedbackKind,
  subject: Schema.String.annotate({ description: "T3 tool name, `t3` command, or `general`." }),
  expected: FeedbackText,
  actual: FeedbackText,
  workaround: FeedbackText.annotate({ description: "What you did instead, or empty." }),
  // Annotate before the default: an annotation after it never reaches the JSON schema.
  userRequested: Schema.Boolean.annotate({ description: "The user asked for this report." }).pipe(
    Schema.withDecodingDefaultKey(Effect.succeed(false)),
  ),
};

export const FeedbackInput = Schema.Struct({
  ...reportFields,
  turns: Schema.Int.check(Schema.isGreaterThanOrEqualTo(1))
    .annotate({
      description: "How many recent turns, counting this one, the problem spans.",
    })
    .pipe(Schema.withDecodingDefaultKey(Effect.succeed(1))),
});

export const FeedbackTrace = AgentFeedbackTrace;
export type FeedbackTrace = AgentFeedbackTrace;

const storedFields = {
  id: Schema.String,
  threadId: Schema.NullOr(Schema.String),
  createdAt: Schema.String,
  source: Schema.Literals(["mcp", "cli"]),
  sent: Schema.Boolean,
};

export const FeedbackReport = Schema.Struct({
  ...reportFields,
  ...storedFields,
  trace: Schema.NullOr(FeedbackTrace),
});

/** What `kairo_feedback` answers: the report, with only the size of what its trace attached. */
export const FeedbackSubmitResult = Schema.Struct({
  ...reportFields,
  ...storedFields,
  trace: Schema.NullOr(FeedbackTrace.mapFields(Struct.omit(["entries"]))),
});

export const FEEDBACK_AWAITING_APPROVAL_NOTE =
  "The user sees this report in a card and chooses there whether to send it and whether to include the conversation. Nothing is sent until they do, and you will not learn their choice. Do not wait for it or send it another way. Call again only if the user asks to change it; that shows a new card.";

/** What `kairo_feedback` answers for a requested report: shown to the user, not yet sent. */
export const FeedbackAwaitingApproval = Schema.Struct({
  status: Schema.Literal("awaiting_approval"),
  note: Schema.String,
});
export type FeedbackAwaitingApproval = typeof FeedbackAwaitingApproval.Type;

export const FEEDBACK_OFF_MESSAGE =
  "Agent feedback is off. Turn it on in Kairo under Settings > Labs, then try again.";

export class FeedbackOffError extends Schema.TaggedError<FeedbackOffError>()(
  "FeedbackOffError",
  {},
) {
  override get message() {
    return FEEDBACK_OFF_MESSAGE;
  }
}

export type FeedbackSource = "mcp" | "cli";

// Requested reports count when their card is shown, unprompted ones when stored.
export const MAX_REPORTS_PER_TURN = 3;
// Reports from no turn, such as `t3 feedback`, have no turn to count in.
export const MAX_REPORTS_OUTSIDE_TURNS_PER_HOUR = 10;

export class FeedbackLimitError extends Schema.TaggedError<FeedbackLimitError>()(
  "FeedbackLimitError",
  { scope: Schema.Literals(["turn", "hour", "cards"]) },
) {
  override get message() {
    switch (this.scope) {
      case "turn":
        return `This turn already sent ${MAX_REPORTS_PER_TURN} agent feedback reports; nothing was sent.`;
      case "cards":
        return `This turn already showed the user ${MAX_REPORTS_PER_TURN} agent feedback reports to approve; nothing was shown.`;
      case "hour":
        return `This machine already sent ${MAX_REPORTS_OUTSIDE_TURNS_PER_HOUR} agent feedback reports outside a turn in the last hour; nothing was sent.`;
    }
  }
}

export class FeedbackNotRequestedError extends Schema.TaggedError<FeedbackNotRequestedError>()(
  "FeedbackNotRequestedError",
  { source: Schema.Literals(["mcp", "cli"]) },
) {
  override get message() {
    return this.source === "cli"
      ? "Agent feedback is set to When I ask: ask your agent in a thread to send it, so you can approve what is sent."
      : "Agent feedback is set to When I ask: send a report only when the user asks for one.";
  }
}

export class FeedbackStorageError extends Schema.TaggedError<FeedbackStorageError>()(
  "FeedbackStorageError",
  { cause: Schema.Defect() },
) {
  override get message() {
    return "Could not save agent feedback.";
  }
}

/** The MCP client label `t3 feedback` signs in with, so its reports count as `cli`. */
export const FEEDBACK_CLI_CLIENT_LABEL = "t3 feedback cli";

/** Listed `t3` command paths a report may name. A CLI test keeps this in step with binCli. */
export const KAIRO_CLI_COMMANDS: ReadonlyArray<string> = [
  "kairo",
  "t3 help",
  "kairo serve",
  "kairo app",
  "kairo pair",
  "t3 auth",
  "t3 auth connect-device",
  "t3 auth connect-device approve",
  "t3 auth connect-device list",
  "t3 auth connect-device revoke",
  "t3 auth pairing",
  "t3 auth pairing create",
  "t3 auth pairing list",
  "t3 auth pairing revoke",
  "t3 auth session",
  "t3 auth session issue",
  "t3 auth session list",
  "t3 auth session revoke",
  "t3 environment",
  "t3 environment link",
  "t3 environment list",
  "t3 environment unlink",
  "kairo browser",
  "kairo browser setup",
  "kairo project",
  "kairo project add",
  "kairo project remove",
  "kairo project rename",
  "t3 thread",
  "t3 thread list",
  "t3 thread start",
  "t3 thread send",
  "t3 thread show",
  "t3 feedback",
  "t3 feedback list",
  "t3 workflow",
  "t3 workflow start",
  "t3 workflow list",
  "t3 workflow show",
  "t3 workflow resume",
  "t3 workflow cancel",
  "t3 workflow signal",
  "t3 workflow withdraw",
  "t3 workflow questions",
  "t3 workflow hooks",
  "t3 workflow store",
  "t3 workflow store list",
  "t3 workflow store set",
  "t3 workflow store delete",
  "kairo up",
  "t3 status",
  "kairo service",
  "kairo service install",
  "kairo service restart",
  "kairo service uninstall",
  "kairo service status",
  "kairo service protect",
  "kairo update",
  "kairo install",
  "kairo uninstall",
  "kairo theme",
  "kairo theme set",
  "kairo theme clear",
  "kairo theme show",
  "kairo trace",
  "kairo trace summary",
  "t3 doctor",
  "t3 policy",
  "t3 policy show",
  "t3 policy check",
  "t3 policy templates",
  "t3 policy settings",
  "kairo triage",
  "kairo connect",
  "kairo connect link",
  "kairo connect login",
  "kairo connect logout",
  "kairo connect publish",
  "kairo connect status",
  "kairo connect unlink",
];

export type FeedbackInput = typeof FeedbackInput.Type;
export type FeedbackReport = typeof FeedbackReport.Type;

export const FEEDBACK_SUBJECT_MESSAGE =
  "Set subject to the exact T3 tool name, the t3 command, or `general`.";

// The shared resolver knows the presented tools; the prefix covers the rest, such as these.
// Codex also registers `kairo-code-direct` for T3 tools it keeps out of Code Mode.
const KAIRO_PREFIX = /^(?:mcp__t3[-_]?code(?:[-_]direct)?__|t3[-_]?code(?:[-_]direct)?[.:/])/iu;

/** The bare name of a registered T3 tool however a provider prefixed it, else undefined. */
export const resolveT3ToolName = (name: string, toolNames: ReadonlyArray<string>) => {
  const tool = resolveT3McpToolId(name) ?? name.replace(KAIRO_PREFIX, "");
  if (toolNames.includes(tool)) return tool;
  // OpenCode 2 prefixes tools with `kairo-code-<thread>_`, underscores and all: the longest name wins.
  if (!/^kairo-code-/iu.test(name)) return undefined;
  return toolNames
    .filter((candidate) => name.endsWith(`_${candidate}`))
    .toSorted((a, b) => b.length - a.length)[0];
};

/** The stored subject, or undefined when the value names no T3 tool, `t3` command, or `general`. */
export const resolveFeedbackSubject = (value: string, toolNames: ReadonlyArray<string>) => {
  const subject = value.trim();
  if (subject === "general" || KAIRO_CLI_COMMANDS.includes(subject)) return subject;
  return resolveT3ToolName(subject, toolNames);
};
