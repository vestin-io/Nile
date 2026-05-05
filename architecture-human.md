# Human-Oriented Architecture Notes

Scope: current `nile` repository after the recent cleanup passes.

Goal: answer one question clearly:

> If an experienced engineer optimized this repo for human understanding and long-term maintenance, would they lay it out like this?

Short answer: **partly yes, but not fully**.

The repo is much healthier than before, but it still carries some "refactor-after-growth" structure. It is maintainable now. It is not yet "immediately intuitive".

## Overall Judgment

### What already feels human-friendly

- `apps/` vs `packages/` is a good top-level split.
- `core` / `host-local` / `cli` / `desktop` responsibilities are much clearer than before.
- A lot of obvious over-forwarding and overdesign has already been removed.
- Many of the worst mixed-responsibility files have been split into smaller, more local concepts.

### What still does not feel fully human-oriented

- Some naming still leans technical instead of conceptual:
  - `Support`
  - `Manager`
  - `Flow`
  - `Commands`
  - `State`
- Some directories are organized around implementation style rather than user-facing domain concepts.
- Some features still require reading across too many neighboring files before a maintainer can rebuild the full story.
- Some helper surfaces are still "misc buckets" even after being trimmed.

## What A Human-Centered Layout Usually Optimizes For

- A maintainer should know where to look before reading code.
- A filename should answer "what concrete thing lives here?"
- A class name should answer "what job does this object own?"
- A feature should mostly close within a small cluster of nearby files.
- A reader should not need to reconstruct intent from generic names.

## Current Repo Assessment

### 1. Top-Level Structure

Current:

- `apps/cli`
- `apps/desktop`
- `packages/core`
- `packages/host-local`

Assessment:

- This is good.
- A human would likely keep this top-level shape.

Recommendation:

- Keep the top-level package split as-is.
- Do not collapse app and package responsibilities together.

### 2. `packages/core`

What feels right:

- `models/`, `agents/`, `actions/`, `services/` are understandable.
- Agent-specific logic being grouped by agent is good.

What still feels slightly mechanical:

- `actions/` vs `runtime-local/` vs `application/local/` can still feel like architecture words first, domain words second.
- Some readers will not immediately know whether a behavior belongs in:
  - `actions/use`
  - `runtime-local`
  - `application/local`

Human-oriented preference:

- Push toward "where would a maintainer expect this behavior to live for this user story?"
- Prefer concrete use-case clusters over abstract layer terms when the boundary is blurry.

Example of a more human-readable direction:

- `models/connection`
- `models/access`
- `agents/codex`
- `agents/claude`
- `session/` or `workspace/`
- `storage/` or `persistence/`

Not a required rename now, but that is the mental direction.

### 3. `apps/desktop`

What feels right:

- `electron/` vs `renderer/` is correct.
- Recent splits like:
  - `DesktopShell`
  - `DesktopPreparedDraftStore`
  - `DesktopWorkspaceWatcher`
  make the main-process side much easier to follow.

What still feels less natural:

- `renderer/shared/Support.ts` was an example of a "misc helper sink".
- Some renderer feature files still spread a single user story across:
  - page component
  - state hook
  - form helpers
  - support helpers
  - app-level action hooks

Human-oriented preference:

- Group files by user workflow first.

Example:

- `renderer/connections/add/`
- `renderer/connections/edit/`
- `renderer/connections/list/`
- `renderer/agents/detail/`
- `renderer/settings/update/`

Why:

- A maintainer looking for "Add Connection" work should not have to jump between general-purpose renderer folders as often.

### 4. `apps/cli`

What feels right:

- Presenters are separated from command execution.
- Routing is thinner now.

What still feels slightly framework-like:

- `commands/`, `menu/`, and `presenters/` are technically clear, but not always story-oriented.
- `ConnectionAddFlow`, `ConnectionAgentSelectionFlow`, `ConnectionCommands` are better than before, but they still read as implementation choreography.

Human-oriented preference:

- Keep the split, but bias naming toward user tasks rather than generic execution words where possible.

Possible direction over time:

- `connections/add`
- `connections/manage`
- `connections/select`
- `history/rollback`
- `usage/cursor`

This is not automatically better everywhere, but it usually shortens the "where should I go?" step.

## Naming Review

### Names That Usually Help Humans

- Concrete nouns
- Concrete verbs
- Domain language
- Stable concepts

Examples:

- `DesktopPreparedDraftStore`
- `GatewayModelCatalog`
- `EndpointLabelFormatter`
- `ConnectionAgentSelectionFlow`

These are understandable because they name a real thing.

### Names That Usually Slow Humans Down

- `Support`
- `Manager`
- `Helper`
- `Utils`
- `Flow` when overused
- `State` when it does more than hold state

These names are not always wrong, but they make the reader inspect implementation before understanding ownership.

## What A Human Would Likely Change Next

### 1. Reduce Generic Naming Buckets

Priority targets:

- remaining `Support` files
- remaining broad `Manager` classes
- broad `Commands` containers

Rule:

- if a file name does not tell you what concrete thing it owns, it is probably too generic.

### 2. Re-group By User Workflow In Renderer

Best next human-centered improvement:

- reorganize renderer files around workflows:
  - add connection
  - edit connection
  - connection detail
  - agent detail
  - settings updates

This would help more than another round of purely mechanical file splitting.

### 3. Reduce Cross-File Story Length

For a user story like "save a gateway connection", a maintainer should ideally read:

- one page
- one state hook
- one action hook
- one main-process command entry

If they need 7-10 files, the structure is still too distributed.

### 4. Keep Domain Words Stable Across App Layers

The same concept should keep the same name across:

- renderer
- Electron main
- CLI
- core

For example, if the product concept is "prepared draft", do not call it:

- `draft` in one place
- `preparedSelection` in another
- `pendingConnection` elsewhere

Humans maintain systems faster when vocabulary is stable.

## Recommended Directory Direction

Not an immediate migration plan. This is the target mental model.

```text
apps/
  cli/
    src/
      connections/
      history/
      usage/
      shell/
  desktop/
    src/
      electron/
        connections/
        updates/
        windows/
      renderer/
        connections/
          add/
          edit/
          detail/
        agents/
          detail/
        settings/
          updates/
          preferences/
packages/
  core/
    src/
      models/
      agents/
      session/
      storage/
      usage/
  host-local/
    src/
      cursor/
```

This is intentionally directional, not dogmatic.

## Final Answer

Would a strong engineer writing primarily for humans produce exactly the current layout?

- No.

Would they produce something close to the current layout after a few cleanup passes?

- Yes.

Is the repo now understandable and maintainable?

- Yes.

Is it already optimized for fast human comprehension?

- Not fully.

The biggest remaining improvement is no longer "split big files".
The biggest remaining improvement is:

- stronger domain-oriented naming
- more workflow-oriented directory grouping
- fewer generic technical bucket names
