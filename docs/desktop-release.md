# Desktop Release

This project currently has a cross-platform desktop release pipeline for macOS and Windows.

## Release Files

- `.github/workflows/desktop-release.yml`: GitHub Actions workflow that validates the release, creates or updates the GitHub Release, builds platform artifacts, and uploads them.
- `apps/desktop/package.json`: `electron-builder` packaging config and desktop release scripts.
- `apps/desktop/.env.release.example`: local template for signing and notarization environment variables.
- `apps/desktop/build/entitlements.mac.plist`: hardened runtime entitlements for the main app.
- `apps/desktop/build/entitlements.mac.inherit.plist`: inherited entitlements for helper processes.

## GitHub Release Flow

GitHub Releases are created and populated by `.github/workflows/desktop-release.yml`.

Trigger tags:

- `v<semver>`

Flow:

1. Check out the repository on `ubuntu-latest`.
2. Derive the release version from the tag.
3. Require a matching `release-notes/<tag>.md` file.
4. Run `npm ci`.
5. Run `npm run typecheck`.
6. Run `npm test`.
7. Validate that `apps/desktop/package.json` already matches the tag-derived version.
8. Create or update the matching GitHub Release using `release-notes/<tag>.md` as the release body.
9. Run the macOS packaging job on `macos-latest`:
   - validate signing and notarization secrets
   - run `npm ci`
   - run `npm run build:app --prefix apps/desktop`
   - upload the generated `.dmg` and macOS `.zip` assets
10. Run the Windows packaging job on `windows-latest`:
   - run `npm ci`
   - run `npm run build:app:unsigned --prefix apps/desktop`
   - upload the generated Windows `.exe` installer

Pre-release tags are inferred from semver prerelease suffixes such as `v0.1.0-beta.1`.
Those releases remain marked as GitHub prereleases, so Nile's in-app auto-update flow only follows stable releases.

Release packaging currently emits separate `arm64` and `x64` macOS artifacts instead of one `universal` app, plus one `x64` Windows NSIS installer. This keeps the macOS downloads smaller and adds native Windows output without introducing a second Windows architecture matrix yet.

## Release Notes Source of Truth

Desktop release notes now live under `release-notes/` and are versioned by tag:

- `release-notes/v<semver>.md`

Examples:

- `release-notes/v0.15.0.md`
- `release-notes/v0.16.0-beta.1.md`

The release workflow fails early if the matching file does not exist. This keeps desktop releases from shipping with auto-generated or empty notes.

Use `release-notes/TEMPLATE.md` as the starting point for a new version note. Keep the content user-facing and scoped to the packaged desktop app.

## Required GitHub Secrets

The workflow accepts either the canonical `NILE_DESKTOP_*` secret names or the matching short names used in `apps/desktop/.env.release`.

| Purpose | Canonical secret | Short-name fallback |
| --- | --- | --- |
| Base64 `.p12` certificate | `NILE_DESKTOP_MAC_CERTIFICATE_P12` | `CSC_LINK` |
| `.p12` export password | `NILE_DESKTOP_MAC_CERTIFICATE_PASSWORD` | `CSC_KEY_PASSWORD` |
| Apple ID email | `NILE_DESKTOP_APPLE_ID` | `APPLE_ID` |
| Apple app-specific password | `NILE_DESKTOP_APPLE_APP_SPECIFIC_PASSWORD` | `APPLE_APP_SPECIFIC_PASSWORD` |
| Apple team ID | `NILE_DESKTOP_APPLE_TEAM_ID` | `APPLE_TEAM_ID` |

For new repositories, prefer the canonical `NILE_DESKTOP_*` names. Existing repositories may keep the short names.

## Recommended Publish Flow

Use a pushed git tag as the normal release entrypoint:

