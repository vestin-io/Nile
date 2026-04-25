# Claude Switch Projects Research

## Scope

This note compares four Claude-related switcher projects under [`research/`](/Users/jiatwork/Works/nile/research):

- [`claude-swap`](/Users/jiatwork/Works/nile/research/claude-swap)
- [`claude-switcher-tray`](/Users/jiatwork/Works/nile/research/claude-switcher-tray)
- [`claude-code-switch`](/Users/jiatwork/Works/nile/research/claude-code-switch)
- [`cc-switch`](/Users/jiatwork/Works/nile/research/cc-switch)

The key question is whether "Claude switch" means the same thing across projects.

Short answer: **no**.

There are two different categories:

1. **Claude subscription account switching**
   Save multiple Claude login states, then write one back to the live credential surface.
2. **Anthropic-compatible provider switching**
   Change Claude Code's API endpoint/model/token through settings or environment variables.

Those categories should not be merged into a single adapter contract without an explicit distinction.

## Summary Table

| Project | Main goal | Switch surface | Restart needed | Notes |
| --- | --- | --- | --- | --- |
| `claude-swap` | Claude account switch | Claude credentials + config `oauthAccount` | Yes | Most complete "account switcher" implementation |
| `claude-switcher-tray` | Claude account switch | `~/.claude/.credentials.json` snapshots | Usually yes | Minimal desktop tray UX |
| `claude-code-switch` | Provider switch first, account switch second | Shell env, `~/.claude/settings.json`, `.claude/settings.local.json`, plus saved Claude creds | Provider: often no. Account: yes | Hybrid design |
| `cc-switch` | Multi-app provider manager | `~/.claude/settings.json` | Claude: claims no restart | Better reference for desktop architecture than account switching |

## Project Findings

### 1. `claude-swap`

`claude-swap` is a real Claude account switcher, not just a model/provider switcher. Its switch flow does five things:

- lock the operation
- back up the current account credentials
- back up the current config
- write target credentials into the live credential store
- update the config's `oauthAccount`

The critical path is in [`switcher.py`](/Users/jiatwork/Works/nile/research/claude-swap/src/claude_swap/switcher.py:1052). It writes target credentials, then rewrites the config's `oauthAccount`, then updates sequence state, with rollback support if any step fails. The implementation explicitly tells the user to restart Claude Code after switching. See [`switcher.py`](/Users/jiatwork/Works/nile/research/claude-swap/src/claude_swap/switcher.py:1110).

This is the strongest reference if we later want a serious Claude account adapter with:

- locking
- rollback
- account backups
- config consistency

### 2. `claude-switcher-tray`

`claude-switcher-tray` is the simplest account-switch pattern. It saves the current live `~/.claude/.credentials.json` into `~/.claude/accounts/*.json`, then identifies the active account by matching `refreshToken`. See [`Program.cs`](/Users/jiatwork/Works/nile/research/claude-switcher-tray/csharp/Program.cs:521) and [`Program.cs`](/Users/jiatwork/Works/nile/research/claude-switcher-tray/csharp/Program.cs:595).

This project is useful as a minimal proof that Claude account switching can be built as:

- snapshot current credentials
- restore target credentials
- infer active account from a stable token field

It is much lighter than `claude-swap`, but also much less defensive.

### 3. `claude-code-switch`

`claude-code-switch` is not only an account switcher. Its README shows three separate capabilities:

- switch Anthropic-compatible providers in the current shell
- write user-level settings
- write project-level settings
- save/switch multiple Claude Pro accounts

See [`README.md`](/Users/jiatwork/Works/nile/research/claude-code-switch/README.md:11).

Its provider switching path is mostly environment-variable and settings based. For project-level overrides it writes `.claude/settings.local.json` with fields like `ANTHROPIC_BASE_URL`, `ANTHROPIC_AUTH_TOKEN`, and `ANTHROPIC_MODEL`. See [`ccm.sh`](/Users/jiatwork/Works/nile/research/claude-code-switch/ccm.sh:470).

