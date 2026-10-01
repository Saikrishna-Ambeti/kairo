# Kairo Patch

## Goal

Turn T3 Code into Kairo: a calmer, local-first assistant for everyday work. Kairo keeps useful context, supports persistent memory and connected-platform data, and guides new users through provider setup.

## What

Behavioral specification of the Kairo changes applied on top of upstream T3 Code. Implementation specifics are intentionally omitted: they track the upstream revision and may change. This section describes what Kairo is and does, not how it is built.

## Update policy

- Canonical specification: `docs/project/PATCH.md`. Maintain this file in place; do not create a competing root specification.
- Upstream URL: https://github.com/pingdotgg/t3code.git
- Upstream remote: `upstream`. `origin` is the Kairo fork.
- Target: latest upstream default branch, resolved live to an exact commit each update. Cached default branch at setup: `main`.
- Integration: merge into a new local review branch in a separate worktree using `--no-ff --no-commit`. Leave uncommitted by default; the user authorized a local review commit for this attempt so Greptile can review committed changes.
- Preserve the behavior below and other local work. Reuse equivalent upstream implementations when the same acceptance checks pass.
- Preserve existing Git state. Record a verified candidate separately from the landed baseline; failed or pending checks never advance the verified baseline.

## Upstream baseline

- Observed integrated upstream commit: `d29c56a5c404cb0f58d3b2ac41762fa0d0ac28d4`. It is the second parent of merge `0235375fae757e104ea4f02b6873204cafe229f9`, which is an ancestor of starting HEAD. The September review was committed and subsequently merged into the fork.
- Observed local HEAD at setup: `b2f0ac9752eacb18fd2b1c4a751b0e561263aaf2` on `t3code/upstream-sync-patch`.
- Last behaviorally verified baseline: unknown. Existing baseline records integration history, not a new test result.
- The Kairo behavior described below remains the source of truth when resolving upstream changes.
- Equivalent upstream behavior is reused instead of maintained twice. The desktop launcher now uses upstream launcher version 19 in the review candidate, which already preserves framework symlinks.
- Generated web routing includes the connected-app settings page at `/settings/integrations/apps`.

### P001: Product identity

- Status: active requirement from the existing specification; runtime acceptance not verified in this review.
- Purpose: Keep Kairo identity consistent across installation, configuration, and clients.
- Implementation hints: `package.json`, `apps/desktop/package.json`, `apps/desktop/scripts/electron-launcher.mjs`, branding assets, and `LICENSE`.
- Verification: focused P001 checks below and applicable manual acceptance checks.
- Retirement: Upstream supplies the required Kairo identifiers and preserves attribution. Otherwise retain unless the user changes the requirement.

- Product renamed from **T3 Code** to **Kairo**; hosted service from **T3 Connect** to **Kairo Connect**.
- Every public identifier is renamed consistently: package names and import scopes, environment-variable prefix, persisted local configuration directory, desktop application identity, URI scheme, hosted app domains, release artifact names, native mobile module names, icons and assets.
- Kairo is built on the MIT-licensed upstream T3 Code; upstream attribution is preserved in the license and documentation.
- Desktop: product name Kairo with a distinct nightly identity, Kairo-branded artifacts and metadata, Kairo protocol scheme.
- Web and marketing: Kairo branding everywhere; product described as a practical everyday AI assistant with persistent memory and connected-platform data, while coding-agent functionality remains available.
- Stage labels: development builds labeled Beta, packaged stable channel labeled Alpha. intentional, not a branding replacement.
- Setup documentation uses only the project-supported commands; stale tooling claims removed.
- Kairo-owned repository links point to the correct Kairo repository.

### P002: Persistent memory (Supermemory)

- Status: active requirement from the existing specification; runtime acceptance not verified in this review.
- Purpose: Let users retain context across supported provider sessions without exposing their memory key.
- Implementation hints: `apps/server/src/memory/`, corresponding settings UI, and provider configuration bindings.
- Verification: focused P002 checks below and applicable manual acceptance checks.
- Retirement: Upstream supplies equivalent optional memory integration and passes P002 checks. Otherwise retain unless the user changes the requirement.

