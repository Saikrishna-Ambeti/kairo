# Kairo Patch Implementation Replay Guide

## Purpose

This document preserves Kairo changes made on top of upstream T3 Code before replacing this branch with a newer upstream revision. It is a replay guide, not a raw Git patch: apply these product decisions to the new upstream architecture, preserving equivalent behavior rather than forcing old file layouts.

## Post-capture corrections

These corrections were made after initial capture. They are maintenance fixes, not new product features, and must remain when replaying the patch set.

- Restore `T3 Tools Inc.` copyright beside `Kairo Tools Inc.` in `LICENSE`. Add `ATTRIBUTION.md` and README attribution identifying T3 Code as the MIT-licensed upstream foundation. Confirm external hackathon eligibility separately; source code cannot establish it.
- Replace incorrect `pingdotgg/kairo` release, package, and marketing links with `Saikrishna-Ambeti/kairo`. Do not change `pingdotgg/t3code` attribution link or test fixtures that model arbitrary repository URLs.
- Make public setup documentation use the project-supported Vite+ commands: `vp install`, `vp run <script>`, and `vp test`. Remove stale Bun/Turbo claims.
- Keep release stage labels unchanged: `Beta` is development build identity and `Alpha` is packaged stable-channel identity. This is intentional current channel behavior, not a branding replacement.

## Anchors

| Item                | Revision                                                                               |
| ------------------- | -------------------------------------------------------------------------------------- |
| Upstream fork point | `b6cbee1a3ccdb76fb4aa8abe892b8d6f567feeb7` (`Gate product surfaces by profile config`) |
| Captured Kairo head | `d6f583ee71f874a912d2448313745c20cb8d1638` (`chore: remove stale Kairo names`)         |
| Kairo-only commits  | 26                                                                                     |

`b6cbee1a` is parent of first Kairo-only commit, `cc08d200` (`Add Supermemory integration for provider memory`). No uncommitted changes existed when this document was generated.

## Replay order

1. Update local branch to desired upstream revision and make it build clean before adding Kairo work.
2. Perform branding/package migration. This changes public identifiers and filesystem locations; do it before adding features so imports and generated configuration use Kairo names.
3. Add Supermemory contracts, server service, provider bindings, RPC surface, settings route, and tests together.
4. Add Composio contracts, server service, provider bindings, RPC streaming surface, settings route, and tests together.
5. Add first-run onboarding last, using actual upstream provider/settings APIs if they have changed.
6. Apply desktop build, asset, CI, dependency, and browser-test changes. Regenerate lockfile rather than transplanting it blindly.

## 1. Product, package, and deployment rebrand

Rename product from **T3 Code** to **Kairo** and hosted service from **T3 Connect** to **Kairo Connect**. This is not cosmetic: package names, persisted local paths, environment variables, desktop identity, URI scheme, release artifacts, cloud defaults, and mobile native module names all change.

### Required identifier mapping

| Previous upstream form                                          | Kairo form                                                               |
| --------------------------------------------------------------- | ------------------------------------------------------------------------ |
| `T3 Code`                                                       | `Kairo`                                                                  |
| `T3 Connect`                                                    | `Kairo Connect`                                                          |
| `t3code`                                                        | `kairo`                                                                  |
| `@t3tools/*`                                                    | `@kairo/*`                                                               |
| `T3CODE_*`                                                      | `KAIRO_*`                                                                |
| `.t3code`                                                       | `.kairo`                                                                 |
| `com.t3tools.t3code`                                            | `com.kairo.app`                                                          |
| `t3code://`                                                     | `kairo://`                                                               |
| `app.t3.codes` / `latest.app.t3.codes` / `nightly.app.t3.codes` | `app.kairo.codes` / `latest.app.kairo.codes` / `nightly.app.kairo.codes` |

Apply mapping throughout application code, tests, docs, `.env.example`, shell scripts, GitHub workflows, release metadata, mobile configuration, generated schema names, and asset paths. Do not rename vendor API fields or third-party identifiers containing `t3` unless they are Kairo-owned.

### Workspace and native moves

