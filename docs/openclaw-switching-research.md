# OpenClaw Switching Research

Date: 2026-05-03

## Scope

This note documents how [`cc-switch`](/Users/jiatwork/Works/nile/research/cc-switch) switches OpenClaw, with focus on the live config surface and the actual state mutation pattern.

Key files inspected:

- [`research/cc-switch/src-tauri/src/openclaw_config.rs`](/Users/jiatwork/Works/nile/research/cc-switch/src-tauri/src/openclaw_config.rs)
- [`research/cc-switch/src-tauri/src/commands/openclaw.rs`](/Users/jiatwork/Works/nile/research/cc-switch/src-tauri/src/commands/openclaw.rs)
- [`research/cc-switch/src-tauri/src/services/provider/live.rs`](/Users/jiatwork/Works/nile/research/cc-switch/src-tauri/src/services/provider/live.rs)
- [`research/cc-switch/docs/user-manual/ja/5-faq/5.1-config-files.md`](/Users/jiatwork/Works/nile/research/cc-switch/docs/user-manual/ja/5-faq/5.1-config-files.md)

## Short Answer

OpenClaw switching in `cc-switch` is not "replace one auth file with another account snapshot".

It is:

1. Read and write one shared JSON5 config file at `~/.openclaw/openclaw.json`.
2. Keep provider definitions side by side under `models.providers`.
3. Switch the active model by updating `agents.defaults.model.primary`.

So the live switch surface is a merged config document, not a single-account credential blob.

## Live Config Surface

`cc-switch` treats OpenClaw's main config as:

- config directory: `~/.openclaw/`
- main file: `~/.openclaw/openclaw.json`
- format: JSON5

That is stated in the user manual and implemented in `get_openclaw_dir()` / `get_openclaw_config_path()` inside [`openclaw_config.rs`](/Users/jiatwork/Works/nile/research/cc-switch/src-tauri/src/openclaw_config.rs).

The default skeleton it expects is effectively:

```json5
{
  models: {
    mode: "merge",
    providers: {},
  },
}
```

The important point is `mode: "merge"`: OpenClaw is designed for additive provider management.

## What Represents The Active Selection

Two parts of `openclaw.json` matter for switching:

### 1. `models.providers`

This holds the saved provider definitions. Each provider entry can include:

- `baseUrl`
- `apiKey`
- `api`
- `models`
- `headers`

In `cc-switch`, this is the live provider store. Commands like `get_openclaw_live_provider_ids` and `get_openclaw_live_provider` read directly from that section in [`commands/openclaw.rs`](/Users/jiatwork/Works/nile/research/cc-switch/src-tauri/src/commands/openclaw.rs).

### 2. `agents.defaults.model.primary`

This is the active model pointer. `cc-switch` exposes `get_openclaw_default_model` / `set_openclaw_default_model` for that section, again in [`commands/openclaw.rs`](/Users/jiatwork/Works/nile/research/cc-switch/src-tauri/src/commands/openclaw.rs).

The manual's example shows the shape clearly:

```json5
agents: {
  defaults: {
    model: {
      primary: "provider/model"
    }
  }
}
```

So the effective switch operation is: keep the provider fragment present, then point `primary` at `providerId/modelId`.

## How `cc-switch` Writes Safely

`cc-switch` does more than parse and stringify JSON:

- It parses OpenClaw config as JSON5.
- It keeps a round-trippable document form so existing layout/comments can survive targeted updates.
- It uses a write lock for OpenClaw config writes.
- It can create backups and return health warnings.

Those behaviors live in [`openclaw_config.rs`](/Users/jiatwork/Works/nile/research/cc-switch/src-tauri/src/openclaw_config.rs).

This matters because OpenClaw is not using an isolated Nile-owned file. It is a user-owned config document that may already contain unrelated sections like `env`, `tools`, or workspace settings.

## How This Differs From Codex-Style Auth Switching

For Codex community tools, the common pattern is usually:

- store multiple credential snapshots
- overwrite the live auth file on switch

OpenClaw in `cc-switch` is different:

- providers coexist
- switching is a config mutation
- the active state is a model reference, not a copied auth snapshot

That makes OpenClaw much closer to a provider-router adapter than an account-snapshot adapter.

## Practical Takeaway For Nile

The minimum OpenClaw adapter contract needs three pieces:

1. Read the current `primary` model reference from `agents.defaults.model.primary`.
2. Read or write the matching provider fragment under `models.providers[providerId]`.
3. Preserve the rest of `openclaw.json` while doing targeted updates.

One extra requirement falls out of this design: a saved Nile connection needs an explicit OpenClaw `modelId`.

Without that, Nile can know the endpoint and credential, but it still cannot produce the `providerId/modelId` pointer that OpenClaw uses as the active selection.

## Nile Implementation Direction

Based on this research, Nile should treat OpenClaw as:

- a JSON5 config adapter
- additive provider mutation, not destructive full-file replacement
- explicit model selection via `providerId/modelId`

That is the right mental model for apply, detect, import, and rollback in our core adapter.
