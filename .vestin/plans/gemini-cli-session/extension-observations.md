# Gemini Extension Observations

## 2026-05-14

### What Gemini exposed

Gemini CLI introduces a session shape that does not fit the current "one agent, one file-backed live setup" assumption cleanly.

It adds three distinct moving parts:

- a hybrid OAuth credential backend
  - official Gemini CLI prefers keychain
  - falls back to `~/.gemini/oauth_creds.json`
- an account pointer file
  - `~/.gemini/google_accounts.json`
- a mode file
  - `~/.gemini/settings.json`

That means Gemini switching is not just "swap one auth file". It is "swap credential backend state + account pointer + auth mode" together.

### What felt easy

- Agent-owned local stores fit the current codebase well.
  - `CredentialStore`
  - `AccountsStore`
  - `SettingsStore`
- The repository already has a good habit of keeping local agent file logic inside the agent directory.
- Existing session agents gave a clear pattern for:
  - snapshot
  - apply
  - restore

### What felt more complex than it should

#### 1. Session backend logic is still agent-local

Gemini required a new `CredentialBackend` layer because the official CLI can use keychain or file storage.

Today that logic has to live inside the Gemini agent because there is no shared abstraction for:

- detect current credential backend
- read current session from that backend
- snapshot backend state
- restore backend state

This is manageable for Gemini, but it will become repetitive if more agents adopt hybrid storage.

#### 2. Early live-state work is coupled to global connection modeling

The existing generic live-setup path assumes a new agent already has:

- a registered `AgentId`
- a registered `AuthMode`
- a registered endpoint family / connection support kind
- renderer-safe display strings

That makes early discovery work heavier than necessary. Gemini needed a separate internal reader first, before it was worth touching global connection wiring.

#### 3. Endpoint and session modeling are still joined too early

For Gemini, we can already detect a coherent Google session before we decide exactly how it should map into the shared endpoint catalog.

The current architecture pushes new agents toward "define endpoint/auth/selection semantics up front" instead of letting us stage:

1. local session state detection
2. saved connection family modeling
3. agent runtime registration

Gemini made this concrete very quickly:

- adding one new session family required touching:
  - shared credential kinds
  - auth modes
  - endpoint profile/protocol/family
  - connection support kinds
  - labeling
  - identity-key resolution
  - upsert matching
  - desktop connection-manager guards

That is manageable, but it is still more scattered than ideal for "just add one agent/session family".

#### 3. Local session shape and saved credential shape should stay separate

Gemini also exposed a useful modeling rule:

- local session files / keychain payloads do not necessarily carry the same envelope as Nile saved credentials

For Gemini:

- local state is just OAuth material
- saved Nile credentials need a `kind`

Trying to merge those too early made the stores look like they were already reading global stored credentials.

Keeping them separate is cleaner:

- `GeminiLocalSessionCredential`
- `StoredCredential` with `kind: "gemini_cli_session"`

#### 4. Runtime registration is still all-or-nothing

Because `SUPPORTED_AGENT_IDS` and the desktop settings query are global, adding `gemini` to the agent list too early would force us to expose a half-implemented surface.

That means the current architecture still lacks a clean "internal agent implementation in progress" stage.

Right now the safe path is:

- implement agent-local stores/readers first
- keep the agent out of global registration
- only register once detect/import/apply/rollback are coherent enough

#### 5. Desktop tests still assume a fixed agent set

Once `gemini` entered `SUPPORTED_AGENT_IDS`, several desktop/state tests started reading the real machine's `~/.gemini` because their fixtures only overrode homes for:

- `codex`
- `cursor`
- `claude`
- `openclaw`

That created two separate maintenance costs:

- exact expected agent arrays had to be updated
- test fixtures leaked real local state whenever a new agent was added

The second problem is the more important one. Future agent work should prefer:

- one shared "all test agent homes" helper
- one shared "all supported agents" helper for desktop fixtures

so a new agent does not silently start reading personal machine state during unrelated tests.

#### 6. Hybrid session backends need both result-based and throw-based fallback paths

Gemini CLI exposed a subtle but important backend rule:

- some keychain probe failures come back as ordinary command results
- some fail earlier and throw while resolving the helper executable path

If the backend only handles one of those shapes, fallback-to-file looks correct in unit tests but still fails in real CLI/runtime integration.

This is a good sign that a future shared "session credential backend" abstraction should own:

- result normalization
- unavailable-backend detection
- file fallback policy

instead of leaving each session agent to rediscover those edge cases on its own.

#### 7. Agent order and explicit agent parsing still had hidden fixed sets

Gemini exposed two places that looked generic but were still effectively four-agent code:

- desktop preferences default order
- CLI `--agents` parsing

In both cases the first implementation had hard-coded:

- `codex`
- `claude`
- `cursor`
- `openclaw`