- Rename root workspace to `@kairo/monorepo`, server CLI package to `kairo`, and all internal workspace dependencies/imports to `@kairo/*`.
- Rename `oxlint-plugin-t3code` directory/package/rules namespace to `oxlint-plugin-kairo` and use `kairo/no-inline-schema-compile` plus `kairo/no-manual-effect-runtime-in-tests` in root `vite.config.ts`.
- Rename web Clerk components from `T3Connect...` / `useT3Connect...` to Kairo Connect equivalents.
- Rename mobile native modules and their registration names:
  - `t3-review-diff` to `kairo-review-diff`, including podspec, Expo module config, Swift module/view names, and Android package/module names.
  - `t3-terminal` to `kairo-terminal`, with matching iOS and Android native symbols and Expo configuration.
- Use Kairo mobile icon SVGs, application IDs, display names, permissions, user-agent labels, storage keys, and diagnostics text. Keep compatibility only where upstream requires an existing persisted key migration.

### Desktop/release identity

- Set desktop product name to `Kairo`; nightly name is `Kairo (Nightly)`.
- Use `com.kairo.app`, `kairo` executable, `Kairo-<version>-<arch>.<ext>` artifact names, `kairo://` protocol, Kairo macOS/Windows/Linux icons, and `kairoCommitHash` in staged package metadata.
- Change every desktop build/release environment variable to `KAIRO_DESKTOP_*`. Change relay/Clerk/web deployment variables to `KAIRO_*`, including `VITE_KAIRO_RELAY_URL` and `KAIRO_WEB_SOURCEMAP`.
- Default hosted URLs to Kairo domains above. Release workflow package filters must target `kairo`, `@kairo/web`, `@kairo/scripts`, `@kairo/desktop`, and `@kairo/oxlint-plugin-kairo`.
- Preserve `apps/desktop/scripts/electron-launcher.mjs` shared Electron binary resolver. It must resolve Electron once for development and packaged starts rather than duplicating platform lookup.

### Visible web/marketing branding

- Default `APP_BASE_NAME` is `Kairo`; local development stage label is `Beta`.
- Sidebar uses `apps/web/public/kairo.svg` followed by text `airo`; splash screen uses same Kairo asset and accessible Kairo labels.
- Marketing layout/title/footer and download/release pages call product Kairo. Product copy describes a practical everyday AI assistant with persistent memory and connected-platform data, while coding-agent functionality remains available.
- Replace favicon, Apple touch, Windows, macOS, universal, and web assets with Kairo files under `assets/prod/`; keep production asset names `kairo-black-*`.

## 2. Supermemory provider memory

Add optional user-scoped hosted Supermemory support. It is disabled by default and must never put API key into ordinary settings or logs.

### Contracts and persisted settings

Create `packages/contracts/src/memory.ts`, export it from contract index, and extend settings with `memory.supermemory`.

```ts
supermemory: {
  enabled: boolean;                 // default false
  mode: "hosted";                  // "local" decodes as hosted for compatibility
  scope: "user";
  providerInstanceIds: ProviderInstanceId[];
  hosted: { apiUrl: "https://api.supermemory.ai" };
}
```

Also define patch/configure/test/install inputs, provider install status, full status result, and tagged `SupermemoryError`. Include schemas and defaults in `settings.test.ts`.

### Secret and provider behavior

- Store API key in `ServerSecretStore` under `supermemory.hosted.apiKey`; never persist it in server settings. Redact every `sm_...` token before reporting errors/logs.
- Inject generated sensitive provider environment variables only into selected, supported provider instances while constructing effective provider config:
  - Codex: `SUPERMEMORY_CODEX_API_KEY`
  - Claude Agent: `SUPERMEMORY_CC_API_KEY`
  - OpenCode: `SUPERMEMORY_API_KEY`
- Preserve user-defined environment entries except generated entries with those exact names, which must be replaced. Unsupported drivers stay visible in status as `unsupported`; do not inject environment variables.

### Codex integration

Implement `apps/server/src/memory/SupermemoryCodexIntegration.ts`.

