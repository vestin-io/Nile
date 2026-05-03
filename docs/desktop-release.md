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
- `desktop-v<semver>`

Flow:

1. Check out the repository on `macos-latest`.
2. Load signing and notarization secrets from GitHub Actions secrets.
3. Validate that all required secrets are present.
4. Derive the release version from the tag.
5. Run `npm ci`.
6. Run `npm run typecheck`.
7. Run `npm test`.
8. Stamp `apps/desktop/package.json` with the tag-derived version.
9. Run `npm run build:app --prefix apps/desktop` to produce signed desktop artifacts.
10. Find the generated `dmg` and `zip` files under `apps/desktop/release/`.
11. Create the matching GitHub Release if it does not already exist.
12. Upload the artifacts to that GitHub Release with `gh release upload --clobber`.

Pre-release tags are inferred from semver prerelease suffixes such as `v0.1.0-beta.1`.

Release packaging currently emits separate `arm64` and `x64` macOS artifacts by default instead of one `universal` app. This keeps each downloadable artifact materially smaller and avoids shipping both architectures inside the same bundle.

## Required GitHub Secrets

- `NILE_DESKTOP_MAC_CERTIFICATE_P12`
- `NILE_DESKTOP_MAC_CERTIFICATE_PASSWORD`
- `NILE_DESKTOP_APPLE_ID`
- `NILE_DESKTOP_APPLE_APP_SPECIFIC_PASSWORD`
- `NILE_DESKTOP_APPLE_TEAM_ID`

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