- Optional, user-scoped, hosted persistent-memory integration. Disabled by default.
- The API key is a secret: stored separately from ordinary settings and never appears in settings payloads or logs.
- Memory attaches to selected provider instances; only supported providers are affected. Unsupported providers remain visible and are reported as unsupported.
- Codex: memory integration is installed and validated in the Codex home configuration (installation scripts present, hooks configured); merging preserves the user's existing configuration; disabling removes only Kairo's own stored credentials, never user configuration.
- OpenCode: memory integration is installable via its own installer.
- Claude Agent: users receive install guidance; the flow is not automated.
- Service operations: status, configure, test connection, install providers, disable.
- Connection testing distinguishes a missing key, authentication failures, and server-side failures.
- Installs are time-bounded; provider state is kept synchronized after every operation.
- RPC: read operations and mutating operations; mutating operations require elevated permission; all operations are audited.
- UI: memory settings section reachable from settings navigation; displays key presence only (never the key); supports entering, testing, and replacing the key, selecting provider instances, installing provider integration, and disabling; surfaces provider status and guidance.

### P003: Connected-app integrations (Composio)

- Status: active requirement from the existing specification; runtime acceptance not verified in this review.
- Purpose: Let selected providers use connected services from the environment hosting the agent.
- Implementation hints: `apps/server/src/composio/` and `/settings/integrations/apps`.
- Verification: focused P003 checks below and applicable manual acceptance checks.
- Retirement: Upstream supplies equivalent server-side setup, provider selection, and toolkit flows and passes P003 checks. Otherwise retain unless the user changes the requirement.

- Optional integration for connected platform toolkits. Disabled by default.
- CLI operations run on the server machine, not in the browser; progress streams to the client.
- CLI discovery, installation, and sign-in happen on the server; sign-in may surface an authentication URL to the user.
- The full toolkit catalog is loaded when authenticated; a curated fallback catalog is used otherwise, with a message stating why results are limited.
- Linking a toolkit persists it as a preferred toolkit, deduplicated. Disabling clears the enabled state and provider selection.
- A single in-flight operation is tracked with stage and status updates and output snippets; failures are reported predictably.
- Selected provider instances gain the CLI on their environment; user-defined environment values are preserved.
- Per-provider agent-support status distinguishes ready, needs-install guidance, and unverified.
- RPC: status, toolkit listing, agent-support installation, disable, and streamed install/login/link operations.
- UI: integrations settings section with a primary action chosen from CLI and auth state, setup progress and recoverable failures, provider selection and agent-support state, toolkit search with connected apps shown separately, toolkit link flow, and safe fallback-catalog use.

### P004: First-run onboarding

- Status: active requirement from the existing specification; runtime acceptance not verified in this review.
- Purpose: Guide new users to a usable provider before entering the app.
- Implementation hints: `apps/web/src/components/onboarding/` and `apps/web/src/routes/__root.tsx`.
- Verification: focused P004 checks below and applicable manual acceptance checks.
- Retirement: Upstream supplies equivalent onboarding, including the required completion behavior, and passes P004 checks. Otherwise retain unless the user changes the requirement.

- Persistent onboarding-completed setting, default false.
- Authenticated users see an onboarding gate before the normal app shell until completion; no bypass via rendering race or backdoor.
- Keep Kairo sign-in and profession selection, followed by provider setup, optional memory, optional connected apps, and completion. The user confirmed first-run-only completion on 2026-09-10.
- Persist completion before opening the normal app shell. Honor either the existing completion boolean or upstream completion timestamp on subsequent launches. A save failure keeps setup open. The authenticated welcome route uses the same Kairo flow; hosted-static connection setup remains upstream-owned.
- Providers: continuing requires at least one usable provider (installed, enabled, available, ready); an install action is offered when supported, otherwise a login action for installed but unauthenticated providers.
- The memory and connected-apps steps reuse the respective settings flows and may be skipped.
- Navigation is backward-only; completed step state is retained; busy states prevent competing actions; provider status refreshes after install or login; labels and statuses are accessible.
- Provider browser login: authentication URLs are opened in the system browser through the desktop shell, and provider detection is refreshed afterward.

### P005: Desktop packaging on older macOS

- Status: active requirement from the existing specification; runtime acceptance not verified in this review.
- Purpose: Keep DMG creation usable on older macOS hosts.
- Implementation hints: `scripts/build-desktop-artifact.ts` and `scripts/dmgbuild-hdiutil-shim.mjs`.
- Verification: focused P005 checks below and applicable manual acceptance checks.
- Retirement: Upstream packaging passes the same acceptance checks on affected macOS hosts without the shim. Otherwise retain unless the user changes the requirement.

