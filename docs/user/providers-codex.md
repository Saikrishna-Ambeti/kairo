# Codex

For one account, use the default Codex provider with your normal Codex login.
[Provider setup](./install.md#providers) covers installation, Settings > Providers,
and custom binaries or environment variables.

## Use multiple accounts

A shared Codex home with a shadow home lets work and personal accounts continue
the same threads. The accounts share Codex sessions and configuration while keeping
their own login and available models.

## I Only Use One Codex Account

Use the default provider.

In Settings, your Codex provider can stay like this:

```text
Display name: Codex
CODEX_HOME path: ~/.codex
Shadow home path: empty
```

Log in with Codex normally:

```bash
codex login
```

## Send feedback to OpenAI

In an existing Codex thread, send `/feedback` or `/feedback` followed by a description of the
issue. Kairo uploads the thread and Codex logs to OpenAI and shows a thread ID that you can copy
and share with OpenAI employees.

## Answer questions while Codex works

Codex can ask questions without stopping its work. Choose a suggested answer or enter your own
in the question panel. Questions without suggested answers accept text.

Your answers are sent as a new message. They reach the current turn while Codex is working, or
start a new turn if it has finished. Unanswered questions stay available after you reconnect.
This works in the web, desktop, and mobile apps. Codex must support async questions.

## Sub-agent models

The web and desktop Agents panel shows each sub-agent's model and reasoning effort when Codex
reports them. If Codex does not report either value, Kairo leaves it out instead of using the
parent agent's settings.

## Browser and computer activity

Browser and Computer Use calls show their user-facing task title when Codex provides one. Expanded
activity groups show an icon for every call. Website calls use the active page's favicon when it is
available, and desktop app calls use the app's native icon on macOS when available. Other hosts use
a generic fallback glyph.

Collapsed activity groups are summarized by source, such as `Used Chrome integration`, instead of
showing the underlying tool name. Website favicons and native app icons keep their original colors;
integrations that provide separate light and dark logos use the logo for the current appearance.

## Approve access to other apps

When a Codex tool needs access to an app such as Safari, Kairo shows the app name and asks for
approval. You can approve, decline, or cancel the request from the desktop app, web app, or mobile
app. Some tools also offer approval for the current session or permanent approval.

## I Want Work And Personal Codex Accounts

Use one real Codex home and one shadow home.

Recommended setup:

```text
~/.codex      shared Codex home
~/.codex_p    second account auth
```

The idea is:

- both accounts can see the same Kairo/Codex sessions
- each account keeps its own login
- existing threads can continue with either account

### Set Up The First Account

Log in normally:

```bash
codex login
```

This is the account used by `~/.codex`.

In Kairo Settings, name it something obvious:

```text
Display name: Codex Work
CODEX_HOME path: ~/.codex
Shadow home path: empty
```

### Set Up The Second Account

Log in with a separate Codex home:

```bash
mkdir -p ~/.codex_personal
CODEX_HOME=~/.codex_personal codex login
```

Then add a second Codex instance in **Settings > Providers**:

| Instance       | CODEX_HOME path | Shadow home path    |
| -------------- | --------------- | ------------------- |
| Codex Work     | `~/.codex`      | Leave empty         |
| Codex Personal | `~/.codex`      | `~/.codex_personal` |

Both instances must use the same **CODEX_HOME path**. Kairo prepares the shared
state in the shadow directory; do not populate it by copying your whole Codex
home.

The shadow account needs its own `auth.json` file. If Codex uses an OS credential
store, configure file storage for this setup. See
[OpenAI's credential storage guide](https://learn.chatgpt.com/docs/auth#credential-storage).

Use a completely separate **CODEX_HOME path**, with no shadow home, when you want
separate Codex sessions and configuration. That instance cannot continue threads
from the other home.

## Switch accounts in an existing thread

Choose the other account from the thread's model picker. Kairo offers compatible
Codex instances that share the thread's **CODEX_HOME path**. Changing accounts does
not move the conversation into a separate Codex home.

If the account is missing from the picker, compare the home paths in provider
settings. If two instances show the same unexpected account or models, check their
reported accounts, refresh provider status, and confirm the second instance has
its own shadow path and login. A shadow-home conflict usually means the directory
contains a copied Codex setup. Use a fresh shadow directory and sign in again.

## Answer questions while Codex works

Codex can ask a question and keep working. Answer it in the thread's question
panel. The answer becomes a new message: it reaches the active turn, or starts
another turn if Codex has finished. Unanswered questions survive reconnects.
If you do not want to answer, dismiss the question from its panel. Dismissing
closes it without sending anything to Codex. This requires a Codex version that
supports async questions.

## Approve app access

Codex tools can request access to another app. Respond to the named app's request
in the thread on web, desktop, or mobile. Some tools offer access for one request,
the current session, or permanently. See [Permission modes](./permission-modes.md)
for command and file approvals.

## Codex says I hit a usage limit

When Codex stops on a usage limit, the thread names the window that ran out and
when it resets, when Codex reports them. Send the message again after the reset. On a workspace plan the
message also says whether your workspace owner needs to add credits or raise the
spend limit to continue sooner.

## Send feedback to OpenAI

In an existing Codex thread, send `/feedback` with an optional description, for
example `/feedback The agent stopped before finishing the tests`. This uploads
the conversation and Codex logs to OpenAI. The returned thread ID can be shared
with OpenAI support.
