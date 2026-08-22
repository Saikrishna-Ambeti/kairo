# Kairo Patch

## Goal

Turn T3 Code into Kairo: a calmer, local-first assistant for everyday work. Kairo keeps useful context, supports persistent memory and connected-platform data, and guides new users through provider setup.

## What

Behavioral specification of the Kairo changes applied on top of upstream T3 Code. Implementation specifics are intentionally omitted: they track the upstream revision and may change. This section describes what Kairo is and does, not how it is built.

## Upstream baseline

- Synced with upstream T3 Code through `11f05137` in merge `4c1c20a2`.
- The Kairo behavior described below remains the source of truth when resolving upstream changes.
- Equivalent upstream behavior is reused instead of maintained twice. The desktop launcher now uses upstream launcher version 15, which already preserves framework symlinks.
- Generated web routing includes the connected-app settings page at `/settings/integrations/apps`.

### 1. Product identity

- Product renamed from **T3 Code** to **Kairo**; hosted service from **T3 Connect** to **Kairo Connect**.
- Every public identifier is renamed consistently: package names and import scopes, environment-variable prefix, persisted local configuration directory, desktop application identity, URI scheme, hosted app domains, release artifact names, native mobile module names, icons and assets.
- Kairo is built on the MIT-licensed upstream T3 Code; upstream attribution is preserved in the license and documentation.
- Desktop: product name Kairo with a distinct nightly identity, Kairo-branded artifacts and metadata, Kairo protocol scheme.
- Web and marketing: Kairo branding everywhere; product described as a practical everyday AI assistant with persistent memory and connected-platform data, while coding-agent functionality remains available.
- Stage labels: development builds labeled Beta, packaged stable channel labeled Alpha — intentional, not a branding replacement.
- Setup documentation uses only the project-supported commands; stale tooling claims removed.
- Kairo-owned repository links point to the correct Kairo repository.

### 2. Persistent memory (Supermemory)

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

### 3. Connected-app integrations (Composio)

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

### 4. First-run onboarding

- Persistent onboarding-completed setting, default false.
- Authenticated users see an onboarding gate before the normal app shell until completion; no bypass via rendering race or backdoor.
- Four steps: provider setup, optional memory, optional connected apps, finish.
- Providers: continuing requires at least one usable provider (installed, enabled, available, ready); an install action is offered when supported, otherwise a login action for installed but unauthenticated providers.
- The memory and connected-apps steps reuse the respective settings flows and may be skipped.
- Navigation is backward-only; completed step state is retained; busy states prevent competing actions; provider status refreshes after install or login; labels and statuses are accessible.
- Provider browser login: authentication URLs are opened in the system browser through the desktop shell, and provider detection is refreshed afterward.

### 5. Desktop packaging on older macOS

- Legacy macOS builds use a fallback packaging path that still produces valid DMGs with correct volume name, format, and size handling; temporary artifacts are always cleaned up.
- The fallback applies only to old macOS builds unless explicitly overridden.

### 6. Dependencies, CI, browser tests

- Workspace dependency metadata is reconciled to current versions compatible with Kairo naming; the lockfile is regenerated rather than transplanted.
- CI keeps check and test jobs; package filters and environment variables use Kairo names; browser-test jobs have adequate timeout.
- Test and browser-test timeouts accommodate full chat and settings flows that can exceed default CI limits.
- Browser tests use stable, accessible interactions — awaiting visible state after opening dialogs and menus — preserving coverage for chat, settings, connections, and keybinding-toast paths.

### 7. What to verify

- Fresh profile: onboarding appears; cannot proceed from the provider step without a ready provider; back navigation preserves choices.
- Memory: the key never appears in settings payloads or logs; only selected providers receive credentials; provider configuration stays synchronized; disabling removes only matching credentials.
- Connected apps: missing-CLI, install, sign-in, auth URL, toolkit linking, fallback catalog, provider environment, and disable paths all report predictable states.
- Desktop: builds carry Kairo identity throughout; the old-macOS fallback is used only under defined conditions.
- No stale upstream names remain in Kairo-owned code, configuration, or docs.

## Patch history

- `cc08d200` — Add Supermemory integration for provider memory.
- `13445f03` — Rename and rebrand project to Kairo.
- `9c92d9e1` — Rename devcontainer to Kairo.
- `732af608` — Add Composio integration settings.
- `a0f4fd25` — Update sidebar brand.
- `8d97ea59` — Merge project-details work.
- `1cfaf927` — Update splash logo.
- `f532fae7` — Show beta stage label.
- `1afbc260` — Update workspace dependencies.
- `057bf73b` — Use Kairo contract imports for Composio.
- `4a72437f` — Describe Kairo as an everyday assistant.
- `7606cddc` — Share Electron binary resolution.
- `9ee02ccd` — Add first-run setup gate.
- `1cb324ec` — Update README.
- `60e70fce` — Add older-macOS DMG build shim.
- `ea4b77fa` — Update production assets and build script.
- `fcba73e0` — Update Supermemory URL.
- `1e420d0a` — Update Supermemory URL and setup steps.
- `052bfe9c` — Allow returning to earlier onboarding steps.
- `cdedd109` — Require usable providers before onboarding continues.
- `4b0518f8` — Add provider login flow to onboarding.
- `487940d1` — Remove stale product name.
- `8c346e5a` — Open provider authentication URLs during onboarding.
- `58cfef0d` — Restore test workflow.
- `6af4664c` — Stabilize browser tests.
- `d6f583ee` — Remove stale Kairo names.
- `4c1c20a2` — Merge upstream main while preserving the Kairo patch.
- `7dd78089` — Refresh the generated connected-app integrations route.
