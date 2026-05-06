# OpenClaw Adapter Build Log

## 2026-05-03

### Step 1: Research OpenClaw Switching In `cc-switch`

- Confirmed that OpenClaw switching is driven by `~/.openclaw/openclaw.json`, not by swapping a dedicated auth snapshot file.
- Verified that the active selection is the pair:
  - `models.providers[providerId]`
  - `agents.defaults.model.primary = "providerId/modelId"`
- Confirmed that `cc-switch` treats OpenClaw config as JSON5 and preserves the shared config document instead of owning the whole file.
- Wrote the findings to a temporary OpenClaw switching research note under `docs/` during implementation.

### Step 2: Add Core OpenClaw Adapter Support

- Added a new OpenClaw agent adapter under `packages/core/src/agents/openclaw/`.
- Implemented:
  - current-state read/detect
  - apply
  - import
  - rollback
- Added OpenClaw projection support so OpenAI-compatible and Anthropic-compatible saved connections can be projected into OpenClaw provider config plus model selection.
- Added persisted `openclawModelId` support on saved access records because OpenClaw switching needs an explicit model id.

### Step 3: Keep Generic Connection Flows Coherent

- Did not make OpenClaw a default-enabled generic connection target for OpenAI/Gateway/Anthropic presets.
- Kept OpenClaw activation agent-scoped through import/apply paths unless a saved connection already carries `openclawModelId`.
- This avoids exposing a broken generic create/edit path that would enable OpenClaw without enough data to produce `providerId/modelId`.

### Step 4: Surface And Verification

- Registered the OpenClaw adapter in shared runtime and surfaced it in CLI/desktop agent lists.
- Standardized the desktop label to `OpenClaw`.
- Isolated tests from live `~/.openclaw` machine state by wiring temp OpenClaw homes in shared test setup helpers.
- Verified with:
  - `npm run test:core`
  - `npm run test:cli`
  - `npm run test:desktop`
  - `npm run typecheck`

### Step 5: Complete CLI OpenClaw Create Flow

- Added CLI `add` support for `--openclaw-model-id <model>`.
- Completed both non-interactive and interactive CLI add flows so OpenClaw can be enabled at creation time instead of only through import/use/rollback.
- Added CLI-side validation for inconsistent inputs:
  - `openclaw` enablement now requires `api_key` auth
  - explicit `openclaw` enablement requires a model id
  - explicit model ids cannot be provided while omitting `openclaw` from `--agents`
- Updated CLI help text to list `openclaw status/import/use/rollback` and the new add flag.
- Verified with:
  - `npm run test:cli`
  - `npm run typecheck`
