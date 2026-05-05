# Desktop Release

This project currently has a macOS desktop release pipeline.

## Release Files

- `.github/workflows/desktop-release.yml`: GitHub Actions workflow that validates secrets, runs verification, builds the signed desktop app, and uploads artifacts to GitHub Releases.
- `apps/desktop/package.json`: `electron-builder` packaging config and desktop release scripts.
- `apps/desktop/.env.release.example`: local template for signing and notarization environment variables.
- `apps/desktop/build/entitlements.mac.plist`: hardened runtime entitlements for the main app.
- `apps/desktop/build/entitlements.mac.inherit.plist`: inherited entitlements for helper processes.

## GitHub Release Flow

GitHub Releases are created and populated by `.github/workflows/desktop-release.yml`.

Trigger tags:

- `v<semver>`

Flow:

1. Check out the repository on `macos-latest`.
2. Load signing and notarization secrets from GitHub Actions secrets.
3. Validate that all required secrets are present.
4. Derive the release version from the tag.
5. Require a matching `release-notes/<tag>.md` file.
6. Run `npm ci`.
7. Run `npm run typecheck`.
8. Run `npm test`.
9. Stamp `apps/desktop/package.json` with the tag-derived version.
10. Run `npm run build:app --prefix apps/desktop` to produce signed desktop artifacts.
11. Find the generated `dmg` and `zip` files under `apps/desktop/release/`.
12. Create or update the matching GitHub Release using `release-notes/<tag>.md` as the release body.
13. Upload the artifacts to that GitHub Release with `gh release upload --clobber`.

Pre-release tags are inferred from semver prerelease suffixes such as `v0.1.0-beta.1`.
Those releases remain marked as GitHub prereleases, so Nile's in-app auto-update flow only follows stable releases.

Release packaging currently emits separate `arm64` and `x64` macOS artifacts by default instead of one `universal` app. This keeps each downloadable artifact materially smaller and avoids shipping both architectures inside the same bundle.

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
cp release-notes/TEMPLATE.md release-notes/v0.1.0.md
git tag v0.1.0
git push origin v0.1.0
```

The workflow will:

1. Require `release-notes/v0.1.0.md`.
2. Validate secrets.
3. Run `npm run typecheck`.
4. Run `npm test`.
5. Build signed `arm64` and `x64` desktop artifacts.
6. Submit both artifacts for notarization.
7. Create or update the matching GitHub Release body from `release-notes/v0.1.0.md`.
8. Upload the generated `dmg` and `zip` files.

Expected uploaded artifacts:

- `Nile-<version>-arm64.dmg`
- `Nile-<version>-arm64-mac.zip`
- `Nile-<version>.dmg`
- `Nile-<version>-mac.zip`

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

The updater checks for new releases when the packaged app starts and continues polling in the background on Electron's default interval.

## Local Signed Build

Copy the example env file and load it into the shell:

```bash
cp apps/desktop/.env.release.example apps/desktop/.env.release
set -a
source apps/desktop/.env.release
set +a
npm run build:app --prefix apps/desktop
```

## Local Unsigned Build

```bash
npm run build:app:unsigned --prefix apps/desktop
```
