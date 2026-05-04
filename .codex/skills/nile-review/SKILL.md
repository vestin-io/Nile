---
name: nile-review
description: Use when reviewing code, release readiness, workflow changes, or implementation quality in the Nile repository. Applies to code review, pre-release checks, regression hunting, test coverage checks, and documentation-to-implementation consistency review.
---

# Nile Review

Use this skill for review work in the Nile repository.

## Review Priorities

1. Bugs and regressions
2. Release risks
3. Missing tests or weak verification
4. Documentation and workflow drift
5. Violations of repository architecture rules from `AGENTS.md`

## Required Context

Read only what is needed:

- `AGENTS.md`
- relevant deeper `AGENTS.md` files for touched areas
- `.vestin/specs/` only if feature scope is unclear
- `.vestin/plans/.../build.md` for recent implementation intent

## Expected Output Style

- Findings first
- Ordered by severity
- Include file references
- Keep summary brief
- If no findings exist, state that explicitly and mention residual risk

## Typical Checks

### Code Review

- `git diff --stat`
- `git diff`
- targeted reads with `rg`, `sed`, or `nl`
- verify tests cover observable behavior

### Release Review

- inspect `.github/workflows/desktop-release.yml`
- inspect `docs/desktop-release.md`
- inspect `apps/desktop/package.json`
- confirm secret naming, tag format, asset naming, and notarization path agree

### Verification Review

- prefer `npm run typecheck`
- prefer the narrowest relevant test command first
- mention if verification was not run

## Nile-Specific Risks

- tagging a release while the worktree is dirty
- signing with `Apple Development` instead of `Developer ID Application`
- docs that describe one set of secret names while the workflow reads another
- desktop packaging drift between README, release docs, and workflow behavior

