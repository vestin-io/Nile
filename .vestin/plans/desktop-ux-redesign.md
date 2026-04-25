# Desktop UX Redesign

## Goal

Redesign the desktop main window around how a user actually uses Nile, instead of around internal capabilities.

The window should feel like a native desktop control surface:

- understand current state quickly
- switch or manage connections intentionally
- diagnose one agent at a time
- review or undo recent Nile changes

It should not feel like a single long admin page with forms and lists stacked together.

## Product Principle

The desktop app has two surfaces with different jobs:

### Menubar

The menubar exists for one high-frequency action:

- switch a supported agent to another saved connection

It should stay fast and sparse.

### Main Window

The main window exists for everything the menubar should avoid:

- understand overall state
- manage saved connections
- inspect one agent in depth
- import detected local setups
- review history
- inspect low-frequency local diagnostics

## Core User Questions

The main window should answer these questions in order:

1. What is Nile currently using?
2. Which agents need my attention?
3. Where do I manage saved connections?
4. Why is one agent out of sync?
5. What did Nile change recently, and can I undo it?

If a page does not clearly answer one of these, it is probably overloaded or misplaced.

## Primary Navigation

Use four main tabs and one low-frequency settings entry.

### Main Tabs

1. `Home`
2. `Agents`
3. `Connections`
4. `History`

### Secondary Entry

- `Settings`

`Settings` should not compete with the main workflow. Put it at the bottom of the sidebar as a lower-priority entry.

## Why This Structure

### Home

This is the normal landing page after onboarding.

It answers:

- what is happening now
- which agent is healthy
- which agent needs action

It should not contain forms or long lists.

### Connections

This is where the user manages saved connections.

It should be connection-centered, not process-centered.

### Agents

This is where the user inspects one agent at a time.

It should be diagnosis-centered, not inventory-centered.

### History

This is where the user answers:

- what changed
- what can be rolled back

It should be timeline-centered, not dashboard-centered.

### Settings

This is where the user finds paths, counts, diagnostics, and low-frequency local details.

It should not be a main workflow tab.

## First-Run Flow

The first-run state should take over the main window when there are no saved connections.

It should not show the regular tab shell first.

### Behavior

When saved connection count is `0`:

1. scan supported local agent setups automatically
2. branch by importable result count

### Branches

#### One Importable Setup

Show:

- `Nile found your local setup`
- concise summary of the detected setup
- primary action: `Import and continue`
- secondary action: `Set up manually`

#### Multiple Importable Setups

Show:

- `Nile found local setups on this machine`
- a selectable list
- primary action: `Import selected`
- secondary action: `Set up manually`

#### Zero Importable Setups

Show:

- `No local setups found yet`
- guidance to sign in first or add a connection manually
- primary action: `Add connection`

### Exit Condition

After successful import or successful manual creation of the first saved connection:

- dismiss onboarding
- enter the regular tab shell

## Home Tab

## Purpose

Give the user a fast operational overview.

## Content

### Top Agent Cards

One card per supported agent:

- `Codex`
- `Cursor`
- `Claude`

Each card should show:

- current connection label
- provider label
- usage summary if available
- one state badge:
  - `Synced`
  - `New local setup`
  - `Needs attention`
  - `Not configured`
- one primary action:
  - `Switch`
  - `Import`
  - `Fix`

### Recent Changes

Below the cards, show a compact list of the last 3 recent Nile mutations.

### Attention Summary

If any agent is not healthy, show a short top-level summary:

- `1 agent needs attention`
- `2 agents need attention`

## Home Rules

- no forms
- no full saved-connection inventory
- no advanced diagnostics
- no destructive actions

## Connections Tab

## Purpose

Manage saved connections.

## Layout

Use `master-detail`.

### Left Pane

Saved connection list.

Each row should show:

- label
- provider label
- auth mode
- usage summary if available
- which agents are currently using it

### Right Pane

