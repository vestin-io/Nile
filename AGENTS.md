# Nile Agent Guide

This file defines the working rules for code changes in this repository.

## Scope

- This `AGENTS.md` applies to the whole repository unless a deeper `AGENTS.md` overrides it.
- `.vestin/` is the current source of truth for product scope, module boundaries, and feature order.
- `research/` contains reference repositories and notes. Treat it as read-only unless the user explicitly asks to edit research material.

## Repository Shape

- `packages/` holds shared implementation packages.
- `apps/` holds user-facing surfaces such as CLI and desktop.
- `.vestin/specs/` defines stable feature scope.
- `.vestin/plans/` defines execution order and build logs.

## Architecture Rules

- Keep one responsibility per file. If a file starts mixing storage, domain rules, and UI/process integration, split it.
- Hard limit: a source file should stay under 500 lines. Split earlier when readability drops.
- Default to class-oriented design. Avoid function-oriented or functional-programming-heavy module structure.
- Prefer cohesive classes with clear responsibilities over loose groups of exported helper functions.
- Prefer composition over inheritance. Use inheritance only when the subtype relationship is real and stable.
- Keep inheritance shallow. Avoid deep class hierarchies.
- When behavior belongs to one domain concept, make it a method on that class instead of a free utility function.
- Design the minimum shape needed for the current feature. Do not add future-facing properties, interfaces, or extension points unless they are used now.
- If a field, type, or abstraction is not exercised by the current spec or implementation, do not add it yet.
- Keep `core` free of UI concerns.
- Keep Electron-specific code out of shared core packages.
- Keep provider/account persistence separate from agent apply logic.
- UI surfaces may trigger apply flows, but they must not own provider/account mutation rules.
- Secrets must not be written into SQLite, docs, logs, or test fixtures. Store only references and non-sensitive metadata outside the credential store.
- Do not introduce implicit switching behavior. Applying a new agent selection must stay an explicit user action.
- When adding or changing an agent, connection family, auth mode, session source, or saved-state shape, always account for upgrade paths from older released versions. Existing SQLite rows, keychain entries, config files, and renderer/main IPC payloads must either continue to load safely, migrate explicitly, or fail with a user-recoverable path. Do not assume a clean install or freshly reset local state.
- Workspace packages must form an acyclic dependency graph at the `package.json` level. Type-only imports through narrow subpaths do not justify a runtime dependency edge. Treat any cycle as a defect.
- Plugin packages (`packages/agents/*`, `packages/connections`, future runtime packages) depend on `@nile/core` for contracts. They must not depend on each other. If two plugin packages need to share behavior, the shared piece belongs in `@nile/core` or in a separate utility package.

## Registry & Plugin Ownership Rules

- Plugin identifier unions (agent ids, connection family ids, session source ids, auth modes) must be derived from manifest declarations, not maintained as hand-written union literals. If derivation would introduce a cycle, isolate the declaration metadata in a non-runtime file (see `packages/core/src/models/agent/registry/Declarations.ts`).
- Per-id data tables (default homes, icon resolvers, projection shapes, behavior maps) belong to the plugin package, not to `@nile/core`. Core only owns the registry aggregation layer (one array per concept) and the generic shape contracts.
- A central discriminated union that enumerates every plugin's concrete shape is an anti-pattern. Use a generic base type and let each plugin export its concrete extension (see `packages/agents/*/src/ProjectionTypes.ts`).
- Adding a new agent or family must not require editing any union, `Record`, or switch in core other than the single aggregation array per concept (e.g. `AGENT_DECLARATIONS`, `AGENT_MODULES`, `CONNECTION_FAMILY_MODULES`).
- A test that asserts two manually maintained lists agree is a signal that the derivation is missing. Replace the test with derivation instead of accepting the duplication.

## Parameter Passing Rules

- Do not pass a parameter through a class or method just to forward it to a deeper layer. If a value is received but never used directly, it should not be a stored field (`private readonly`). Pass it as a plain constructor argument when it is only needed to wire up a dependency.
- If a parameter travels through more than one layer without being used at intermediate levels, treat that as a signal to restructure: either inject the dependency directly where it is needed, or consolidate the wiring at the composition root.
- Constructor parameters that are only used to instantiate a collaborator must not be declared as `private readonly` fields.

## Layer Boundary Rules

