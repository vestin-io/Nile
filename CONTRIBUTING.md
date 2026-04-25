# Contributing

## Principles

Nile is being built as a focused, minimal system.

Please keep changes aligned with these principles:

- prefer clarity over cleverness
- avoid overdesign
- keep data shapes minimal
- use class-oriented design
- prefer composition over inheritance
- do not introduce abstractions before they are justified by repeated use

## Project Structure

- `packages/core`: shared models, services, and agent-specific apply logic
- `apps/cli`: CLI surface
- `apps/desktop`: desktop surface controller
- `.vestin`: product, architecture, spec, and execution records
- `docs`: research and supporting notes

## Development Setup

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

## Workflow

Before making substantial changes:

- check `.vestin/specs/spec.json`
- check the relevant feature spec under `.vestin/specs/`
- check the relevant milestone plan under `.vestin/plans/`

When finishing a feature:

- keep implementation aligned with the current spec
- update the related build notes under `.vestin/plans/.../build.md` if the implementation meaningfully changes
- keep verification notes in sync when verification scope changes

## Coding Rules

Use [AGENTS.md](./AGENTS.md) as the working engineering guide.

Important rules:

- keep files reasonably small; avoid files growing past 500 lines
- keep one file focused on one responsibility
- do not store raw secrets in SQLite
- do not log secrets, tokens, API keys, or full auth payloads
- prefer boundary-level `index.ts` files only
- do not add broad base classes or framework-style abstractions without clear need

## Testing

Every meaningful change should keep these passing:

```bash
npm run typecheck
npm test
```

If you change provider/binding/connection/apply behavior, add or update tests close to the affected code.

## Scope Discipline

MVP scope is intentionally narrow.

Do not expand scope casually into:

- multi-platform credential backends
- profile composition
- project binding
- release packaging
- extra provider discovery systems

If a change pushes the boundary, update `.vestin` first.
