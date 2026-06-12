# Non-technical AI app cleanup plan

## Goal

Evolve this codebase from a coding-agent workbench into a calmer AI app for non-technical people. The product should feel like a guided assistant first, not an IDE. Developer-only affordances should disappear from the default experience unless they are required for reliability behind the scenes.

## Clarified product direction

- **Audience:** small business owners and employees.
- **Job to be done:** help users move quickly through everyday work tasks with AI assistance.
- **Workspace model:** users can work with local documents and folders, but the interface should frame them as documents/resources rather than code repositories or developer projects.
- **First-class document types:** PDFs, Word documents, spreadsheets, images for understanding, and small dashboards represented as local HTML files.
- **Provider strategy:** keep provider choice visible to users, keep all current AI providers available, and leave room to add more providers.
- **Autonomy model:** each user defines their own approved boundaries. The default should request only the minimal permissions required for the task.
- **Document memory/indexing:** local folders should be indexed automatically. Later-stage implementation should address Supermemory integration.
- **Account integrations:** later-stage connected-account workflows should address Composio integration.
- **Developer surfaces:** source control, diffs, checkpoint rollback, and terminal capabilities are permanently hidden/disabled for this product phase. They may return only after the product direction is solidified.

## Cleanup scope

This plan focuses on the first cleanup phase:

1. Hide source-control features without deleting their implementation.
2. Hide the diff viewer without deleting diff/checkpoint infrastructure.
3. Remove terminal features from the user-facing app and disable backend terminal APIs.
4. Hide settings related to source control and diffs.

## Guiding decisions

- **Hide before delete for source control and diffs.** Keep the source-control providers, Git contracts, checkpointing, and diff services available internally until a later cleanup confirms they can be safely deleted. They should not be user-accessible in this product phase.
- **Disable terminal end-to-end.** Non-technical users should not see or operate shells, terminal panes, terminal context pills, terminal shortcuts, or terminal settings. Backend terminal APIs should also be unavailable.
- **No diff-dependent rollback in this phase.** Do not surface checkpoint rollback or “undo AI changes” flows while the diff viewer is hidden.
- **Preserve agent reliability only where needed.** Keep provider/runtime behaviors that are required for the assistant to complete approved business tasks, but remove coding-workbench affordances from the product surface.
- **Gate whole surfaces, not scattered buttons.** Introduce a single product-surface configuration and route all source-control, diff, and terminal visibility through it. Avoid one-off `display: none` patches.

## Later-stage integrations to preserve room for

These are not part of the immediate cleanup implementation, but the cleanup should avoid architectural choices that make them harder later:

- **Supermemory:** automatic indexing and retrieval over user-selected local folders/documents.
- **Composio:** user-authorized account connections and actions for apps such as email, calendars, cloud drives, CRM, and other business tools.
- **Per-user permissions:** user-controlled boundaries that let the assistant act automatically inside approved scopes and ask outside them.

## Product UX principles for non-technical users

The cleanup must remove coding surfaces and replace them with a document-first business assistant experience.

- Start from user documents, business tasks, and outcomes — not projects, repositories, branches, or sessions.
- Default screen should answer: “What do you want help with?” and “Which documents should I use?”
- Use business language:
  - “Documents” or “business folder” instead of “repository”.
  - “Workspace” instead of “environment” when shown to users.
  - “Activity” or “details” instead of “terminal output”.
  - “Permissions” or “connections” instead of “auth scopes”.
  - Avoid “branch”, “worktree”, “commit”, “pull request”, “diff”, “checkpoint”, and “shell” in default UI.
- Show only actions users can understand and safely approve.
- Prefer guided task prompts and review steps over power-user controls.

## Document-first workspace model

Default experience should center on selected documents and local folders.

Primary entry points:

- Select or add documents.
- Choose a local business folder.
- Ask AI to summarize, rewrite, compare, extract, draft, analyze, or create.
- See recent work and saved outputs.

First-class resources:

- PDFs.
- Word documents.
- Spreadsheets.
- Images for understanding.
- Local HTML dashboards.

Avoid in user-facing surfaces:

- Developer file trees unless restyled as document/resource lists.
- Repository, branch, worktree, PR, commit, or Git setup language.
- Raw paths unless the user is choosing a folder or troubleshooting.

## Provider choice UX

Provider choice remains visible, but it must be explained in user terms.

