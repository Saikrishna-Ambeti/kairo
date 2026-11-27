# Install Kairo

Kairo runs coding agents on your computer and lets you control them from its
desktop, web, or mobile app. Set up the machine where the agents will work first.

## Requirements

You need at least one installed, authenticated coding agent (provider) before starting a thread. You can launch Kairo first and set up providers from the [Welcome page](./welcome-page.md) or **Settings → Providers**.

## Command line

Install the `t3` command to `~/.local/bin`:

```bash
# macOS / Linux
curl -fsSL https://kairo.codes/install.sh | sh
```

```powershell
# Windows (PowerShell)
irm https://kairo.codes/install.ps1 | iex
```

This puts `kairo` in `~/.local/bin`. If your shell reports `command not found`
afterwards, that directory is not on your `PATH` yet; the installer prints the
line to add. Set `KAIRO_CHANNEL=nightly` to install the nightly train, or
`KAIRO_VERSION` to pin an exact version.

| Task                          | Command                                                                 |
| ----------------------------- | ----------------------------------------------------------------------- |
| Start server and open web app | `t3` (or `t3 ./my-project`)                                             |
| Start server without browser  | `kairo serve`                                                           |
| Set up remote access          | `kairo up` ([Remote access](./remote-access.md))                        |
| Run in the background         | `kairo service install` ([Background service](./background-service.md)) |
| Update                        | `kairo update`                                                          |
| Reclaim database space        | `t3 doctor` ([Details](./background-service.md#reclaim-database-space)) |
| Uninstall                     | `kairo uninstall`                                                       |

If `t3` reports a server is already running, connect with `kairo pair` or pass a separate `--base-dir`. Run `kairo --help` for all commands.

### Intel Macs

There is no standalone `t3` binary for Intel Macs—use the desktop app, or build a server from source with `vp` ([development runbook](../operations/00_development.md#first-checkout)):

```bash
git clone https://github.com/Saikrishna-Ambeti/kairo
cd kairo && vp i && vp run build:desktop
node apps/server/dist/bin.mjs
```

## Desktop app

Download from [GitHub Releases](https://github.com/pingdotgg/t3code/releases) or install via a package manager:

| Platform                | Command                                                        |
| ----------------------- | -------------------------------------------------------------- |
| macOS                   | `brew install --cask kairo-code`                               |
| Windows                 | `winget install T3Tools.Kairo` or `scoop install extras/kairo` |
| Debian / Ubuntu         | `sudo apt install ./T3-Code-*.deb`                             |
| Arch Linux              | `yay -S kairo-bin` (or `yay -S kairo-nightly-bin`)             |
| Nix (flakes, Nix 2.30+) | `nix profile add github:NixOS/nixpkgs/nixos-unstable#kairo`    |

- **Linux AppImage**: `chmod +x ./T3-Code-*.AppImage && ./T3-Code-*.AppImage` (x86_64 and ARM64). `.deb` self-updates with a password prompt; update AUR packages via your AUR helper (`yay -Syu`).
- **NixOS / Home Manager**: Add `pkgs.kairo` to `environment.systemPackages` or `home.packages` (`kairo-desktop` launches the app; `t3` is included). Update via Nix rather than the in-app updater.

### The `t3` command

The desktop app bundles `t3` and sets it up on first launch (manage anytime under **Settings → About → t3 command**). Use **Add to PATH** if needed, then open a new terminal.

- **Open a folder in the running desktop app**: Run `kairo app` (or `kairo app ../my-project`) from a terminal, or drag folders from your file manager onto the desktop sidebar.

### Windows Subsystem for Linux

Select a WSL distro in **Settings → Sharing & access** to run agents and projects inside WSL (install provider CLIs inside that distro). Kairo manages its own server runtime inside WSL automatically.

## Mobile app

Install from the [App Store](https://apps.apple.com/us/app/kairo-code-remote-claude-more/id6787819824) or [Google Play](https://play.google.com/store/apps/details?id=com.kairo.app) (QR codes are also in **Settings → About → Mobile app**). The mobile app connects to a server on another machine via [remote access](./remote-access.md).

- Store builds work with both Stable and Nightly servers. Optional Android beta APKs are under [Android beta releases](https://github.com/pingdotgg/t3code/releases?q=android-beta-).
- If the mobile app crashes on launch, open **Settings → Diagnostics** on the next launch to copy recent startup crash reports.

## Providers

Open **Settings → Providers** (web or desktop), select the environment, and enable the providers you use. Installation and sign-in always happen on the **environment's machine**.

| Provider         | Install and authenticate                                                                                                 | Guide                                     |
| ---------------- | ------------------------------------------------------------------------------------------------------------------------ | ----------------------------------------- |
| **Codex**        | Connect with ChatGPT in Settings, or install [Codex CLI](https://developers.openai.com/codex/cli) and run `codex login`. | [Codex](./providers-codex.md)             |
| **Claude**       | Install [Claude Code](https://claude.com/product/claude-code) and run `claude auth login`.                               | [Claude](./providers-claude.md)           |
| **Cursor**       | Sign in in Settings or install [Cursor CLI](https://cursor.com/cli) and run `agent login`.                               | [Cursor](./cursor.md)                     |
| **Grok Build**   | Install [Grok Build CLI](https://x.ai/cli) and run `grok login`.                                                         | [Grok](./providers-grok.md)               |
| **Antigravity**  | Install managed runtime and sign in with Google in Settings.                                                             | [Antigravity](./providers-antigravity.md) |
| **OpenCode**     | Install [OpenCode](https://opencode.ai) and run `opencode auth login`.                                                   | [OpenCode](./providers-opencode.md)       |
| **Kiro**         | Install [Kiro CLI](https://kiro.dev/docs/cli/) and run `kiro-cli login`.                                                 | [Kiro](./providers-kiro.md)               |
| **Pi**           | Install [Pi](./providers-pi.md) (Node.js 22.19+) and run `pi` → `/login`.                                                | [Pi](./providers-pi.md)                   |
| **Muse Code**    | Install [Muse Code](https://dev.meta.ai/docs/muse-code) and run `muse login`.                                            | [Muse Code](./providers-muse.md)          |
| **fx**           | Install [fx](https://fx.sh) and run `fx login`.                                                                          | [fx](./providers-fx.md)                   |
| **ACP Registry** | Add GitHub Copilot and other agents in **Settings → Providers → Add provider → Show more**.                              | [ACP](./providers-acp.md)                 |

- **Binary path**: If a CLI isn't on the server's `PATH` (common with version managers), set **Binary path** in the provider's settings.
- **Updates**: Click **Update now** on outdated provider cards (supports Homebrew, mise `latest`, npm/pnpm/Yarn/Bun/Volta/Vite+, or the CLI's own updater; update Nix, Chocolatey, or pinned mise installs manually).
- **Multiple instances**: Add extra provider instances for separate accounts, API keys, or custom endpoints (mark secret env vars as sensitive).

### Provider check timeouts

If a working CLI times out during Kairo's readiness check, increase its probe deadline (in milliseconds) in the server's environment (or systemd override / `service.env`) and restart:

```bash
KAIRO_CODEX_PROBE_TIMEOUT_MS=60000 KAIRO_CLAUDE_PROBE_TIMEOUT_MS=60000 kairo serve
```

| Provider     | Environment variable                  |
| ------------ | ------------------------------------- |
| Codex        | `KAIRO_CODEX_PROBE_TIMEOUT_MS`        |
| Claude       | `KAIRO_CLAUDE_PROBE_TIMEOUT_MS`       |
| Cursor       | `KAIRO_CURSOR_PROBE_TIMEOUT_MS`       |
| Antigravity  | `KAIRO_ANTIGRAVITY_PROBE_TIMEOUT_MS`  |
| Grok         | `KAIRO_GROK_PROBE_TIMEOUT_MS`         |
| Kiro         | `KAIRO_KIRO_PROBE_TIMEOUT_MS`         |
| fx           | `KAIRO_FX_PROBE_TIMEOUT_MS`           |
| Pi           | `KAIRO_PI_PROBE_TIMEOUT_MS`           |
| Muse Code    | `KAIRO_MUSE_PROBE_TIMEOUT_MS`         |
| OpenCode     | `KAIRO_OPENCODE_PROBE_TIMEOUT_MS`     |
| ACP Registry | `KAIRO_ACP_REGISTRY_PROBE_TIMEOUT_MS` |

## Next steps

- [User guide index](./README.md): overview of how Kairo works.
- [Working with threads](./thread-sidebar.md): start tasks and organize parallel work.
- [Permission modes](./permission-modes.md): control when agents ask before acting.
- [Remote access](./remote-access.md): connect from another device.
- [Updating Kairo](./updating.md): keep apps, servers, and providers up to date.