```bash
node -e 'const fs=require("fs");const p="apps/desktop/package.json";const j=JSON.parse(fs.readFileSync(p,"utf8"));j.version="0.1.0";fs.writeFileSync(p,JSON.stringify(j,null,2)+"\n")'
cp release-notes/TEMPLATE.md release-notes/v0.1.0.md
git tag v0.1.0
git push origin v0.1.0
```

The workflow will:

1. Require `release-notes/v0.1.0.md`.
2. Validate that `apps/desktop/package.json` is already `0.1.0`.
3. Run `npm run typecheck`.
4. Run `npm test`.
5. Create or update the matching GitHub Release body from `release-notes/v0.1.0.md`.
6. Build signed `arm64` and `x64` macOS artifacts.
7. Submit both macOS artifacts for notarization.
8. Build the Windows `x64` installer.
9. Upload the generated release assets.

Expected uploaded artifacts:

- `Nile-<version>-arm64.dmg`
- `Nile-<version>-arm64-mac.zip`
- `Nile-<version>.dmg`
- `Nile-<version>-mac.zip`
- `Nile-<version>-win32-x64.exe`

## Manual Workflow Dispatch

`workflow_dispatch` is supported for reruns or manually triggered releases, but it still requires a release tag value in the same format as the tag trigger:

- `v<semver>`

When running the workflow manually, provide the `release_tag` input with that value.

## Desktop Auto-Update

Nile's packaged desktop app now enables Electron's public GitHub Releases updater through `update-electron-app`.

Requirements for the in-app updater to work:

1. Publish a stable GitHub Release from a `v<semver>` tag.
2. Keep the repository public.
3. Upload the signed macOS `.zip` assets alongside the `.dmg` files.
4. Upload the Windows `.exe` installer for packaged Windows clients.

The updater checks for new releases when the packaged app starts and continues polling in the background on Electron's default interval.

Manual update checks also query `https://update.electronjs.org/<owner>/<repo>/<platform>-<arch>/<current-version>` directly and compare the returned release version with the running app version. This prevents false "already up to date" results when Electron's `update-not-available` event races or misfires even though a newer GitHub Release is available.

When the user chooses to install a downloaded update, Nile must quit for real before Squirrel can swap the app bundle. On macOS the settings window normally closes to the menu bar tray instead of exiting, so the install path sets an explicit quitting state, destroys the tray icon, and closes the window before calling `autoUpdater.quitAndInstall()`.

## Local Signed macOS Build

Local signed macOS builds now use the checked-in desktop version from `apps/desktop/package.json`.
Keep that file in sync with the latest intended desktop release version before packaging if you want the built app to report a real version instead of an older one.

Copy the example env file and load it into the shell:

```bash
cp apps/desktop/.env.release.example apps/desktop/.env.release
set -a
source apps/desktop/.env.release
set +a
npm run build:app --prefix apps/desktop
```

## Local Windows Build

Run the unsigned packaging command from a Windows machine:

```bash
npm run build:app:unsigned --prefix apps/desktop
```

Expected output under `apps/desktop/release/`:

- `Nile-<version>-win32-x64.exe`

Windows packaging currently uses the unsigned path and does not require the Apple signing and notarization environment variables from `apps/desktop/.env.release`.

## Local Unsigned Build

```bash
npm run build:app:unsigned --prefix apps/desktop
```

## Mac App Store Build

This repository now has a separate local packaging entrypoint for Mac App Store work:

```bash
npm run build:app:mas --prefix apps/desktop
```

What this does today:

- builds the desktop app with the dedicated `mas` Electron Builder target
- defaults MAS packaging to a `universal` macOS app so App Store Connect validation still supports Intel Macs while keeping Apple Silicon support
- points Electron Builder at `build/icons/icon.icns` for macOS and MAS packaging so the submitted bundle keeps the full ICNS size set, including `512x512@2x`
- accepts an explicit architecture override when you need to debug one variant locally:
  - `node --import tsx ./package-app.ts --mas --x64`
  - `node --import tsx ./package-app.ts --mas --arm64`
  - `node --import tsx ./package-app.ts --mas --universal`