Recommended behavior:

- Settings label: “AI provider”.
- Chat header/composer: compact current-provider indicator.
- Provider picker copy: “Choose which AI service powers your assistant.”
- Explain tradeoffs in plain language: speed, quality, privacy terms, and cost.
- Keep all current providers available.
- Keep advanced model/provider details behind an “Advanced” affordance.

Acceptance criteria:

- User can see the active provider.
- User can switch providers without reading developer docs.
- Provider errors use plain language and concrete recovery steps.

## User-controlled boundaries and permissions

Each user owns their assistant boundaries.

Default policy:

- No broad access by default.
- Ask only for permissions required for the current task.
- Prefer one-task approval over permanent approval.
- Make allowed scope visible before action.
- Act automatically only inside approved scopes; ask outside them.

Permission prompts should show:

- What the assistant wants to access.
- Why it needs access.
- Whether access is one-time or reusable.
- What will happen next.
- Clear cancel/deny path.

Examples:

- “Use this folder to answer your question?”
- “Read this spreadsheet to create a summary?”
- “Update this document with suggested edits?”

## Human-readable activity feed

When terminal, diff, and Git views are gone, replace them with friendly progress/status.

Use copy like:

- “Reading selected documents…”
- “Finding relevant sections…”
- “Creating draft…”
- “Checking result…”
- “Saved updated copy…”

Avoid by default:

- command output
- shell logs
- stack traces
- diff hunks
- Git status
- raw tool names

If technical detail is needed, hide it behind “Show troubleshooting details”.

## Terminology cleanup checklist

Search user-facing UI, docs, empty states, toasts, command palette, and errors for developer terms.

Hide or replace:

- repo/repository → workspace, folder, documents
- branch/worktree → remove
- commit → saved version or change record only if needed
- diff → changes or preview only if non-technical and no diff viewer is exposed
- terminal/shell → activity or troubleshooting details
- provider auth scopes → permissions or connections
- checkpoint → previous version or recovery point only if this feature returns
- environment → workspace

## Proposed surface configuration

The active surface config should be resolved once and used by both server and web. The server should be the source of truth; the web should consume it from server config/welcome/config-updated state rather than hardcoding behavior only in React.

```ts
type ProductSurfaceProfile = "developer" | "nonTechnicalAi";

type ProductSurfaceConfig = {
  sourceControl: "enabled" | "hidden";
  sourceControlProviders: "enabled" | "hidden";
  diffViewer: "enabled" | "hidden";
  checkpointRollback: "enabled" | "hidden";
  terminal: "enabled" | "disabled";
  developerKeybindings: "enabled" | "hidden";
};
```

Recommended initial profile:

```ts
const NON_TECHNICAL_AI_SURFACES = {
  sourceControl: "hidden",
  sourceControlProviders: "hidden",
  diffViewer: "hidden",
  checkpointRollback: "hidden",
  terminal: "disabled",
  developerKeybindings: "hidden",
} as const;
```

Semantics:

- `hidden`: no product entry point, no direct route exposure, no command-palette item, no keybinding, and no user-triggered RPC access. Internal modules may remain for compatibility or future cleanup.
- `disabled`: no UI, no persisted activation, no auth scope, no RPC operation, and no subscription stream.

Implementation notes:

- Put web helpers in one client module, for example `apps/web/src/productSurfaces.ts`.
- Keep schema/types in contracts or another shared schema-only location if server config needs to advertise surfaces.
- Guard routes, search params, command-palette items, keybindings, lazy imports, RPC callers, and server handlers.
- Do not rely only on CSS or hidden buttons.

## Phase 1 — Source-control surface hidden, not deleted

### User-facing changes

Hide these from the non-technical profile:

- Chat header source-control actions.
- Branch/worktree toolbar under the composer.
- Pull request checkout dialog entry points.
- Repository clone/publish/create actions in the command palette.
- Source Control settings navigation item.
- `/settings/source-control` direct route.
- Source-control provider setup prompts and toasts intended for GitHub/GitLab/Bitbucket/Azure DevOps workflows.
- Source-control wording in user-facing empty states and docs.

### Keep intact

Do not delete in this phase:

- `apps/server/src/sourceControl/**`
- `apps/server/src/git/**`
- `packages/contracts/src/git.ts`
- `packages/contracts/src/sourceControl.ts`
- Git-backed checkpointing used by orchestration/recovery.