- Surface-layer classes must not contain string formatting methods. All output rendering belongs in presenter classes.
- Remove dead code immediately. Do not leave unused methods, fields, types, or imports as future placeholders.
- Do not create a type alias that is an exact re-export of another type with no added constraints or semantics. Import and use the source type directly.
- A directory with only one file is not a useful abstraction. Elevate the file to its parent directory, or wait until a natural second file appears.
- Always pair `.open()` with `.close()` in a `try/finally` block. Never let an exception path skip resource cleanup.
- Consumer modules (apps, core actions, registries, UI) must not branch on a specific agent id, connection family id, or session source id string. If behavior depends on plugin specifics, declare it as a capability or field on the manifest and read the capability. The owning plugin package may use its own id literal internally — that is local, not a leak.
- When a registry exists for a behavior (e.g. `INTERACTIVE_SESSION_LOGIN_REGISTRY`, `CURRENT_SESSION_SOURCE_REGISTRY`, `AGENT_PROJECTION_REGISTRY`), consumer surfaces must depend on the registry interface, not on concrete plugin classes. Hardwiring specific implementation classes in composition roots defeats the registry and blocks new plugins from being picked up automatically.
- Interactive login sources must declare their user interaction mode (`browser_oauth`, `terminal_interactive`, etc.) on the manifest. Do not infer login UX from one agent and reuse it for another just because both are “sign in” flows.

## Naming Rules

- File names must use the minimum name that is still clear inside their directory. Do not repeat parent directory context in the file name unless it removes real ambiguity.
- Class names may be more explicit than file names. Optimize file names for local directory context, and optimize class names for exported symbol clarity.
- Avoid triple repetition across directory name, file name, and class name. If `services/credential/Store.ts` is clear, do not name the file `CredentialStore.ts` just because the class is `CredentialStore`.
- When evaluating a name, remove the parent directory context mentally first. If the remaining file name is still clear among its siblings, prefer the shorter name.
- Do not add broad prefixes like `Target`, `Credential`, `Connection`, or `Cli` to every file in a directory that already establishes that context. Keep the prefix only when siblings would otherwise become ambiguous.
- If a rename would make grep, imports, or sibling concepts materially harder to understand, keep the more explicit name and record the reason in the feature build log.

## TypeScript Rules

- Keep TypeScript `strict`-clean.
- Avoid `any`. Use `unknown` plus narrowing when needed.
- Prefer small exported types over wide unstructured objects.
- Prefer named exports over default exports.
- Prefer class methods and explicit objects over functional pipelines.
- Use `const` and early returns, but do not force a functional style.
- Prefer explicit validation at module boundaries.
- Keep storage row shapes and domain shapes separate when persistence needs a different representation.
- If a list of identifiers must stay in sync with a set of implementations, derive the list and the union type from the implementations (e.g. `(typeof AGENT_DECLARATIONS)[number]["id"]`). Hand-maintained `as const` tuples that mirror another array are a guaranteed drift source.

## Electron Rules

- Treat Electron as a multi-process app: keep main, preload, and renderer responsibilities separate.
- Renderer code must not directly import privileged Electron APIs.
- Expose renderer-safe APIs through preload only.
- Keep the preload surface minimal and task-oriented.
- Any new renderer-to-main capability should be added as an explicit IPC contract, not ad hoc channel sprawl.

## Testing and Verification

- Add tests with each feature when the spec has observable behavior to verify.
- Test feature scope, not third-party reference repositories under `research/`.
- For this repo, prefer:
  - `npm run test:core`
  - `npm run test:cli`
  - `npm run test:desktop`
  - `npm run typecheck`
- When a test needs persistence, use temp directories and isolate state.
- Do not make tests depend on personal machine state under `~/.codex`, `~/.claude`, or other live user config paths unless the feature explicitly targets that path and the test is isolated.

## Editing Rules

- Do not change `.vestin/specs/` or `.vestin/architect.md` during normal feature build work unless the user explicitly asks for a planning/spec revision.
- Update the matching `.vestin/plans/.../build.md` file after implementing a feature.
- The build log entry must include a "Key findings" subsection listing any deliberate omissions, partial fixes, judgment calls, or known follow-up gaps. "Done with caveats" recorded honestly is better than "appears done".
- Update `.vestin/state/features.json` when a feature state becomes clear.
- Keep comments short and only where the code is not obvious.
- Do not add new dependencies without a concrete need.

## Practical Defaults

- Prefer boring, readable code over clever abstractions.
- If a name sounds architectural but the code only does one concrete thing, rename it to the concrete thing.
- If a module is not reused yet, do not abstract it as a framework.
- Avoid speculative design. Add fields and types when they become necessary, not earlier.
- Keep interfaces and DTOs lean. Remove unused properties instead of carrying them forward.
- Prefer names that read clearly within their directory context. Do not repeat the parent context in every file or class name unless it removes real ambiguity.
- Use product or feature names only when they add meaning. Avoid prefixes like `Cli*` for files already living under `apps/cli/src`.
- When using getter properties or other lazy patterns to defer evaluation (typically to break circular initialization between packages), add a one-line comment at the declaration explaining the reason. Lazy evaluation as a workaround should be visible, not folklore.
- If a rule would force a worse local design, keep the code simple and document the exception in the feature build log.
