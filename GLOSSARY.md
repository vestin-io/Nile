# Nile Glossary

This glossary defines the current canonical terms for Nile.

Use this file when naming new code, UI copy, specs, and build notes. If a term here conflicts with older repository language, prefer the term in this glossary.

## User-facing terms

### Connection

A saved thing Nile can list, switch, remove, and show in usage flows.

A connection is the product-level object users interact with. Internally it is built from an `Endpoint` plus an `Access`.

### Connection preset

The setup path a user chooses when adding a connection.

Current presets:

- `Official OpenAI`
- `Gateway`
- `Azure OpenAI`
- `Official Claude`

Presets are onboarding shortcuts. They are not the same thing as endpoints.

### Quick setup

The first-run setup surface shown when Nile has zero saved connections.

It is a product flow, not a connection type.

### Repair usage

A recovery action for usage-specific problems.

Repairing usage must never imply that the connection itself is invalid. A connection can be usable even when usage is unavailable.

## Core domain terms

### Endpoint

The backend Nile talks to.

An endpoint describes:

- root URL
- profile
- supported protocols

Examples:

- official OpenAI API
- official Anthropic API
- Azure OpenAI endpoint
- a custom gateway URL

### Endpoint profile

A normalized description of what kind of backend an endpoint is.

Current profiles include:

- `openai-official`
- `anthropic-official`
- `azure-openai`
- `generic-gateway`
- `cursor-backend`

Profiles help with creation and detection. They do not replace the protocol definition.

### Endpoint family

The simplified family Nile shows in status, usage, and UI summaries.

Current families include:

- `openai`
- `gateway`
- `azure-openai`
- `anthropic`
- `cursor`

Use `endpoint family` for display/reporting. Use `endpoint profile` when the exact backend shape matters.

### Protocol

The API surface an endpoint exposes.

Current protocol labels include:

- `openai`
- `anthropic`
- `cursor`

A single endpoint can expose more than one protocol. A `Gateway` often supports both OpenAI and Anthropic protocols.

### Access

The saved access path for one endpoint.

An access describes:

- which endpoint it points to
- how it authenticates
- which agents it is enabled for
- optional identity metadata

Users do not manage access objects directly. They manage connections.

### Auth mode

How Nile authenticates for a connection or access.

Current auth modes:

- `api_key`
- `openai_session`
- `claude_session`
- `cursor_session`

### Enabled agents

The set of agents a saved connection is allowed to serve.

This is user intent, not just technical compatibility.

If a gateway supports both Codex and Claude, the detected support may include both, but the enabled agents may still be only one of them.

### Detected support

The capabilities Nile probes or infers from an endpoint.

Detected support is a suggestion, not the final user decision.

### Local setup

The current state already present on the machine for an agent.

Examples:

- current Codex config and auth
- current Claude settings and auth
- current Cursor local auth

### Detected setup

A local setup Nile has scanned and classified.

Detected setups may be:

- importable
- invalid
- already saved
- in drift

## Usage terms

### Usage binding

A usage-specific authorization link that lets Nile read usage for a saved connection.

This term is intentionally separate from `Access`.

Example:

- Cursor usage needs a web session binding in addition to the local Cursor session used for switching.

### Usage snapshot

The last stored usage result for a saved connection.

Snapshots let Nile show cached usage even when live refresh is temporarily unavailable.

### Freshness

How current a usage result is.

Current freshness values:

- `live`
- `cached`
- `stale`
- `expired`

## Agent terms

### Agent projection

The agent-specific config Nile derives from an endpoint plus an access.

Projection is an internal core term. It explains how the same saved connection can be applied differently to:

- Codex
- Claude
- Cursor

## Deprecated or ambiguous terms

Avoid these unless you are referring to an external file format or a historical record.

### Provider

Do not use this as a general Nile domain term.

Use one of:

- `connection preset` when talking about user onboarding choices
- `endpoint` when talking about the backend itself
- `endpoint family` when talking about a simplified displayed category

Exceptions:

- external file formats such as Codex `model_provider`
- third-party API wording

### Binding

Do not use this for Nile's main connection model.

Use:

- `access` for endpoint authorization and agent enablement
- `usage binding` only for usage-specific authorization, such as Cursor web usage

### Provider family

Do not use this term in current code or docs.

Use:

- `connection preset` for add-connection choices
- `endpoint family` for saved or detected endpoint summaries

### Base URL

Prefer `endpoint URL` in user-facing copy.

`baseUrl` is still acceptable in code when the field literally stores a base URL for an external API.
