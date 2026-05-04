# Nile

<p align="center">
  <img src="./assets/icons/nile-mark.svg" alt="Nile mark" width="160" />
</p>

**Nile** is named for flow, convergence, and movement.  
Like a great river gathering many branches into a single current, it brings different AI connections into one place, so switching becomes natural, clear, and effortless.

The name also reflects a deeper ambition.  
The Nile was one of the great rivers at the beginning of civilization. In that spirit, Nile is meant to feel less like a utility and more like infrastructure: a main channel connecting models, endpoints, and the ways people work with AI.

> Fun fact: the Nile mark is inspired by N035A, an ancient Egyptian water sign. That reference felt right for this project. Just as the Nile sustained one of the world’s earliest civilizations, we believe AI is becoming a foundational resource for a new one. Nile is designed as a channel into that emerging landscape — helping people access, switch between, and work across AI connections with greater flow and continuity.

## What It Is

Nile is a local switcher for AI agents and connections.

Canonical project terms live in [GLOSSARY.md](./GLOSSARY.md).

The current MVP is still Codex-led, but it now also covers Claude and Cursor connection flows. It focuses on:

- managing connections across supported endpoint presets
- storing secrets in macOS Keychain
- applying selected connections to local agent state
- exposing a CLI surface
- exposing a desktop surface for setup, switching, and usage-aware flows

## Current MVP Scope

Supported endpoint presets in the current MVP:

- `openai`
- `gateway`
- `azure-openai`
- `anthropic`

Supported auth modes in the current MVP:

- `api_key`
- `openai_session`
- `claude_session`
- `cursor_session`

Supported agents in the current MVP:

- `codex`
- `claude`
- `cursor`

Current platform support:

- macOS only

## Local Development

Install dependencies:

```bash
npm install
```

Run typecheck:

```bash
npm run typecheck
```

Run tests:

```bash
npm test
```

Run the CLI locally:

```bash
npm start
```

Build the desktop app shell:

```bash
npm run desktop:build
```

Start the desktop app locally:

```bash
npm run desktop:start
```

Package the desktop app locally without signing:

```bash
npm run build:app:unsigned --prefix apps/desktop
```

For the signed macOS desktop release flow, see [docs/desktop-release.md](./docs/desktop-release.md).

## CLI

Current commands:

```bash
nile
nile status [--json]
nile list [--json]
nile add [--preset <preset>] [--auth-mode <mode>] [--id <id>] [--label <label>] [--endpoint-url <url>] [--login] [--api-key <key>] [--from-codex-current]
nile import
nile history [--json]
nile rollback
nile use <connectionId>
nile remove <connectionId>
nile reset
nile cursor usage auto-bind <connectionId>
```

Optional local overrides:

```bash
nile status --db-path <path> --home codex=<path>
```

`nile status`, `nile list`, and `nile history` are human-readable by default. Use `--json` for structured output.

## Repository Layout

- `assets/icons`: shared brand/source icon assets used by docs and desktop build exports
- `packages/core`: shared models, services, and agent-specific apply logic
- `packages/host-local`: host-specific local integrations such as browser session probes
- `apps/cli`: CLI surface
- `apps/desktop`: Electron menubar + settings shell
- `.vestin`: discovery, architecture, spec, and execution records
- `docs`: research notes and supporting investigation
- `research`: read-only reference repositories and notes

## Icon Assets

- `assets/icons/nile-mark.svg`: the source SVG used in repository docs and as the desktop icon source asset
- `apps/desktop/build/icons`: desktop-only exported assets such as tray template PNGs and packaged app icons

The menubar icon and the packaged app icon should not reuse the same final file. Keep the SVG as the shared source, then export:

- `nileTemplate.png` and `nileTemplate@2x.png` for the macOS menubar/tray icon
- `icon.icns` for the packaged macOS app icon

## Release Status

Nile is still in active MVP development, but the macOS desktop release path now exists:

- local unsigned packaging via `npm run build:app:unsigned --prefix apps/desktop`
- signed and notarized desktop release automation via GitHub Actions tags
- GitHub Release asset upload for macOS `dmg` and `zip` artifacts

The standard publish path is pushing a `v<semver>` or `desktop-v<semver>` tag. See [docs/desktop-release.md](./docs/desktop-release.md) for required secrets, manual workflow dispatch, and release asset details.

Current release limits:

- macOS only
- desktop release packaging only
- Windows and Linux credential backends are still out of scope

## License

MIT. See [LICENSE](./LICENSE).
