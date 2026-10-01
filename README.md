# Kairo

Kairo is a calm, local-first AI assistant for getting through everyday work faster. It keeps useful context in optional persistent memory and can connect agents to information from tools and platforms you authorize.

Works with your subscriptions on Claude Code, Codex, Cursor, Grok Build, OpenCode, and Google Antigravity. If they're set up on your computer, Kairo can control them.

## "Wait, what are you selling me?"

Nothing. Kairo exists to make capable local agents easier to use for practical daily work.

We wanted something performant, remote-ready, and truly open. If we ever go the wrong direction, we want you to have everything you need to fork and build the editor that you want.

## Installation

> [!WARNING]
> Kairo currently supports Codex, Claude, Cursor, Grok Build, OpenCode, and Antigravity. Install and authenticate at least one provider before use:
>
> - Codex: install [Codex CLI](https://developers.openai.com/codex/cli) and run `codex login`
> - Claude: install [Claude Code](https://claude.com/product/claude-code) and run `claude auth login`
> - Cursor: install [Cursor CLI](https://cursor.com/cli) and run `agent login`
> - Grok Build: install [Grok Build CLI](https://x.ai/cli) and run `grok login`
> - OpenCode: install [OpenCode](https://opencode.ai) and run `opencode auth login`
> - Antigravity: enable it in Settings, then use **Install Antigravity** and **Sign in with Google**. No CLI is required.

### Command line

```bash
curl -fsSL https://kairo.codes/install.sh | sh
```

On Windows, in PowerShell:

```powershell
irm https://kairo.codes/install.ps1 | iex
```

Then run `kairo` to start the server and open the local web app. `kairo service install` keeps it running in the background, `kairo update` moves to a newer release, and `kairo --help` has the full reference.

To try it once without installing, run `npx kairo@latest` instead.

### Desktop app

Install the latest version of the desktop app from [GitHub Releases](https://github.com/Saikrishna-Ambeti/kairo/releases), or from your favorite package registry:

#### Windows (`winget`)

```bash
winget install Kairo.Kairo
```

#### macOS (Homebrew)

```bash
brew install --cask kairo-code
```

#### Debian, Ubuntu (`.deb`)

Download the `.deb` from [GitHub Releases](https://github.com/Saikrishna-Ambeti/kairo/releases), then:

```bash
sudo apt install ./Kairo-Code-*.deb
```

#### Arch Linux (AUR)

Stable:

```bash
yay -S kairo-bin
```

Nightly:

```bash
yay -S kairo-nightly-bin
```

The AUR packaging is maintained in this repository under [`packaging/aur`](./packaging/aur).

## Some notes

We are very early in this project. Expect bugs.

We are (mostly) not accepting contributions yet. Small fixes may be considered. Big features will not be.

## Documentation

Full docs live in [docs/](./docs). There's no docs site yet.

- [Install and first run](./docs/user/install.md)
- [Build, Plan, and Study modes](./docs/user/composer.md#interaction-modes)
- [Persistent memory](./docs/user/memory.md)
- [Scheduled tasks for students](./docs/user/scheduled-tasks.md)
- [Permission modes](./docs/user/permission-modes.md)
- [Keyboard shortcuts](./docs/user/keybindings.md)
- [Project settings](./docs/user/project-settings.md)
- [Remote access from a phone or another machine](./docs/user/remote-access.md)
- [Keeping app and server in sync](./docs/user/updating.md)
- [Source control integrations](./docs/user/source-control.md)
- Multiple accounts: [Codex](./docs/user/providers-codex.md) · [Claude](./docs/user/providers-claude.md)
- Linux: [run Kairo as a background service](./docs/user/background-service.md)
- [Product development timeline](./docs/documentation/development-timeline.md)

Building from source? Start at [docs/internals/overview.md](./docs/internals/overview.md).

## If you REALLY want to contribute still.... read this first

### Install `vp`

Kairo uses Vite+ so you'll need to install the global `vp` command-line tool.

#### macOS / Linux

```bash
curl -fsSL https://vite.plus | bash
```

#### Windows

```bash
irm https://vite.plus/ps1 | iex
```

Checkout their getting started guide for more information: https://viteplus.dev/guide/

### Install dependencies

```bash
vp i
```

Read [CONTRIBUTING.md](./CONTRIBUTING.md) before reporting a bug or opening a PR.

Have a feature request? Start an [Ideas discussion](https://github.com/Saikrishna-Ambeti/kairo/discussions/categories/ideas).

Need support? Join the [Discord](https://discord.gg/jn4EGJjrvv).