### User-triggered APIs to block or hide

Hidden source control means no user-triggered source-control/VCS operations in this product phase. Internal Git/checkpoint modules may remain, but public user actions should be blocked or unavailable.

Block or remove UI access to WebSocket/RPC methods such as:

- `sourceControl.lookupRepository`
- `sourceControl.cloneRepository`
- `sourceControl.publishRepository`
- `vcs.pull`
- `vcs.refreshStatus` if it only serves developer status UI
- `vcs.listRefs`
- `vcs.createWorktree`
- `vcs.removeWorktree`
- `vcs.createRef`
- `vcs.switchRef`
- `vcs.init`
- PR/stacked Git actions
- `review.getDiffPreview` when used only for developer diff/review surfaces

### Likely web files to touch

- `apps/web/src/components/chat/ChatHeader.tsx`
  - Gate `GitActionsControl`.
- `apps/web/src/components/ChatView.tsx`
  - Gate `BranchToolbar` and pull-request dialog entry points.
- `apps/web/src/components/CommandPalette.tsx`
  - Hide clone, publish, repository, PR, and source-control settings actions.
- `apps/web/src/components/settings/SettingsSidebarNav.tsx`
  - Remove Source Control from visible nav in the non-technical profile.
- `apps/web/src/routes/settings.source-control.tsx`
  - Redirect to `/settings/general` or render a not-found/unavailable state when hidden.
- `apps/web/src/components/settings/SourceControlSettings.tsx`
  - Keep component for developer profile; do not delete.

### Acceptance criteria

- No visible button, menu item, or settings nav item references Source Control, GitHub, GitLab, Bitbucket, Azure DevOps, PRs, branches, commits, or worktrees in the default non-technical profile.
- Direct navigation to `/settings/source-control` does not expose the panel.
- Source-control server code and contracts still compile.

## Phase 2 — Diff viewer hidden, diff infrastructure preserved

### User-facing changes

Hide these from the non-technical profile:

- Header diff toggle.
- Right-side diff panel/sheet.
- `?diff=1`, `diffTurnId`, and `diffFilePath` deep-link behavior.
- “View diff” buttons in assistant metadata and changed-files summaries.
- Inline changed-file trees and diff-stat labels if they create a developer-oriented experience.
- Diff-related settings.
- Diff keybinding command and defaults.

### Keep intact

Do not delete in this phase:

- Checkpoint capture and checkpoint summaries.
- Server diff query code if it is still needed for internal safety or future technical mode.
- Diff contracts and store fields until a later compatibility pass confirms they are unused by the non-technical app.

### Likely web files to touch

- `apps/web/src/routes/_chat.$environmentId.$threadId.tsx`
  - Gate lazy `DiffPanel` import, inline sidebar, sheet, and diff search params.
- `apps/web/src/components/chat/ChatHeader.tsx`
  - Gate the diff toggle.
- `apps/web/src/components/ChatView.tsx`
  - Gate `onOpenTurnDiff`, `diffOpen`, and props passed to timeline/header.
- `apps/web/src/components/chat/MessagesTimeline.tsx`
  - Hide changed-file/diff call-to-action rows in non-technical mode.
- `apps/web/src/components/chat/ChangedFilesTree.tsx`
  - Keep for developer profile; do not delete in this phase.
- `apps/web/src/components/settings/SettingsPanels.tsx`
  - Hide “Diff line wrapping” and “Hide whitespace changes”.
- `packages/shared/src/keybindings.ts`
  - Remove `diff.toggle` from non-technical defaults.
- `packages/contracts/src/keybindings.ts`
  - Decide whether `diff.toggle` remains a valid command for developer profile or is removed globally later.

### Acceptance criteria

- `?diff=1` does not open or lazy-load the diff viewer in the non-technical profile.
- No user-facing “View diff”, “Diff”, additions/deletions stats, or diff settings are visible.
- Checkpoint/recovery flows still work if retained.

### Direct route/search/API guards

Diff hiding must block direct access, not only hide buttons.