Selected connection detail.

Show:

- connection label
- provider family
- provider label
- auth mode
- compatible agents
- currently selected by which agents

Actions:

- `Use for Codex`
- `Use for Cursor`
- `Use for Claude`
- `Remove`

### Page Header Actions

- `Add connection`
- `Scan local setups`

## Important Rule

Do not embed the add form inside the page body.

Do not embed detected-setup import as a third full-height section.

These should open as:

- modal
- sheet
- side panel

The page body should stay focused on saved connections.

## Connections Modal Flows

### Add Connection

Preferred flow:

1. choose provider family
2. choose auth mode
3. enter or acquire credentials
4. preview generated label
5. create

### Scan Local Setups

Preferred flow:

1. scan
2. show classified results
3. allow selection for importable items
4. import selected

This is the reusable scan/import capability, not a one-time onboarding-only flow.

## Agents Tab

## Purpose

Diagnose and fix one agent at a time.

## Layout

Use one segmented control or tab strip:

- `Codex`
- `Cursor`
- `Claude`

Only one agent is in focus at a time.

## Main Content

### Saved vs Live Comparison

Show two primary panels:

- saved selection
- live local setup

### Status Panel

Show:

- sync state
- explanation
- issues if present

### Actions

- `Use saved connection`
- `Import current setup`
- `Rollback latest change`
- `Refresh`

### Compatible Connections

Below the status, show only connections compatible with the selected agent.

## Agents Rules

- do not show every saved connection for every agent
- keep the page focused on one agent, not all three at once
- highlight the recommended repair action when the agent is not synced

## History Tab

## Purpose

Show what Nile changed and what can be safely rolled back.

## Layout

### Top Filter Bar

- `All`
- `Codex`
- `Cursor`
- `Claude`

### Main Area

Mutation timeline.

Each row should show:

- time
- agent
- connection label
- mutation type
- status

### Detail Area

Show selected entry detail:

- provider
- files touched
- error message if any

### Rollback Area

If the selected agent supports rollback and has a rollbackable latest mutation, show:

- `Rollback latest change`

## History Rules

- history should read like a timeline, not like a metrics dashboard
- rollback should stay explicit
- do not imply arbitrary historic rollback if only latest-safe rollback exists

## Settings Entry

## Purpose

Hold low-frequency and local-only details.

## Content

- database path
- agent home paths
- supported agents
- saved connection count
- importable setup count
- low-frequency diagnostics

## Settings Rules

- not a primary tab
- not a default landing page
- not mixed into Home, Connections, or Agents

## Visual Design Direction

The current shell feels flat because every block uses the same card language and similar weight.

The redesign should introduce clearer hierarchy:

### Level 1

Page identity:

- page title
- short supporting sentence
- one or two high-priority actions

### Level 2

Primary task regions:

- agent cards on Home
- list/detail split on Connections
- saved/live comparison on Agents
- timeline on History

### Level 3

Secondary detail:

- metadata
- counts
- diagnostics
- low-priority explanatory text

## What To Remove From The Current Shape

- stacked add form inside `Connections`
- stacked detected-setup section inside `Connections`
- equal-weight cards everywhere
- `Main Window` as the sidebar title
- pages that try to explain and manage everything at once

## Implementation Order

1. replace current navigation model with `Home / Agents / Connections / History`
2. move `Settings` out of main tab priority
3. rebuild `Connections` as master-detail
4. move `Add connection` into modal flow
5. move `Scan local setups` into modal/sheet flow
6. rebuild `Agents` as single-agent diagnosis page
7. rebuild `History` as timeline + detail
8. restyle page hierarchy so each tab has one obvious primary task

## Success Criteria

- A normal returning user can open the main window and understand the current state within a few seconds.
- A user can manage saved connections without scanning through forms embedded in long content stacks.
- A user can inspect one agent without distraction from unrelated agents.
- The window reads like a desktop control surface, not an internal admin page.