- applies App Sandbox entitlements from:
  - `apps/desktop/build/entitlements.mas.plist`
  - `apps/desktop/build/entitlements.mas.inherit.plist`
- constrains MAS signing to the `Vestin Limited` identity instead of generic macOS auto-discovery
- auto-discovers a local provisioning profile for `io.vestin.nile` from:
  - `~/Library/MobileDevice/Provisioning Profiles`
  - `~/Downloads`
- accepts `NILE_DESKTOP_MAS_PROVISIONING_PROFILE` and `NILE_DESKTOP_MAS_SIGNING_IDENTITY` when you need to override the local defaults
- disables the runtime behaviors that depend on GitHub Releases updates, direct shell profile mutation, or the non-sandbox desktop keychain helper
- stores the desktop SQLite state under Electron `userData` for MAS builds instead of `~/.nile-switcher`

What this does **not** do yet:

- the GitHub Actions desktop release workflow does not build or submit MAS artifacts
- provisioning profiles, App Store signing certificates, and App Store Connect upload credentials are still external Apple-side setup

Practical expectation:

- this command is the engineering readiness path for MAS work, not a one-command publish flow yet
- expect at least one more validation pass with the real provisioning profile, installer-signing setup, and Apple submission tooling before first submission

## Mac App Store TestFlight Upload

This repository now includes a separate GitHub Actions workflow for Mac App Store TestFlight uploads:

- `.github/workflows/desktop-mas-release.yml`

What it does:

- validates the release tag and desktop package version
- imports Mac App Store signing assets into a temporary CI keychain
- installs the Mac App Store provisioning profile on the runner
- runs `npm run build:app:mas --prefix apps/desktop`
- validates the resulting `.pkg` with App Store Connect using `xcrun altool`
- uploads the `.pkg` to App Store Connect using `xcrun altool`

What it does **not** do yet:

- it does not automate App Review submission
- it does not auto-release the version after approval
- it does not verify that every screenshot, questionnaire answer, and regional metadata field is ready for production submission

Trigger model:

- `workflow_dispatch` is the only trigger
- `release_tag` picks the desktop version to build

Recommended GitHub environment:

- create an environment named `mac-app-store`
- store the MAS upload secrets there so first-time rollout can use environment approvals before the upload job runs

Required GitHub secrets for MAS upload:

| Purpose | Secret |
| --- | --- |
| Base64 `.p12` for `3rd Party Mac Developer Application` | `NILE_DESKTOP_MAS_APP_CERTIFICATE_P12` |
| Export password for the MAS application `.p12` | `NILE_DESKTOP_MAS_APP_CERTIFICATE_PASSWORD` |
| Base64 `.p12` for `3rd Party Mac Developer Installer` | `NILE_DESKTOP_MAS_INSTALLER_CERTIFICATE_P12` |
| Export password for the MAS installer `.p12` | `NILE_DESKTOP_MAS_INSTALLER_CERTIFICATE_PASSWORD` |
| Base64 provisioning profile content | `NILE_DESKTOP_MAS_PROVISIONING_PROFILE_BASE64` |
| App Store Connect Apple ID | `NILE_DESKTOP_APPLE_ID` or `APPLE_ID` |
| App-specific password for the Apple ID | `NILE_DESKTOP_APPLE_APP_SPECIFIC_PASSWORD` or `APPLE_APP_SPECIFIC_PASSWORD` |

Optional GitHub variable or secret:

| Purpose | Name |
| --- | --- |
| Override App Store Connect provider when the Apple ID sees multiple providers | `NILE_DESKTOP_MAS_ASC_PROVIDER` |

Practical setup notes:

- the certificate and provisioning-profile secrets should contain raw file bytes encoded with `base64`
- the workflow intentionally stays separate from the existing GitHub Release workflow so MAS setup can be rolled out without risking the current Developer ID release path
- after upload, the build should appear under App Store Connect / TestFlight processing for the macOS app record