- Run `npx codex-supermemory@latest install` with selected instance's `CODEX_HOME` when configured.
- Resolve Codex home to configured `homePath`, else `~/.codex`.
- Treat `recall.js`, `flush.js`, `save-memory.js`, and `search-memory.js` in `<CODEX_HOME>/supermemory` as installed scripts.
- Validate `hooks.json` contains exact `node <supermemory-dir>/recall.js` `UserPromptSubmit` and `node <supermemory-dir>/flush.js` `Stop` hook commands.
- Write `<CODEX_HOME>/supermemory/credentials.json` containing API key and timestamp, permissions `0600`; directory permissions `0700` where platform permits it.
- Merge into `<CODEX_HOME>/supermemory.json` without losing existing fields:

```json
{
  "containerTagPrefix": "kairo",
  "userContainerTag": "kairo_user_memory",
  "projectContainerTag": "kairo_user_memory"
}
```

- On disable, remove only credentials file whose API key equals Kairo's currently stored key. Do not delete user configuration or a different key.

### Server service and RPC

Add `SupermemoryService` live layer to server runtime. It must:

- expose status, configure, test connection, install providers, and disable;
- probe `GET /v3/documents?limit=1` with bearer token, 5-second timeout; surface missing key, `401`/`403`, and `5xx` as meaningful status/error;
- save selected IDs and enable memory on configure; synchronize Codex key/config after configure, provider install, and status read;
- run provider installers with 2-minute timeout and bounded/redacted output; OpenCode command is `bunx opencode-supermemory@latest install --no-tui`;
- report Claude install guidance but do not automate it: add marketplace `supermemoryai/claude-supermemory`, then install `claude-supermemory`;
- report Codex state separately: scripts/hooks, credentials, and config must all be ready.

Add authenticated WebSocket RPC methods, local API methods, client runtime wrappers, and `apps/web/src/localApi.ts` bridge:

`server.getMemoryStatus`, `server.configureMemory`, `server.testMemoryConnection`, `server.installMemoryProviders`, `server.disableMemory`.

Read methods require orchestration-read permission; mutating methods require orchestration-operate permission. Instrument calls under `server.memory`.

### Web UI and tests

- Add `/settings/memory` route, Memory link in `SettingsSidebarNav`, and `SupermemorySettings.tsx`.
- UI shows API key presence only, supports entering/testing/replacing key, selecting provider instances, installing supported provider integration, and disabling memory. Surface server-returned provider status/guidance.
- Add unit coverage for schemas, secret redaction, provider bindings, Codex filesystem sync/remove behavior, service status/configure/error handling, WebSocket authorization, and client subscription mocks.

## 3. Composio connected-app integrations

Add optional Composio management for connected platform toolkits. CLI operations run on server machine, not browser; progress is streamed to client.

### Contracts and settings

Create/export `packages/contracts/src/composio.ts`. Define CLI/auth/toolkit/catalog/agent-support/operation status schemas, typed errors, setup inputs, and progress event.

Extend settings with `integrations.composio`:

```ts
{
  enabled: boolean;
  providerInstanceIds: ProviderInstanceId[];
  preferredToolkits: string[];
}
```

Defaults must leave feature disabled with no selected providers/toolkits.

### Server service

Implement `apps/server/src/composio/ComposioService.ts` plus `ComposioProviderBindings.ts`.

- Detect CLI via `composio --version`, then `COMPOSIO_INSTALL_DIR` or `~/.composio/composio` (`.exe` on Windows).
- Install CLI with `curl -fsSL https://composio.dev/install | bash` on macOS/Linux. On Windows run PowerShell `npm install -g @composio/cli`, failing clearly if `npm` is absent.
- Sign in with `composio login`; allow 10 minutes and pass any authentication URL/progress through stream events.
- Discover account via CLI status and toolkit state with `composio link <toolkit> --list`. Parse JSON where possible and table output as fallback.
- Load full toolkit catalog through CLI when authenticated. When unavailable, provide a curated fallback catalog covering productivity, communication, Google Workspace, and other integrations with a message stating why results are limited.
- Link toolkit via `composio link <toolkit>`, then persist its name in deduplicated `preferredToolkits`.
- Persist selected provider IDs when setup/login/agent-support starts. `disable` clears enabled and selected providers but may retain preferred toolkit history only if desired by current upstream settings semantics; captured branch clears selected provider IDs.
- Expose single in-flight operation status. Emit `running`, stage updates, stdout/stderr snippets, optional auth URL, success/failure. Bound process output and use redacted error messages.

