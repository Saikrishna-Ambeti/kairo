# Kairo

Kairo is a calm, local-first AI assistant for getting through everyday work faster. It keeps useful context in optional persistent memory and can connect agents to information from tools and platforms you authorize.

Kairo works with local provider CLIs for Claude, Codex, Cursor, Grok Build, and OpenCode. Coding-agent workflows remain available alongside the everyday assistant experience.

Kairo is built on the MIT-licensed [T3 Code](https://github.com/pingdotgg/t3code) project. See [LICENSE](./LICENSE) for attribution.

## What Kairo can do

- Run Codex, Claude, Cursor, Grok Build, and OpenCode from one web, desktop, or mobile client.
- Switch each thread between **Build**, **Plan**, and **Study**. Study Mode is available to users
  who select the Student role and can continue a learning plan across threads when memory is on.
- Keep optional, user-scoped memory through Kairo Cloud without exposing the hosted Supermemory
  credential to the local server or provider process.
- Connect agents to approved apps and services through the integrations settings.
- Work with Git branches, worktrees, checkpoints, diffs, terminals, and pull requests without
  leaving the conversation.
- Control a local or remote Kairo environment from another browser, desktop, phone, or tablet.
- Save student routine drafts for assignment check-ins, revision planning, lecture-note cleanup,
  and weekly resets. These drafts stay in the browser and do not run automatically yet.

Kairo keeps the agent runtime on the environment machine. Remote clients control that environment
through Kairo's typed WebSocket protocol, so the same project and thread history remain available
across supported clients.

## "Wait, what are you selling me?"

Nothing. Kairo exists to make capable local agents easier to use for practical daily work.

We wanted something performant, remote-ready, and truly open. If we ever go the wrong direction, we want you to have everything you need to fork and build the editor that you want.

## Installation

> [!WARNING]
> Kairo currently supports Codex, Claude, Cursor, Grok Build and OpenCode. Install and authenticate at least one provider before use:
>
> - Codex: install [Codex CLI](https://developers.openai.com/codex/cli) and run `codex login`
> - Claude: install [Claude Code](https://claude.com/product/claude-code) and run `claude auth login`
> - Cursor: install [Cursor CLI](https://cursor.com/cli) and run `agent login`
> - Grok Build: install [Grok Build CLI](https://x.ai/cli) and run `grok login`
> - OpenCode: install [OpenCode](https://opencode.ai) and run `opencode auth login`

### Try it out (install-free)

The easiest way to test Kairo is to run the server in your terminal (requires Node.js 22.16+, 23.11+, or 24.10+):

```bash
npx kairo@latest
```

This will launch Kairo's backend on your machine as well as the local web app to control your agents.

Tip: Use `npx kairo@latest --help` for the full CLI reference.

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
- [Customize a project icon](./docs/user/project-settings.md)
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
