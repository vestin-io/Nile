# Desktop Release Notes

Each desktop release tag must have a matching release note file:

- `release-notes/v<semver>.md`

Examples:

- `release-notes/v0.15.0.md`
- `release-notes/v0.16.0-beta.1.md`

The desktop release workflow treats that file as the source of truth for the GitHub Release body.
If the file is missing, the release job fails before packaging.

Use `TEMPLATE.md` as the starting point for a new release note.
