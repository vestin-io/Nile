# Gemini CLI Adapter

## Feature Purpose

Add Gemini CLI as a first-class Nile agent with support for detecting, saving, applying, and rolling back Google-account session state.

## Requirements

- Nile MUST recognize Gemini CLI as a supported agent with explicit capability registration.
- Nile MUST detect Gemini CLI Google session state from Gemini-owned local runtime files plus the active credential backend.
- Nile MUST save Gemini Google sessions as `gemini_cli_session` connections instead of reusing `openai_session`.
- Nile MUST support a Gemini OAuth credential backend that can be keychain-backed or file-backed.
- Nile MUST treat `google_accounts.json.active` and the decoded credential identity as part of the same live setup.
- Nile MUST apply a saved Gemini session by updating the Gemini OAuth credential backend, `google_accounts.json`, and Gemini auth mode together.
- Nile MUST support rollback of the latest Gemini mutation by restoring the prior credential backend state, account pointer state, and auth mode.
- Gemini switching MUST remain an explicit user action.
- Gemini detection MAY auto-sync a uniquely matched Gemini saved selection only if that sync does not mutate Gemini local runtime state.

## Verification

- Add focused Gemini adapter tests for:
  - live detection from current Gemini local files
  - import of current Gemini Google session
  - apply of a saved `gemini_cli_session`
  - rollback of the latest Gemini mutation
  - dual-backend credential behavior when keychain is unavailable
- Run:
  - `npm run typecheck`
  - `npm run test:core`
  - targeted Gemini desktop and CLI tests when surface wiring exists

## Data Model Impact

- New agent id:
  - `gemini`
- New auth mode / credential family:
  - `gemini_cli_session`
- New Gemini mutation snapshot content:
  - credential backend state
  - `google_accounts.json`
  - Gemini auth mode state

## Failure / Edge Cases

- Gemini OAuth credentials exist but `google_accounts.json.active` does not match the decoded `id_token.email`
- Gemini credential backend exists in keychain but file storage is stale
- Gemini credential backend exists only in file storage
- Gemini auth mode is not `oauth-personal`
- rollback target exists but one of the Gemini state files was deleted externally
