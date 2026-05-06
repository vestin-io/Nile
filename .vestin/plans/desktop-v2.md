# Desktop V2 Plan

## Current Implementation Shape

The desktop surface is now organized around explicit process and workflow boundaries:

- `apps/desktop/src/electron/ipc/`
  - explicit main-process route groups for app, state, connection, and update tasks
- `apps/desktop/src/electron/shell/`
  - Electron lifecycle, tray, menu, and window orchestration
- `apps/desktop/src/electron/state/`
  - long-lived desktop cache, refresh policy, and invalidation
- `apps/desktop/src/electron/connections/`
  - desktop-owned connection command orchestration
- `apps/desktop/src/electron/updates/`
  - auto-update integration
- `apps/desktop/src/state/`
  - session-safe desktop query surface
- `apps/desktop/src/renderer/app/settings/`
  - settings shell and navigation
- `apps/desktop/src/renderer/connections/`
  - add, edit, detail, list, and dialog workflows
- `apps/desktop/src/renderer/agents/`
  - list and detail workflows
- `apps/desktop/src/renderer/settings/`
  - general settings and settings dialogs

This plan now serves as the durable intent for those boundaries rather than a step-by-step backlog for the original flat implementation.

## Goal

Build the desktop surface in two phases:

1. a minimal menubar for fast switching
2. a fuller settings window for management and diagnosis

The menubar should feel like a native utility, not a mini dashboard.

## Phase 1: Menubar First

## Purpose

The menubar only needs to answer one question:

- which connection is each supported agent using right now?

And support one action:

- switch that agent to another saved connection

## Scope

Top-level menu:

1. `Open Main Window`
2. one submenu per supported agent
3. `Settings…`
4. `Quit`

Each agent submenu:

- lists saved connections compatible with that agent
- pins the current connection to the top
- shows a checkmark on the current connection
- switches immediately when the user clicks another connection

## Menubar Rules

- Menubar is connection-first.
- Menubar does not explain drift.
- Menubar does not show import actions.
- Menubar does not show rollback actions.
- Menubar does not show destructive actions.
- Menubar does not expose provider or binding internals unless required to disambiguate names.

## Empty State

If an agent has no compatible saved connections yet, that submenu should show:

- `No saved connections`

as a disabled item.

## Interaction Model

- click tray icon
- choose agent
- choose connection
- switch happens immediately

Target behavior:

- current connection is always visible at the top
- switching any supported agent takes two clicks after opening the menu

## Data Needed For Menubar

For each supported agent:

- agent label
- current connection id
- current connection label
- list of compatible saved connections

Nothing else is required for phase 1.

## IPC Needed For Menubar

- `getMenubarState`
- `switchConnection(agentId, connectionId)`
- `openSettings`

This is intentionally smaller than the full desktop surface.

## Phase 2: Settings Window

The settings window comes after the menubar is stable and useful on its own.

Settings owns the workflows the menubar intentionally avoids:

- add connection
- remove connection
- import current local state
- view current agent drift and issues
- rollback latest Nile mutation
- inspect history
- inspect advanced local paths and state

## Planned Settings Sections

1. `Connections`
2. `Current Agent`
3. `History`
4. `Advanced`

## Connections

Purpose:

- manage saved connections

Key actions:

- add
- remove
- inspect details
- apply to an agent

## Current Agent

Purpose:

- explain live local runtime state

Key actions:

- import current
- use saved connection
- rollback latest Nile change
- refresh

## History

Purpose:

- show Nile-originated local mutations and rollback context

## Advanced

Purpose:

- show paths, build info, and low-frequency local details

## Add Connection Flow

This belongs in Settings, not in the menubar.

Preferred sequence:

1. choose connection family
2. choose auth mode
3. choose credential source or enter key
4. review generated label
5. create

Preferred wording for OpenAI session:

- auth mode: `Use OpenAI session`
- source:
  - `Sign in with OpenAI`
  - `Import current Codex auth`

## Structural Rules

- Menubar switching stays in the Electron shell and desktop state layer.
- Shared connection rules stay in `packages/core`.
- Renderer code stays workflow-oriented and must not grow a flat page bucket again.
- Main-process caches and refresh policy stay in `apps/desktop/src/electron/state/`.

## Implementation Order

### Step 1

Implement the minimal menubar:

- supported agents at the root
- current connection checked and pinned
- immediate switching
- settings and quit entries

### Step 2

Add or refine the main window entry point.

### Step 3

Build the settings shell with page navigation.

### Step 4

Build `Connections`.

### Step 5

Build `Current Agent`.

### Step 6

Build `History`.

### Step 7

Build `Advanced`.

## Success Criteria

- Menubar can switch a supported agent in two clicks.
- Current connection is always obvious in each agent submenu.
- Menubar stays visually simple and free of diagnostic copy.
- Settings becomes the single place for all non-switching workflows.