- `_chat.$environmentId.$threadId.tsx` should strip `diff`, `diffTurnId`, and `diffFilePath` search params when `diffViewer=hidden`.
- Do not set “has opened diff” state when diff viewer is hidden.
- Do not retain `diff` in route search middleware for the non-technical profile.
- Do not lazy-load `DiffPanel` or `DiffWorkerPoolProvider` when hidden.
- Direct `review.getDiffPreview` calls should return unavailable or be unreachable unless an internal non-user workflow still requires them.
- Markdown code blocks can still render normal `diff` syntax highlighting; that is not the product diff viewer.

## Phase 3 — Terminal features removed from the user-facing app

### User-facing changes

Remove these from the non-technical product:

- Terminal drawer and xterm UI.
- Terminal toolbar toggle.
- Terminal split/new/close controls.
- Terminal keybindings and `terminalFocus` / `terminalOpen` shortcuts.
- Terminal context selection and composer terminal context pills.
- Terminal running indicators in the sidebar.
- Terminal-specific copy/toast text and tests.
- Terminal auth/scope references from user-facing docs.

### Server/API requirement

Backend terminal APIs must be disabled for this product phase.

Disable these WebSocket/RPC methods and subscriptions:

- `terminal.open`
- `terminal.attach`
- `terminal.write`
- `terminal.resize`
- `terminal.clear`
- `terminal.restart`
- `terminal.close`
- `subscribeTerminalEvents`
- `subscribeTerminalMetadata`

Recommended behavior:

- Remove the client terminal surface and make terminal RPC calls unreachable from UI.
- Server handlers return one consistent typed error for direct calls, for example `{ code: "SURFACE_DISABLED", surface: "terminal" }`.
- Terminal subscriptions close predictably and do not hang.
- Remove `terminal:operate` from default requested auth scopes and user-facing auth docs.
- In a later breaking cleanup, delete unused terminal contracts, server services, and dependencies after provider compatibility is verified.

### Likely files to touch

Client:

- `apps/web/src/components/ChatView.tsx`
- `apps/web/src/components/chat/ChatHeader.tsx`
- `apps/web/src/components/ThreadTerminalDrawer.tsx`
- `apps/web/src/terminalUiStateStore.ts`
- `apps/web/src/terminalSessionState.ts`
- `apps/web/src/lib/terminalContext.ts`
- `apps/web/src/lib/terminalFocus.ts`
- `apps/web/src/components/chat/ComposerPendingTerminalContexts.tsx`
- `apps/web/src/components/chat/TerminalContextInlineChip.tsx`
- `apps/web/src/components/chat/userMessageTerminalContexts.ts`
- `apps/web/src/components/Sidebar.tsx`
- `apps/web/src/components/CommandPalette.tsx`
- `apps/web/src/components/settings/KeybindingsSettings.tsx`

Contracts/runtime/server follow-up:

- `packages/contracts/src/terminal.ts`
- `packages/contracts/src/rpc.ts`
- `packages/contracts/src/ipc.ts`
- `packages/contracts/src/auth.ts`
- `packages/client-runtime/src/wsRpcClient.ts`
- Terminal handlers in `apps/server/src/**`

### Acceptance criteria

- Non-technical profile has no terminal drawer, terminal controls, terminal context chips, terminal indicators, terminal keybindings, or terminal settings.
- The UI does not send terminal RPC calls.
- Any direct terminal RPC call is rejected or ignored predictably if runtime removal is selected.
- Agent tool/command output still displays in a non-terminal, human-readable activity form if needed.

## Phase 4 — Settings cleanup

Hide settings that expose developer/source-control/diff concepts:

- Source Control settings section and route.
- Diff line wrapping.
- Hide whitespace changes.
- Automatic Git fetch interval.
- New thread mode if “worktree” remains visible.
- Text generation model for generated commit messages/PR titles.
- Terminal keybindings.
- Diff keybinding.
- Any source-control provider status embedded in general/provider settings.

Keep user-centered settings:

- Theme.
- Time format.
- Assistant output streaming.
- Auto-open task panel, if plans remain a user-facing concept.
- Add project base directory only if local projects remain part of the product.
- Archive/delete confirmations.
- Provider/account settings, after copy is simplified.
- Connections, if remote access remains in scope.

Likely files:

- `apps/web/src/components/settings/SettingsPanels.tsx`
- `apps/web/src/components/settings/SettingsSidebarNav.tsx`
- `apps/web/src/components/settings/KeybindingsSettings.logic.ts`
- `apps/web/src/components/settings/KeybindingsSettings.tsx`
- `packages/shared/src/keybindings.ts`
- `docs/user/keybindings.md`

