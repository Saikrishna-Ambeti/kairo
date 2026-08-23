# App integrations

Kairo gives coding agents managed app tools through Composio. You do not need a Composio account,
API key, CLI, or local runtime.

Sign in to Kairo, open **Settings → Integrations**, choose provider instances, then select **Enable
Composio**. New provider sessions get the tools. Existing sessions keep the tools they started with.

When an agent needs Gmail, GitHub, Slack, or another authenticated app, it returns a secure sign-in
link. Open that link and approve access. Composio stores the app connection for your Kairo account.
Another Kairo user cannot use it.

Kairo Cloud creates each Composio session and keeps the Composio project key on the cloud server.
The Kairo host stores only scoped Kairo grants. Coding-agent processes cannot use those grants to
read or write Supermemory.

If Settings reports that the service is unavailable, confirm that you are signed in and try again.
App integrations work over local, direct, Tailscale, and Kairo Connect connections.