- Legacy macOS builds use a fallback packaging path that still produces valid DMGs with correct volume name, format, and size handling; temporary artifacts are always cleaned up.
- The fallback applies only to old macOS builds unless explicitly overridden.

### P006: Dependencies, CI, browser tests

- Status: active requirement from the existing specification; runtime acceptance not verified in this review.
- Purpose: Keep fork dependencies installable and preserve CI coverage for Kairo flows.
- Implementation hints: Workspace package manifests, `pnpm-lock.yaml`, `.github/workflows/`, and Vite test configuration.
- Verification: focused P006 checks below and applicable manual acceptance checks.
- Retirement: Upstream configuration works with Kairo package names and preserves the required coverage. Otherwise retain unless the user changes the requirement.

- Workspace dependency metadata is reconciled to current versions compatible with Kairo naming; the lockfile is regenerated rather than transplanted.
- CI keeps check and test jobs; package filters and environment variables use Kairo names; browser-test jobs have adequate timeout.
- Test and browser-test timeouts accommodate full chat and settings flows that can exceed default CI limits.
- Browser tests use stable, accessible interactions. awaiting visible state after opening dialogs and menus. preserving coverage for chat, settings, connections, and keybinding-toast paths.

### What to verify

- Fresh profile: onboarding appears; cannot proceed from the provider step without a ready provider; back navigation preserves choices.
- Memory: the key never appears in settings payloads or logs; only selected providers receive credentials; provider configuration stays synchronized; disabling removes only matching credentials.
- Connected apps: missing-CLI, install, sign-in, auth URL, toolkit linking, fallback catalog, provider environment, and disable paths all report predictable states.
- Desktop: builds carry Kairo identity throughout; the old-macOS fallback is used only under defined conditions.
- No stale upstream names remain in Kairo-owned code, configuration, or docs.

## Patch maintenance and validation

P001 through P006 are active requirements from this existing specification. File paths are implementation hints; preserve behavior when upstream refactors. Retire a requirement only when equivalent upstream behavior passes its checks or the user changes the requirement. Keep retired IDs and evidence.

Use focused tests from the repo root, selected according to changed behavior:

- P001: inspect affected identity, package, artifact, and attribution changes. Preserve legitimate upstream attribution when checking stale names.
- P002: `vp test run apps/server/src/memory/SupermemoryService.test.ts apps/server/src/memory/SupermemoryMcp.test.ts`.
- P003: `vp test run apps/server/src/composio/ComposioService.test.ts`.
- P004: `vp test run apps/web/src/components/onboarding/OnboardingGate.test.tsx`. Keep the first-run acceptance checks above; unit tests alone do not prove persistence across application launches.
- P005: `vp test run scripts/build-desktop-artifact.test.ts`, plus packaging on the affected macOS configuration when authorized.
- P006: inspect affected workflow jobs, dependency resolution, and relevant browser tests. Follow AGENTS.md limits on broad suites and browser use.

Use the workspace-local `./node_modules/.bin/vp` for verification. The globally installed runner used Vitest 4.1.10 against workspace dependencies requiring 5.0.1 and failed before executing tests. The local runner executes the focused suites successfully. Web unit tests run from `apps/web` with `../../node_modules/.bin/vp test run --project unit <files>`.

The review candidate declares Electron `44.4.2`. Effect moves to `4.0.0-rc.115`, TypeScript remains `7.0.2`, and Vite+ moves to `1.0.0`. Claude Agent SDK remains exactly pinned, now at `0.3.276` to match upstream adapter APIs. The workspace lockfile was regenerated with `vp install --lockfile-only`, followed by installation. Dependency declarations do not prove graphics or older-macOS runtime compatibility.

### P007: Existing data and local features