Its account switching path is different: it reads the current Claude credentials, base64-encodes them into an accounts file, then writes the selected credentials back into the live credential store. On macOS it writes through Keychain; on Linux it writes the credentials file. See [`ccm.sh`](/Users/jiatwork/Works/nile/research/claude-code-switch/ccm.sh:1010), [`ccm.sh`](/Users/jiatwork/Works/nile/research/claude-code-switch/ccm.sh:1111), and [`ccm.sh`](/Users/jiatwork/Works/nile/research/claude-code-switch/ccm.sh:1190).

This makes `claude-code-switch` a **hybrid** reference:

- for provider switching, it is close to OpenCode-style config control
- for account switching, it is close to snapshot-and-restore

### 4. `cc-switch`

`cc-switch` is best understood as a **multi-app provider manager**, not a dedicated Claude account switcher. Its README positions it as one desktop app for Claude Code, Codex, Gemini CLI, OpenCode, and OpenClaw. See [`README.md`](/Users/jiatwork/Works/nile/research/cc-switch/README.md:130).

For Claude, its live sync path writes provider settings directly into Claude's settings file. The relevant code is [`config.rs`](/Users/jiatwork/Works/nile/research/cc-switch/src-tauri/src/services/config.rs:179), which writes `provider.settings_config` into the Claude settings path.

Its user manual also states that Claude switching updates `~/.claude/settings.json` and that Claude Code supports hot-reloading this configuration. See [`2.2-switch.md`](/Users/jiatwork/Works/nile/research/cc-switch/docs/user-manual/zh/2-providers/2.2-switch.md:57).

At the same time, `cc-switch` still knows how to read Claude OAuth credentials from:

- macOS Keychain service `Claude Code-credentials`
- `~/.claude/.credentials.json`

See [`subscription.rs`](/Users/jiatwork/Works/nile/research/cc-switch/src-tauri/src/services/subscription.rs:101).

That means `cc-switch` does touch Claude auth-related surfaces, but primarily for subscription/quota and provider management, not as a dedicated multi-account Claude subscription switcher.

## Cross-Project Pattern

The shared pattern is not "Claude always uses one file."

The shared pattern is:

- **account switchers** manipulate the Claude OAuth credential surface
- **provider switchers** manipulate Claude settings and/or shell environment

For Claude, those are separate concerns.

That is different from today's Codex community tools, where the dominant pattern is much more concentrated around the live auth file.

## Product Implications

For our own architecture, Claude should eventually support two distinct adapter modes:

1. **Claude Account Adapter**
   Save and activate Claude login states.
   Best references:
   - [`claude-swap`](/Users/jiatwork/Works/nile/research/claude-swap)
   - [`claude-switcher-tray`](/Users/jiatwork/Works/nile/research/claude-switcher-tray)
   - account part of [`claude-code-switch`](/Users/jiatwork/Works/nile/research/claude-code-switch)

2. **Claude Provider Adapter**
   Manage Anthropic-compatible endpoints/models/tokens through config or env.
   Best references:
   - [`claude-code-switch`](/Users/jiatwork/Works/nile/research/claude-code-switch)
   - [`cc-switch`](/Users/jiatwork/Works/nile/research/cc-switch)

If we collapse those two into one abstraction too early, we will end up mixing:

- login-state switching
- provider routing
- hot reload behavior
- subscription/quota observation

That should stay separated in the core model even if the desktop UI presents them together.

## Practical Takeaway

If we only want a future-proof framework:

- borrow **rollback + lock + backup** from `claude-swap`
- borrow **simple account snapshot UX** from `claude-switcher-tray`
- borrow **env/settings-based provider switching** from `claude-code-switch`
- borrow **desktop multi-client architecture** from `cc-switch`

This is enough to justify a multi-client-ready core where "Claude" is not a single adapter, but a client with at least two activation strategies.
