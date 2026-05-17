# Gemini Module

The Gemini module implements the Gemini CLI agent adapter.

## Responsibilities

- read current Gemini CLI live state
- import the current Gemini CLI Google session into a saved Nile connection
- apply a saved Gemini CLI session back into Gemini local runtime state
- record and roll back Nile-owned Gemini mutations

## Data Model

### Live State Inputs

- `~/.gemini/settings.json`
  - `security.auth.selectedType` determines whether Gemini CLI is in OAuth mode
- `~/.gemini/google_accounts.json`
  - `active` is the current Gemini account pointer
  - `old[]` records previously used account emails
- Gemini OAuth credential backend
  - primary source: Gemini CLI OAuth keychain entry when available
  - fallback source: `~/.gemini/oauth_creds.json`

### Saved Connection Shape

- Gemini Google sessions use a dedicated auth mode:
  - `gemini_cli_session`
- Saved Gemini CLI connections must not reuse `openai_session`
- Selected model remains `(agentId, connectionId) -> modelId`

## Invariants

- Gemini live detection MUST treat the Gemini OAuth credential backend and `google_accounts.json.active` as one coherent live setup.
- Gemini saved connections MUST use a dedicated `gemini_cli_session` credential family.
- Gemini apply MUST update only Gemini-owned local runtime state and MUST NOT mutate other agent homes.
- Gemini rollback MUST restore the credential backend, `google_accounts.json`, and Gemini auth mode together.
- Gemini switching remains an explicit user action.

## Interfaces

- Detect current Gemini CLI live state
  - input: Gemini local home
  - output: detected access/identity, validity, issues, matched saved connection
- Import current Gemini CLI connection
  - input: current live state
  - output: matched or newly created saved connection
- Apply Gemini saved connection
  - input: saved `gemini_cli_session` connection
  - output: updated Gemini local runtime state
- Roll back Gemini mutation
  - input: latest Gemini mutation snapshot
  - output: prior Gemini local runtime state restored

Error contract:

- missing Gemini config files return invalid or unavailable live state
- incomplete OAuth credentials return invalid live state
- mismatched account pointer vs decoded credential identity returns a repairable issue
- apply failures must not leave partially written Gemini credential backend state

## Failure Model

- If Gemini uses a keychain-backed OAuth store, detection and apply may fail because of keychain denial or helper failure.
- If Gemini falls back to file-backed OAuth storage, detection and apply may fail because of unreadable or malformed JSON.
- If `settings.json` is present but not in `oauth-personal` mode, Gemini Google session switching must not proceed silently.
- Rollback failures are recoverable only if the mutation snapshot captured all Gemini-owned files and credential backend state.

## Constraints

- Core code must keep Gemini-specific file logic inside the Gemini adapter.
- Renderer code must not inspect Gemini local files directly.
- Gemini session secrets must stay in the credential store, keychain, or Gemini-owned local files only.
- Gemini account switching must support both file-backed and keychain-backed OAuth storage backends.

## Feature Index

- `adapter`: Gemini CLI Adapter