## Phase 5 — Persisted-state migration

Existing users may have developer UI state stored locally. The cleanup must ignore or migrate it safely.

Migrate or ignore:

- Open terminal drawer state.
- Terminal IDs, terminal groups, selected terminal, terminal context chips, and terminal focus assumptions.
- `?diff=1`, `diffTurnId`, and `diffFilePath` route params.
- Saved diff sidebar width.
- Persisted `terminal.*` and `diff.toggle` keybindings.
- Stored diff settings; keep values but hide and ignore while diff viewer is hidden.
- Stored source-control provider discovery/status UI state.

Acceptance criteria:

- Existing user with old localStorage loads the non-technical app without crashes.
- No terminal subscription is created from old state.
- Hidden keybinding commands do not appear and do not execute.
- Old diff URLs land on the normal chat/document view.

## Phase 6 — Documentation cleanup

Update docs so the repository reflects the product direction:

- Keep `docs/integrations/source-control-providers.md` as a developer/legacy reference, but mark it hidden from the non-technical product.
- Update `docs/user/keybindings.md` to remove terminal/diff defaults for the non-technical profile.
- Update `docs/cloud/environment-auth.md` if terminal scopes are disabled or removed.
- Add a user-facing product overview once the app name, audience, and primary workflows are decided.
- Keep architecture docs honest about retained internal Git/checkpoint infrastructure even when source-control UI is hidden.

## Phase 7 — Tests and validation

### Automated checks

Run before completing implementation work:

```bash
vp check
vp run typecheck
```

If native mobile code changes:

```bash
vp run lint:mobile
```

### Search-based regression checks

For the non-technical profile, run targeted searches and verify remaining matches are internal-only or developer-profile-only:

```bash
rg -n "Source Control|GitHub|GitLab|Bitbucket|Azure DevOps|pull request|commit|branch|worktree" apps/web/src docs
rg -n "Diff|View diff|diff.toggle|diffWordWrap|diffIgnoreWhitespace" apps/web/src docs
rg -n "Terminal|terminal.toggle|terminalFocus|terminalOpen|terminal context" apps/web/src docs packages/contracts/src
```

### UI acceptance tests

Add or update tests that assert:

- Settings nav does not show Source Control.
- General settings does not show diff/source-control rows.
- Chat header does not show source-control, terminal, or diff controls.
- Command palette does not show clone/publish/PR/source-control/terminal/diff commands.
- Direct source-control and diff deep links do not expose hidden UI.

Product-copy acceptance criteria:

- First-run user can understand the app purpose without knowing coding terms.
- User can start a document task quickly.
- User can see the active AI provider.
- User can understand what data the assistant can access.
- Default UI has no Git, diff, terminal, branch, PR, commit, worktree, shell, or repository language.
- Technical logs/details never appear unless the user opens troubleshooting details.

## Risks and dependencies

- **Checkpointing is Git-backed.** Hiding source-control UI must not accidentally break checkpoint capture, rollback, or turn completion receipts.
- **Diff summaries are part of the thread store.** Hiding the viewer is safer than removing diff state in the first pass.
- **Terminal code is broad.** Terminal state touches keybindings, sidebar focus, composer context, WebSocket APIs, server auth scopes, tests, and xterm dependencies.
- **Provider output may look terminal-like.** Some agent events may represent command execution. The non-technical app still needs a friendly way to show progress and results without exposing a shell.
- **Deep links and persisted state.** Existing users may have `?diff=1`, open terminal state, or keybinding config persisted locally. Cleanup should migrate or ignore those states safely.

## Remaining product questions

These can wait until after the cleanup docs are in place:

1. What is the initial approved-boundary UI: per-task prompts, a settings page, reusable permission rules, or a combination?
2. What is the minimal default permission set for a new user before they approve anything?
3. Should automatic folder indexing watch all selected folders continuously, or only index on demand / on schedule?
4. Which connected-account categories should come first when Composio work starts: email, calendar, cloud drive, Slack/Teams, CRM, accounting, browser automation, or forms?
5. For spreadsheets and HTML dashboards, should phase one be read/understand only, or should the AI be allowed to edit/regenerate them inside approved boundaries?
6. How should provider choice be presented so non-technical users can choose without needing model/provider expertise?