That created two different risks:

- new agents silently disappear from default UI ordering
- new agents exist in runtime/state, but CLI rejects them as invalid explicit agent ids

The fix in this slice was straightforward:

- derive default order from `SUPPORTED_AGENT_IDS`
- validate explicit `--agents` entries through `isAgentId(...)`

This is a good signal that any new shared "agent manifest" work should also own:

- default ordering
- explicit CLI parsing
- any user-facing examples built from the supported agent set

#### 8. Session family plumbing should be made generic before it reaches surfaces

Gemini also showed that we still have a staging gap between:

- new session-family runtime support
- generic add/edit surfaces

The current repository needed local plumbing updates for:

- `LocalCredentialRequest`
- `LocalCredentialRequestBuilder`
- `LocalCredentialResolver`

before a new session family could even be considered for a generic add flow.

That support is useful even while Gemini stays behind agent-specific import/apply surfaces, because it means the next expansion step does not have to rediscover:

- current live-source naming
- request shape wiring
- stored credential normalization

This suggests a future cleanup:

- treat "current local session source" as a small shared registry alongside auth modes
- let new session families register:
  - current source id
  - local resolver
  - display label

instead of touching three different credential-building layers by hand

#### 9. Desktop agent surfaces still assume "generic add connection" is the universal entry point

Gemini exposed a separate UI assumption:

- the agent detail connections tab always showed `Add connection`
- but Gemini does not currently enter through the preset-backed add-connection flow

That created an awkward half-state:

- runtime and CLI could already import/apply Gemini sessions
- the detail page still offered a generic add surface that would reject `gemini_cli_session`

The current safe fix is small but revealing:

- gate the detail-page add button behind `canConfigureAgent(...)`
- pass the detected setup into the detail page
- offer `Import current setup` there when the agent is import-driven instead of preset-driven

This suggests a broader cleanup for future agent work:

- make the primary connection entry mode explicit per agent
  - generic add connection
  - current setup import
  - both
- let desktop surfaces render from that capability instead of assuming every supported agent starts from the same connection-creation UI

#### 10. Local current-session resolution was spread across type definitions, builder logic, and resolver logic

Before this slice, adding a new current-session source still meant touching:

- request types embedded inside `LocalCredentialResolver`
- `LocalCredentialRequestBuilder`
- `LocalCredentialResolver`

Gemini made that layering feel worse than necessary because the request type itself lived in the resolver file.

The current cleanup reduced that spread by:

- moving `LocalCredentialRequest` into its own file
- introducing a shared `CurrentSessionResolver`

This is still not a full registry, but it is a meaningful step:

- request shape is no longer owned by the resolver
- "read the current local session" now has one shared home

The next logical improvement, if another session agent appears, would be a small registry for:

- current session source id
- auth mode
- resolver entry

instead of another round of manual branch additions.

#### 11. Hybrid session backend behavior was generic enough to deserve a shared helper

Gemini forced us to implement:

- preferred backend read
- fallback backend read
- snapshot / restore for both backends
- write-target selection

Those rules are not Gemini-specific. They describe a broader pattern:

- one authoritative backend when present
- one fallback backend when the preferred backend is absent

This slice introduced a shared `PreferredCredentialBackend` so Gemini no longer owns that generic orchestration alone.

That does not mean every future session agent should use it automatically, but it moves one real extension pattern out of a single agent implementation and into a shared service.

### What changed in this slice

- Added Gemini-owned local stores for:
  - `oauth_creds.json`
  - `google_accounts.json`
  - `settings.json`
- Added a Gemini credential backend abstraction that prefers keychain and falls back to file storage.
- Added a Gemini session reader that validates:
  - OAuth mode
  - current backend credential
  - active account pointer
  - `id_token` identity claims
- hardened shared extension points around:
  - default agent order
  - explicit CLI agent parsing
  - local session request/resolution for `gemini_cli_session`
  - desktop agent-detail connection entry points
  - explicit agent connection entry mode
  - shared preferred-backend orchestration

### Suggested improvements for future agent work

#### Near-term

- Keep new session agents staged in three slices:
  1. local state stores
  2. backend + reader
  3. shared connection/runtime registration

This keeps new agent bring-up from spilling into desktop surfaces too early.

#### Medium-term

- Introduce a small shared concept for "session credential backend".

It should cover:

- file-backed session storage
- keychain-backed session storage
- hybrid priority rules
- backend snapshot / restore

This would reduce duplicated logic across session-based agents.

#### Longer-term

- Separate "raw current session detection" from the shared `LiveSetupMatcher` path.

That would let a new agent prove its local runtime contract before it has to register:

- new auth modes
- new endpoint families
- new UI display strings

Gemini is the first strong signal that this separation would make extension work easier to stage and maintain.