Provider bindings prepend install directory to `PATH` and set non-sensitive `COMPOSIO_INSTALL_DIR` only on selected provider instances. Replace generated `PATH`/`COMPOSIO_INSTALL_DIR` entries without deleting unrelated user values. Apply Composio binding before Supermemory binding in provider config hydration.

Agent status: Codex uses CLI from `PATH`; Claude reports needs-install guidance; other drivers report native skill discovery unverified. `installComposioAgentSupport` persists selection and returns refreshed status.

### RPC and UI

Add service live layer, WebSocket handlers/authorization/instrumentation under `server.composio`, contract RPC declarations, client runtime wrappers, and local API bridge:

- Unary: `server.getComposioStatus`, `server.listComposioToolkits`, `server.installComposioAgentSupport`, `server.disableComposio`.
- Streams: `server.installAndLoginComposio`, `server.loginComposio`, `server.linkComposioToolkit`.

Add settings navigation plus routes `/settings/integrations` and `/settings/integrations/apps`. Build `IntegrationsSettings.tsx`, `ComposioAppsSettings.tsx`, and pure `IntegrationsSettings.logic.ts`.

UI requirements:

- clear primary action based on CLI/auth state: install and sign in, sign in, or none;
- show streamed setup state/dialog and recoverable failures;
- show provider selection and agent-support installation state;
- search catalog, show connected apps separately, and launch toolkit link flow;
- use fallback catalog safely when backend CLI is missing or unauthenticated.

Test CLI probing/installation/login/link failures, table/JSON parsing, catalog fallbacks, provider environment merging, service operation streaming, selection logic, routes, RPC authorization, and local API callbacks.

## 4. First-run onboarding

Add persistent `onboardingCompleted: boolean` to client settings, default `false`. In authenticated root route, render `OnboardingGate` before normal application shell until completion. Completing final step updates setting to `true`; an existing user can bypass only through settings migration or explicit completion, not by a rendering race.

`apps/web/src/components/onboarding/OnboardingGate.tsx` is four steps:

1. **Agents**: list Codex, Claude Agent, and OpenCode. A provider is usable only when coding driver, enabled, installed, available, and status `ready`. Continue stays disabled without at least one usable provider. Present install action when version advisory supports it, otherwise login action for installed unauthenticated provider.
2. **Memory**: optional Supermemory API-key and provider selection flow. Link to `https://app.supermemory.ai/?view=integrations`. User may continue without configuring memory.
3. **Composio**: optional setup using same integration dialog/logic as settings, with connected-app search/linking.
4. **Finish**: explain completed setup and mark onboarding complete.

Allow navigation only backwards to earlier steps. Keep completed step state when returning. Show toast errors, disable competing actions while busy, refresh provider status after install/login, and make action labels/statuses accessible.

### Provider browser login support

Extend provider maintenance runner and drivers for Codex, Claude Agent, and OpenCode login. Driver must return/emit browser authorization URL when available; server must forward it through existing provider-maintenance WebSocket flow. Onboarding opens URL through local desktop shell and then refreshes provider detection. Preserve command output limits, timeout behavior, and tests for URL parsing/opening.

## 5. Desktop assets and DMG compatibility

- Replace production logos/icons with Kairo artwork, including `assets/prod/logo.svg` and web icons. Update release smoke and manifest tests for Kairo names.
- Add `scripts/dmgbuild-hdiutil-shim.mjs`: parse dmgbuild `-s <settings.json> <volumeName> <artifactPath>`, copy regular contents/symlink link entries to temporary directory, then call `hdiutil create` with `-volname`, `-srcfolder`, `-format`, optional `-size`, and destination. Always remove temporary files.
- `shouldUseHdiutilDmgbuildShim` returns true only for macOS target built on Darwin kernel major below 22 and when `CUSTOM_DMGBUILD_PATH` is absent. Set that variable to shim path immediately before Electron Builder. Keep tests for version boundary, non-mac target/host, and user override.

