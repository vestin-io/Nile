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
