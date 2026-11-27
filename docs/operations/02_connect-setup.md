# Kairo Connect setup

Deployment and client configuration for Kairo Connect. See [Kairo Connect](../internals/06_t3-connect.md) for trust boundaries and [infra/relay/README.md](../../infra/relay/README.md#deployment) for relay provisioning.

## Public application configuration

Kairo Connect is disabled in a fresh clone. Copy `.env.example` to `.env` for production, or set these public identifiers in `.env` / `.env.local` (process env > `.env.local` > `.env`):

```dotenv
KAIRO_CLERK_PUBLISHABLE_KEY=<publishable key>
KAIRO_CLERK_JWT_TEMPLATE=<JWT template name>
KAIRO_CLERK_CLI_OAUTH_CLIENT_ID=<public OAuth application client ID>
KAIRO_RELAY_URL=https://relay.example.com
```

`CLERK_SECRET_KEY` belongs only in relay secrets, never in client config. Client and bundled-server builds embed these values at build time; EAS preview/production environments need the publishable key, JWT template, and relay URL.

## Clerk setup

### CLI OAuth application

Create a public OAuth application in Clerk (authorization code + PKCE):

1. Redirect URI: `http://127.0.0.1:34338/callback`
2. Scopes: `openid`, `profile`, `email`, `offline_access`
3. Enable **Device authorization grant** (required for headless/SSH login; Clerk enables it per account on request).
4. Set `KAIRO_CLERK_CLI_OAUTH_CLIENT_ID` to its public client ID.

### JWT template

Create a Clerk JWT template named `kairo-relay` with `{ "aud": "kairo-code-relay" }`. Set `KAIRO_CLERK_JWT_TEMPLATE=kairo-relay` on clients and `CLERK_JWT_AUDIENCE=kairo-code-relay` on the relay.

### Desktop OAuth redirects

Enable Clerk's Native API, add `kairo-dev://app/` and `kairo://app/` to the SSO redirect allowlist, and add `kairo-dev://app` and `kairo://app` to `allowed_origins` via `PATCH https://api.clerk.com/v1/instance` (preserving existing entries).

### Android native sign-in redirects

In Clerk **Native applications > Allowlist for mobile SSO redirect**, allow each variant's callback:

| Variant     | Callback                                      |
| ----------- | --------------------------------------------- |
| Development | `clerk://com.kairo.app.dev.callback`     |
| Preview     | `clerk://com.kairo.app.preview.callback` |
| Production  | `clerk://com.kairo.app.callback`         |

### Restricting sign-ups

Use Clerk's allowlist or Restricted mode for new sign-ups (an enabled empty allowlist blocks all sign-ups). Ban the account in Clerk to revoke existing sessions.

### Account deletion webhook

Under Clerk **Webhooks**, add an endpoint at `https://<relay domain>/v1/webhooks/clerk` subscribed to `user.deleted`, and set its signing secret as `CLERK_WEBHOOK_SIGNING_SECRET` on the relay. Deleting a user in Clerk then records the deletion, and the relay's five-minute cron tears down their managed tunnels and deletes their relay rows, retrying until a pass succeeds after the user's relay tokens have expired. Each deletion is a row in `relay_account_deletions`: pending while `completed_at` is null (`attempts` climbing means it keeps failing), then kept as the record of which account was deleted and when. Before restoring the relay database from a backup, export `relay_account_deletions`: the backup may predate some requests. After the restore, insert the exported rows that are missing, then set `completed_at` back to null on every row so the restored data is deleted again. Without the secret the route answers 404.

## Android FCM push setup

The relay sends Android push notifications directly via FCM HTTP v1 (no Expo Push account required):

1. Register each Android package (`com.kairo.app.{dev,preview}` / `com.kairo.app`) in Firebase and download `google-services.json`.
2. Pass `KAIRO_ANDROID_GOOGLE_SERVICES_FILE=/abs/path/google-services.json` when prebuilding/building locally or as an EAS file variable (available to fingerprint generation as well).
3. Enable the FCM API and store the Firebase service-account JSON only in the relay's `FCM_SERVICE_ACCOUNT` secret (never in EAS app env or the repo). Set `APNS_ENABLED=false` for an Android-only relay stage.
4. For local smoke/watch verification without deploying a relay, use `vp run push:android:smoke` and `vp run push:android:watch` from `infra/relay`.

## Desktop passkeys

For a signed macOS build (`com.kairo.app`):

1. Create an explicit macOS App ID with **Associated Domains** and a matching distribution provisioning profile.
2. In Clerk Native API settings, add an iOS app with the same Apple Team ID and bundle ID, and verify `https://<frontend-api>/.well-known/apple-app-site-association` includes `<TEAM_ID>.com.kairo.app`.
3. Configure signing per [Apple signing and notarization](./03_release.md#apple-signing-and-notarization-macos). Local signed builds use `KAIRO_APPLE_TEAM_ID`, `KAIRO_MACOS_PROVISIONING_PROFILE`, and optionally `KAIRO_CLERK_PASSKEY_RP_DOMAINS`. Bump the build version after changing Associated Domains so macOS refreshes cached Shared Web Credentials.

Unsigned `dev:desktop` cannot exercise passkeys. For renderer HMR with passkeys, launch an installed signed build against `vp run dev:web`:

```sh
VITE_DEV_SERVER_URL=http://127.0.0.1:5733 KAIRO_PORT=13773 \
  "/Applications/Kairo (Alpha).app/Contents/MacOS/Kairo (Alpha)"
```