- Status: active; migration and focused service checks pass in the candidate.
- Purpose: Preserve Kairo data and committed behavior beyond the original six patch entries.
- Keep migration IDs 48, 49, and 50 assigned to Kairo reconciliation, artifact metadata, and scheduled tasks. Previously integrated upstream migrations use IDs 51 through 53. This update allocates incoming message context, title state, viewed pull-request files, and auto-settle migrations to IDs 54 through 57. Existing databases must retain scheduled tasks and artifacts while gaining upstream pull-request and thread-order fields.
- Preserve study mode, deep research, artifact panels, scheduled tasks, source-control visibility preferences, notification sound, desktop Clerk headers, cloud identity, and Kairo marketing designs.
- Implementation hints: `apps/server/src/persistence/Migrations.ts`, provider services, chat and settings components, desktop Clerk integration, and marketing pages.
- Verification: migration reconciliation test, scheduled-task and provider-service tests, affected client typechecks, and manual feature acceptance when authorized.
- Retirement: Upstream supplies equivalent behavior and data migration with matching acceptance evidence, or the user changes the requirement.

### Known verification gaps

- P002 and P003 describe historical installer and CLI flows. Before this update, committed Kairo code had already moved to cloud credential exchange for Supermemory and cloud MCP for Composio. This merge preserves that implementation and tests its current service behavior. It does not claim that historical installer, toolkit catalog, or per-provider setup requirements pass. Those historical descriptions remain until separately reconciled with product requirements.
- P004 completion uses persisted settings, and optional memory and connected-app steps reuse current settings panels. This update retains the previously committed first-run behavior. Fresh-profile, restart, failure-retry, and back-navigation acceptance still needs a real client pass.
- Web and desktop share the updated onboarding flow. Mobile remains a separate client; its typecheck passes, but no native flow was launched. Provider-service tests cover capability selection, not live acceptance on Codex, Claude, Cursor, Grok, OpenCode, or Antigravity accounts.
- Local, remote/relay, tunnel, and multi-environment acceptance remain unverified. Server-side operations must target the selected environment.
- Browser checks and application launches require explicit user authorization under `AGENTS.md`. No browser or app was launched. DMG creation on older macOS, target-hardware graphics, and CI execution remain pending.

## Latest attempt

- Date: 2026-10-01.
- State: merge candidate prepared; focused validation passed. The user authorized a local review merge commit to enable Greptile. CodeRabbit rejected the full diff as too large; provider, chat, and relay review requests are still scanning changes. Greptile committed review and manual acceptance remain pending.
- Starting HEAD and rollback reference: `b2f0ac9752eacb18fd2b1c4a751b0e561263aaf2`.
- Previous integrated upstream: `d29c56a5c404cb0f58d3b2ac41762fa0d0ac28d4`, confirmed ancestor of the target.
- Exact target: `bd89c1302026255c62cc09278207bfaf2664da4a`, fetched from `upstream/main` after checking the remote's live default branch. It contains 738 commits after the integrated upstream baseline. This is the attempt's fixed target, not a claim about later upstream changes.
- Review branch: `review/upstream-20261001`.
- Review worktree: `/Users/saikrishnaambeti/Documents/projects/kairo-upstream-20261001`.
- Git state: conflicts are resolved and final validation fixes are staged for the authorized local review merge commit. The resulting commit has the starting revision and exact upstream target as parents; inspect review branch history for its identity. No push, PR, or deployment is authorized.
- Original checkout: `/Users/saikrishnaambeti/.t3/worktrees/kairo/t3code-a4bf8512` remains on its original branch and HEAD, with no pending changes at setup. No pending edits were excluded.
- Adaptations: preserve Kairo package, native-module, configuration, and release identities; retain upstream license attribution and vendored reference sources; use GitHub-hosted runners, including the new Windows release job; regenerate the route tree and lockfile; retain cloud Supermemory and Composio, identity without managed relay, Neon relay storage, onboarding completion, artifacts, scheduled tasks, and marketing designs. Provider context now carries Study instructions in both native collaboration settings and additional context. Memory, preview, device, and pull-request capabilities follow project settings and provider selection. Split mobile settings retain Kairo routes and account gates. Web and mobile custom Connect account pages require managed relay configuration; cloud identity alone remains usable. Plan and Study controls remain available without the upstream legacy opt-in.
- Focused tests passed: patch services, cloud gateway, migration reconciliation, scheduled-task service, and desktop packaging, 91 tests; provider service, maintenance, MCP registry, runtime instruction, and interaction-mode suites, 127 tests across five files; Codex runtime, tool presentation, reconciliation, and auto-settle migration, 126 tests; web onboarding, right-panel state, header, and settings search, 145 tests; web schedules and first-run logic, 49 tests; mobile preferences and message-context migration, 8 tests; final logger and task/artifact-preservation regression, 7 tests. The final Codex runtime pass also passed all 51 tests after converting the affected tests to Effect test helpers. Mobile public-configuration tests also passed all 8 tests after the account gates changed. Some tests overlap across batches. The initial tool-presentation failures were fixed by preserving Kairo and legacy upstream tool aliases.
- Typechecks: web, desktop, mobile, scripts, relay, and cloud API passed. Server package check found one remaining logger fixture missing the fork's product-surface configuration; the fixture is fixed and a focused typecheck of the logger, migration-preservation, and Codex runtime tests passed. This focused rerun does not claim a second complete server-package pass. Earlier server API and test-double failures were corrected.
- Lint: initial focused pass found newly enforced component-style rules and a synchronous Effect test. The final focused lint pass has no errors. The scoped pass reported 59 React compiler and hook warnings in the affected large client components. The additional mobile account-page lint passed with two ref warnings; web account-page lint passed. Whitespace checks passed for apps, packages, scripts, docs, relay, and workflows.
- Reviews use the user's `personal` profile. Both accounts authenticated. CodeRabbit rejected the full uncommitted diff against starting HEAD with `payload_too_large`. Provider, chat, and relay scope requests are in progress; observed CLI preprocessing still scans paths outside these directories, so their effective scope must be checked from the results. Greptile initially returned `there are no committed code changes to review` because its CLI excludes staged and unstaged changes. The user then explicitly approved a local review commit, overriding the uncommitted default for this attempt.
- Checks not run: repo-wide suites, browser automation, native launch, old-macOS DMG build, CI, live provider accounts, or remote/tunnel acceptance. No live Kairo data was modified.
- Evidence: `/tmp/kairo-upstream-20261001-evidence/`, including original change inventory, conflict decisions, generated-file work, validation logs, and review outputs.
- Landed baseline remains `d29c56a5c404cb0f58d3b2ac41762fa0d0ac28d4`. Last fully behaviorally verified baseline remains unknown.

