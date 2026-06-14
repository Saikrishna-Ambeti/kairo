# Kairo

Kairo is an AI assistant app for getting through everyday work faster.

It is built for people who are new to AI, or who want a calmer way to use AI effectively in daily life and work. Kairo gives you one place to ask for help, keep useful context in persistent memory, and connect the assistant to information from the tools and platforms you already use.

Kairo can help with practical tasks like understanding documents, drafting responses, summarizing information, planning next steps, and using connected data when you authorize it. Under the hood it can run multiple AI providers, including Codex, Claude, Cursor, and OpenCode.

> [!NOTE]
> Kairo is still very early. Some user-facing flows are changing from a coding-agent workbench into a more general assistant experience.

## Installation

> [!WARNING]
> Kairo currently uses local AI provider CLIs. Install and authenticate at least one provider before use:
>
> - Codex: install [Codex CLI](https://developers.openai.com/codex/cli) and run `codex login`
> - Claude: install [Claude Code](https://claude.com/product/claude-code) and run `claude auth login`
> - Cursor: install [Cursor CLI](https://cursor.com/cli) and run `cursor-agent login`
> - OpenCode: install [OpenCode](https://opencode.ai) and run `opencode auth login`

### Desktop app

Install the latest version of the desktop app from [GitHub Releases](https://github.com/pingdotgg/kairo/releases).

## Some notes

We are very early in this project. Expect bugs.

We are not accepting contributions yet.

There's no public docs site yet. Browse the markdown files in [docs](./docs) for setup notes and architecture references.

## Documentation

- [Getting started](./docs/getting-started/quick-start.md)
- [Architecture overview](./docs/architecture/overview.md)
- [Provider guides](./docs/providers/codex.md)
- [Operations](./docs/operations/ci.md)
- [Reference](./docs/reference/encyclopedia.md)

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

Read [CONTRIBUTING.md](./CONTRIBUTING.md) before opening an issue or PR.