## 6. Dependency, CI, and browser-test maintenance

### Dependency state

Reconcile workspace manifests with current Kairo names and lockfile. Captured branch updates Vite+, Effect, React/mobile/Desktop package dependency metadata, moves pnpm options for required build scripts, and preserves patches:

- `@effect/vitest@4.0.0-beta.78`
- `@expo/metro-config@56.0.13`
- `@pierre/diffs@1.1.20`
- `effect@4.0.0-beta.78`
- `react-native-nitro-modules@0.35.9`

Use compatible current upstream versions where possible; regenerate `pnpm-lock.yaml` after manifests settle. Do not copy old lockfile if upstream dependency graph materially changed.

### CI

- Update all package filters to `@kairo/*`/`kairo` and environment variable names to `KAIRO_*`.
- Keep `vp check` and `vp run test` CI jobs. Browser test job needs a 60-minute timeout.
- Set web unit/browser hook and test timeouts to 60 seconds; full ChatView/settings browser flows can exceed lower CI defaults.
- Root Vite config needs `~` alias resolving to `apps/web/src`, required by browser-test imports.

### Browser test reliability

Refactor `ChatView.browser.tsx`, `SettingsPanels.browser.tsx`, `ConnectionsSettings.tsx`, and `KeybindingsToast.browser.tsx` around stable accessible interactions rather than timing-sensitive selectors. Tests should await visible state after opening dialogs/menus, not assume immediate DOM updates. Preserve coverage for chat, settings, connections, and keybinding toast paths.

## Verification checklist

Run after replay and after resolving upstream conflicts:

```sh
vp check
vp run typecheck
vp test
```

When mobile files changed, also run:

```sh
vp run lint:mobile
```

Manually verify:

- Fresh profile sees onboarding; cannot proceed from Agents without ready coding provider; back navigation preserves choices.
- Supermemory key is absent from settings payload/logs, selected provider receives only expected sensitive environment variable, Codex hook/config files are synchronized, and disable removes only matching credentials.
- Composio missing-CLI, install/login, auth URL, toolkit linking, fallback catalog, selected-provider environment, and disable paths all report predictable states.
- Desktop build produces Kairo product/package/protocol/artifact identity; old macOS uses shim only under defined conditions.
- `rg -n 'T3 Code|T3 Connect|@t3tools|T3CODE_|t3code'` over Kairo-owned code/config/docs is empty except intentional historical/reference material.

## Commit map

| Commits                                                                            | Change                                                                                                            |
| ---------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------- |
| `cc08d200`                                                                         | Supermemory service, settings, provider integration, UI, RPC, tests                                               |
| `13445f03`, `9c92d9e1`, `a0f4fd25`, `1cfaf927`, `f532fae7`, `d6f583ee`             | Kairo rebrand, visual assets, beta label, stale-name cleanup                                                      |
| `732af608`, `057bf73b`, `487940d1`                                                 | Composio settings/service and Kairo contract-import cleanup                                                       |
| `4a72437f`, `1cb324ec`                                                             | Product/docs positioning and concise README                                                                       |
| `7606cddc`, `60e70fce`, `ea4b77fa`                                                 | Electron binary reuse, legacy-macOS DMG shim, release assets/build updates                                        |
| `9ee02ccd`, `052bfe9c`, `cdedd109`, `4b0518f8`, `8c346e5a`, `fcba73e0`, `1e420d0a` | First-run onboarding, back navigation, required usable provider, provider browser login, Supermemory console link |
| `1afbc260`                                                                         | Workspace dependency/lockfile update                                                                              |
| `58cfef0d`, `6af4664c`                                                             | Restore test workflow and stabilize browser CI                                                                    |
