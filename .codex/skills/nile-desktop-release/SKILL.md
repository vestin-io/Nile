---
name: nile-desktop-release
description: Use when working on Nile desktop release tasks such as signed macOS packaging, notarization, GitHub release workflow checks, release tags, or desktop release readiness. Applies to local signed-build verification, GitHub Actions secret checks, tag-driven publishing, and release artifact validation.
---

# Nile Desktop Release

Use this skill for Nile desktop release work only.

## Scope

- Signed macOS desktop packaging
- Notarization troubleshooting
- GitHub Actions desktop release workflow changes
- Release tag creation and publish readiness checks
- GitHub Release asset validation

## Primary Files

- `.github/workflows/desktop-release.yml`
- `docs/desktop-release.md`
- `apps/desktop/package.json`
- `apps/desktop/.env.release.example`
- `.vestin/plans/desktop-v2/build.md`

## Required Checks

1. Confirm whether the user wants:
   - a local signed build check
   - a GitHub Actions release
   - both
2. Check `git status --short --branch` before tagging.
3. Do not create a release tag from a dirty worktree unless the user explicitly wants the tag to point at the current committed HEAD anyway.
4. For signed builds, confirm the signing identity resolves to `Developer ID Application`, not `Apple Development`.

## Secret Mapping

The workflow accepts either canonical GitHub secret names or short-name fallbacks:

- `NILE_DESKTOP_MAC_CERTIFICATE_P12` or `CSC_LINK`
- `NILE_DESKTOP_MAC_CERTIFICATE_PASSWORD` or `CSC_KEY_PASSWORD`
- `NILE_DESKTOP_APPLE_ID` or `APPLE_ID`
- `NILE_DESKTOP_APPLE_APP_SPECIFIC_PASSWORD` or `APPLE_APP_SPECIFIC_PASSWORD`
- `NILE_DESKTOP_APPLE_TEAM_ID` or `APPLE_TEAM_ID`

## Standard Flow

1. Review `docs/desktop-release.md` and the workflow together.
2. Verify the worktree state.
3. If the task is local verification, load `apps/desktop/.env.release` and run:

```bash
set -a
source apps/desktop/.env.release
set +a
npm run build:app --prefix apps/desktop
```

4. If the task is a GitHub release, prefer a pushed tag:

```bash
git tag v0.1.0
git push origin v0.1.0
```

5. Confirm the workflow completes:
   - `npm run typecheck`
   - `npm test`
   - notarization for `arm64`
   - notarization for `x64`
   - upload of `dmg` and `zip` artifacts

## Manual Dispatch

`workflow_dispatch` is valid only when the `release_tag` input is provided in one of these formats:

- `v<semver>`

## Expected Artifacts

- `Nile-<version>-arm64.dmg`
- `Nile-<version>-arm64-mac.zip`
- `Nile-<version>.dmg`
- `Nile-<version>-mac.zip`

## Failure Patterns

- Missing secrets: the `Validate signing secrets` step fails early.
- Wrong certificate type: notarization fails with "not signed with a valid Developer ID certificate."
- Dirty worktree before tag: the release tag does not include the intended changes.
