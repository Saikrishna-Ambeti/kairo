# Release Runbook

Unified release workflow: `.github/workflows/release.yml`. Beta is a product label, not a release channel—channels remain `stable` and `nightly` (plus `preview` for maintainer test builds).

## Channels and triggers

- **Stable (`channel=stable` on `main`, or pushing a `vX.Y.Z` tag):** Manual dispatch promotes the **latest published nightly commit** (not `main` HEAD) using its base version unless overridden. Pushing a `vX.Y.Z` tag ships that exact commit. Finalization commits version bumps to `main` using `RELEASE_APP_ID` / `RELEASE_APP_PRIVATE_KEY`.
- **Nightly (scheduled every 30 min when new commits exist and >=6 h elapsed, or manual `channel=nightly` on `main`):** Publishes a GitHub prerelease, `nightly` desktop updater channel, `nightly` npm dist-tag, hosted `nightly` web alias, and marketing site. Does not bump versions on `main`.
  - Pause/resume automatic nightlies: `gh variable set PAUSE_NIGHTLY -b true -R pingdotgg/kairo` / `gh variable delete PAUSE_NIGHTLY -R pingdotgg/kairo`.
- **Preview (`channel=preview`, any branch—default dispatch channel):** Exercises build, signing, notarization, and smoke tests into a **draft** GitHub release and skips npm, web, AUR, and announcements. **Never publish a preview draft or push a test tag**—there is no dry-run tag path (any non-nightly `v*` tag publishes stable), and published preview tags hide nightlies from the update feed. Rebase onto `main` before dispatching `preview`.
- **PR macOS previews:** Applying the `preview:mac` label triggers a two-workflow split (`desktop-macos-preview.yml` builds the untrusted JS bundle; `desktop-macos-preview-publish.yml` checks author trust against `main`'s `.github/VOUCHED.td`, packages/signs using `main`, and publishes to rolling `desktop-preview`). One-shot per commit; label is removed automatically.

## Critical release invariants

- **Server self-update ordering:** Connected servers update to the exact client version by downloading the GitHub Release CLI archive (or `npx kairo@<version>`). Keep the release graph order strictly: `release` (CLI archives + `SHA256SUMS` + desktop installers) → `publish_cli` (`t3` npm launcher) → `deploy_web` (hosted channel alias). Never publish clients before the archives and npm launcher exist.
- **Standalone CLI archives & Node pin:** `engines.node` in root `package.json` must stay exact (Node SEA builds reject mismatches). There is no macOS x64 CLI archive (SEA is unsupported there; x64 desktop uses Electron).
- **Smoke fixture:** `scripts/fixtures/desktop-launch` is intentionally an old SQLite snapshot to verify forward migrations on packaged builds—never regenerate it on schema changes.
- **Hosted web & marketing:** Vercel Git auto-deployments stay disabled (`apps/{web,marketing}/vercel.ts`). Releases build with `--skip-domain` and alias `app.kairo.codes` / `latest.app.kairo.codes` (stable) or `nightly.app.kairo.codes` + marketing (nightly) only after publication.

## Update feed

Nightly installs check `releases.atom` (the 10 newest git tags), then the `update-feed` release's `nightly.json` pointer, then the GitHub API as fallback. **Never delete the `update-feed` release.**

- If `Check the update feed` fails because stray/preview tags pushed the newest nightly out of `releases.atom`, delete the unneeded tags (`git push origin :refs/tags/<tag>`—converting a release to draft keeps its tag).
- **To pull a bad nightly:** delete its release and tag, run `gh release delete-asset update-feed nightly.json` (so installs fall back until the next tick rewrites it), and move npm's `nightly` dist-tag back with `npm dist-tag add t3@<last-good> nightly`.

## Kairo Connect relay deployment

`.github/workflows/deploy-relay.yml` deploys Alchemy stage `prod` on every push to `main`. See [infra/relay/README.md](../../infra/relay/README.md#deployment-ci) for required variables/secrets. Keep `.env.example` in sync with `production` public identifiers so preview builds work off non-`main` branches. After editing a secret/variable, manually run **Deploy Kairo Connect relay** (with `force` unchecked).

Labeling a same-repo PR `relay:preview` deploys stage `pr-<number>` (cleaned up on unlabel/close).

### Managed tunnel cleanup rollout

`RELAY_TUNNEL_CLEANUP_MODE` and `RELAY_LEGACY_TUNNEL_CLEANUP_MODE` accept `off` (default), `dry-run`, or `enabled` and take effect on the next relay deploy (without `force`). Monitor `relay.managed_endpoint_reaper.sweep` spans in Axiom. To stop cleanup during an incident, set the mode to `off` and redeploy the relay.

## Mobile releases

- **iOS TestFlight / App Store:** Merges to `main` publish compatible OTAs and build TestFlight prereleases (`testflight` profile at `3.0.0`). To cut an App Store build, dispatch **Mobile EAS Production** (`mode=build`, `profile=production`, `platform=ios`, explicit version). Before shipping `3.0.0` to the App Store, advance `build.testflight.env.KAIRO_MOBILE_VERSION` in `apps/mobile/eas.json` to the next unreleased major.
- **Android APK mirror:** `.github/workflows/mobile-android-apk.yml` polls Google Play Alpha hourly and mirrors new Play-signed universal APKs to `android-beta-<build-number>` prereleases (`GOOGLE_PLAY_SERVICE_ACCOUNT_JSON`). Nightlies attach the latest internal-testing APK when available.

## Windows payload topology and update validation

Windows packages the bundled server and its unpacked native modules in `resources/server.asar` (+ `server.asar.unpacked`) and embeds the matching-architecture Linux CLI archive as `resources/wsl-runtime.tar.gz` + SHA-256 sidecar (passed via `--wsl-runtime`). Avoid whole-package smart unpacking (keeps unpacked file counts and NSIS differential blockmaps bounded). `scripts/build-desktop-artifact.ts` enforces all structural, native-load, and WSL archive checks at build time.

## One-time credentials setup

### npm OIDC trusted publishing

Configure `t3` on npm with GitHub Actions Trusted Publishing for `.github/workflows/release.yml` (the workflow publishes only the `t3` launcher tarball via `npm publish --provenance`). Set the publisher's environment to `production`, which `publish_cli` declares.

### Apple signing and notarization (macOS)

- **Secrets:** `CSC_LINK` (base64 `.p12`), `CSC_KEY_PASSWORD`, `APPLE_API_KEY` (raw `.p8`), `APPLE_API_KEY_ID`, `APPLE_API_ISSUER`, `MACOS_PROVISIONING_PROFILE` (base64 profile for `com.kairo.app` with Associated Domains).
- **Variables:** `APPLE_TEAM_ID`, optional `CLERK_PASSKEY_RP_DOMAINS`.
- The packager only enables passkey entitlements (`keychain-access-groups`, `com.apple.developer.web-browser.public-key-credential`) present in the provisioning profile; regenerate and re-upload `MACOS_PROVISIONING_PROFILE` after Apple approves managed capabilities. Complete Clerk AASA setup per [Connect setup](./02_connect-setup.md#desktop-passkeys).

### Private macOS builds

Use a dedicated self-signed code-signing identity for private distribution. Keep the same identity for subsequent builds until you rotate it. The DMG includes `Install Kairo Signing Certificate.pkg`, which grants Code Signing trust to the public certificate on the recipient's Mac.

Generate the identity outside the checkout with OpenSSL. It prompts for a passphrase for the private key and a password for the PKCS#12 export.

```sh
umask 077
mkdir -p "$HOME/.kairo-signing"
cd "$HOME/.kairo-signing"

openssl req -x509 -newkey rsa:3072 -sha256 -days 365 \
  -subj '/CN=Kairo Private Code Signing' \
  -addext 'basicConstraints=critical,CA:FALSE' \
  -addext 'keyUsage=critical,digitalSignature' \
  -addext 'extendedKeyUsage=codeSigning' \
  -keyout Kairo-signing.key -out Kairo-signing.pem

openssl pkcs12 -export -inkey Kairo-signing.key -in Kairo-signing.pem \
  -name 'Kairo Private Code Signing' \
  -keypbe PBE-SHA1-3DES -certpbe PBE-SHA1-3DES -macalg sha1 \
  -out Kairo-signing.p12

openssl x509 -in Kairo-signing.pem -outform der -out Kairo-signing.cer
openssl x509 -in Kairo-signing.pem -noout -sha256 -fingerprint
```

Back up the private key, the `.p12`, and their passwords securely. Share the public certificate fingerprint alongside the DMG. The PKCS#12 export uses the algorithms required by macOS Keychain import.

For GitHub Actions, set `KAIRO_PRIVATE_MACOS_P12` to the base64-encoded `.p12` and `KAIRO_PRIVATE_MACOS_P12_PASSWORD` to its export password. Run **Build Kairo private macOS DMG** on `main`, select `x64` for Intel or `arm64` for Apple Silicon, and download the workflow artifact.

```sh
base64 -i "$HOME/.kairo-signing/Kairo-signing.p12" | gh secret set KAIRO_PRIVATE_MACOS_P12
gh secret set KAIRO_PRIVATE_MACOS_P12_PASSWORD
```

For a local build, import the `.p12` into your login keychain and set the certificate's **Code Signing** trust in Keychain Access. Check that `security find-identity -v -p codesigning` lists it. Then build from the checkout with Xcode 26 or newer.

```sh
vp run dist:desktop:dmg:x64 --private-signing-cert "$HOME/.kairo-signing/Kairo-signing.cer" \
  --output-dir release/private
```

Recipients run the certificate installer as an administrator, then drag Kairo to Applications. Private builds have no Apple notarization. If macOS blocks the package or app, approve that item under **System Settings → Privacy & Security → Open Anyway** after checking the download source. An administrator can remove the certificate from the System keychain in Keychain Access. Private builds are distributed as new DMGs and carry no automatic update feed or Apple-managed passkey entitlements.

### Azure Trusted Signing (Windows)

Set secrets `AZURE_TENANT_ID`, `AZURE_CLIENT_ID`, `AZURE_CLIENT_SECRET`, `AZURE_TRUSTED_SIGNING_ENDPOINT`, `AZURE_TRUSTED_SIGNING_ACCOUNT_NAME`, `AZURE_TRUSTED_SIGNING_CERTIFICATE_PROFILE_NAME`, and `AZURE_TRUSTED_SIGNING_PUBLISHER_NAME` with an Entra service principal granted Trusted Signing permissions.

## Ongoing stable release checklist

1. Verify the latest nightly (desktop launch, `npm view t3@<version> version`, remote server update + DB migration smoke test).
2. Dispatch **Release** on `main` with `channel=stable` (leave `version` blank unless overriding the nightly's base version).
3. Confirm `Resolve release commit` matches the verified nightly, then verify `release` → `publish_cli` → `deploy_web` all succeed.
4. Smoke-test the published artifacts.