### Prior attempt

The September 2026 review integrated `d29c56a5c404cb0f58d3b2ac41762fa0d0ac28d4` from baseline `caab2fdbac041ac2e851ad4fa3ac4a40a1d4a8f6`, starting at `ff1c4ef08ba85174b44482cf394fc83902df7b5c`. Its focused tests and client typechecks passed, with manual acceptance pending. The user later authorized publication; merge `0235375fae757e104ea4f02b6873204cafe229f9` records the integration. Review worktree and evidence remain under `/Users/saikrishnaambeti/Documents/projects/kairo-upstream-20260910` and `/var/folders/26/8qwghqmn5sq9fsv3qw8_wlhm0000gn/T/kairo-upstream-review-p9cgw4uu`.

## Patch history

- `cc08d200`. Add Supermemory integration for provider memory.
- `13445f03`. Rename and rebrand project to Kairo.
- `9c92d9e1`. Rename devcontainer to Kairo.
- `732af608`. Add Composio integration settings.
- `a0f4fd25`. Update sidebar brand.
- `8d97ea59`. Merge project-details work.
- `1cfaf927`. Update splash logo.
- `f532fae7`. Show beta stage label.
- `1afbc260`. Update workspace dependencies.
- `057bf73b`. Use Kairo contract imports for Composio.
- `4a72437f`. Describe Kairo as an everyday assistant.
- `7606cddc`. Share Electron binary resolution.
- `9ee02ccd`. Add first-run setup gate.
- `1cb324ec`. Update README.
- `60e70fce`. Add older-macOS DMG build shim.
- `ea4b77fa`. Update production assets and build script.
- `fcba73e0`. Update Supermemory URL.
- `1e420d0a`. Update Supermemory URL and setup steps.
- `052bfe9c`. Allow returning to earlier onboarding steps.
- `cdedd109`. Require usable providers before onboarding continues.
- `4b0518f8`. Add provider login flow to onboarding.
- `487940d1`. Remove stale product name.
- `8c346e5a`. Open provider authentication URLs during onboarding.
- `58cfef0d`. Restore test workflow.
- `6af4664c`. Stabilize browser tests.
- `d6f583ee`. Remove stale Kairo names.
- `4c1c20a2`. Merge upstream main while preserving the Kairo patch.
- `7dd78089`. Refresh the generated connected-app integrations route.
- `30f57d111`. Merge upstream main while preserving the Kairo patch.
