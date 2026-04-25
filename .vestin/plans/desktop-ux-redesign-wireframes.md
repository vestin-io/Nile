# Desktop UX Redesign Wireframes

## Notes

- These are structural wireframes, not final visuals.
- The main change is task separation.
- Menubar stays minimal.
- The main window becomes a tabbed control surface with clearer task ownership.

## Main Window Shell

```text
+--------------------------------------------------------------------------------------------------+
| Nile                                                                                   [macOS]  |
+----------------------------+---------------------------------------------------------------------+
| Home                       |                                                                     |
| Agents                     |                                                                     |
| Connections                |                                                                     |
| History                    |                                                                     |
|                            |                                                                     |
|                            |                                                                     |
|                            |                                                                     |
|                            |                                                                     |
|----------------------------|                                                                     |
| Settings                   |                                                                     |
+----------------------------+---------------------------------------------------------------------+
```

## Home Tab

```text
+--------------------------------------------------------------------------------------------------+
| Nile / Home                                                                          [Refresh]  |
| See what Nile is currently using, and which agent needs attention.                              |
+--------------------------------------------------------------------------------------------------+
| [Codex]                          [Cursor]                         [Claude]                       |
| OpenAI Work                      Cursor Default                   Not configured                 |
| weekly 30% left                  No usage                         Needs attention                |
| [Synced]                         [Synced]                         [Fix]                          |
| [Switch]                         [Switch]                         [Import]                       |
+--------------------------------------------------------------------------------------------------+
| Recent changes                                                                                    |
| 17:04  Codex   OpenAI Work    applied                                                          |
| 16:51  Cursor  Cursor Default applied                                                          |
| 16:18  Claude  Team Session   rolled back                                                     |
+--------------------------------------------------------------------------------------------------+
```

## Connections Tab

```text
+--------------------------------------------------------------------------------------------------+
| Nile / Connections                                               [Scan local setups] [+ Add]    |
| Manage the connections Nile has already saved.                                                    |
+-------------------------------------+------------------------------------------------------------+
| Saved connections                   | OpenAI Work                                                |
|-------------------------------------|------------------------------------------------------------|
| • OpenAI Work                       | Provider           OpenAI Official                         |
|   OpenAI Official                   | Family             openai                                  |
|   OpenAI session                    | Auth               OpenAI session                          |
|   Used by Codex                     | Compatible agents  Codex                                   |
|-------------------------------------|                                                            |
| • Cursor Default                    | Selected by        Codex                                   |
|   Cursor                            |                                                            |
|   cursor_session                    | [Use for Codex]                                           |
|-------------------------------------| [Use for Cursor]                                          |
| • Team Session                      | [Use for Claude]                                          |
|   Anthropic                         | [Remove]                                                  |
|   claude_session                    |                                                            |
+-------------------------------------+------------------------------------------------------------+
```

## Add Connection Modal

```text
+----------------------------------------------------------------------------------+
| Add connection                                                            [x]    |
| Save a new connection Nile can switch between.                                     |
|----------------------------------------------------------------------------------|
| Provider family     [ OpenAI v ]                                                  |
| Auth mode           [ Use OpenAI session v ]                                      |
| Label               [ Optional label________________________ ]                    |
| Session source      [ Sign in with OpenAI v ]                                     |
|----------------------------------------------------------------------------------|
|                                                       [Cancel] [Add connection]  |
+----------------------------------------------------------------------------------+
```

## Scan Local Setups Sheet

```text
+----------------------------------------------------------------------------------+
| Scan local setups                                                         [x]    |
| Nile found existing local setups on this machine.                                  |
|----------------------------------------------------------------------------------|
| [x] Codex   OpenAI-Compatible API Key                                             |
|     new                                                                            |
|----------------------------------------------------------------------------------|
| [ ] Claude  No local setup                                                        |
|     invalid                                                                        |
|----------------------------------------------------------------------------------|
| [ ] Cursor  Cursor Session                                                        |
|     invalid                                                                        |
|----------------------------------------------------------------------------------|
|                                                    [Cancel] [Import selected]    |
+----------------------------------------------------------------------------------+
```

## Agents Tab

```text
+--------------------------------------------------------------------------------------------------+
| Nile / Agents                                                                          [Refresh] |
| Inspect one agent at a time and fix drift without noise from unrelated agents.                   |
+--------------------------------------------------------------------------------------------------+
| Agents:  [Codex] [Cursor] [Claude]                                                              |
+--------------------------------------+-----------------------------------------------------------+
| Saved selection                      | Live local setup                                          |
| OpenAI Work                          | OpenAI Work                                               |
| OpenAI Official                      | OpenAI Official                                           |
+--------------------------------------+-----------------------------------------------------------+
| Status                               | Actions                                                   |
| [Synced]                             | [Use saved connection]                                    |
| Current local setup matches a saved  | [Import current setup]                                    |
| Nile connection.                     | [Rollback latest change]                                  |
+--------------------------------------+-----------------------------------------------------------+
| Compatible connections                                                                         |
| • OpenAI Work                                                                  [Current]       |
| • OpenAI Personal                                                              [Use]           |
+--------------------------------------------------------------------------------------------------+
```

## History Tab

```text
+--------------------------------------------------------------------------------------------------+
| Nile / History                                                                      [All v]     |
| Review Nile-originated changes and rollback context.                                            |
+--------------------------------------------------------------------------------------------------+
| 17:04  Codex   OpenAI Work     applied                                                           |
| 16:51  Cursor  Cursor Default  applied                                                           |
| 16:18  Claude  Team Session    rolled back                                                       |
|--------------------------------------------------------------------------------------------------|
| Selected entry                                                                                    |
| Connection     OpenAI Work                                                                        |
| Provider       OpenAI Official                                                                    |
| Files          auth.json, config.toml                                                             |
| Status         applied                                                                            |
|                                                                                                   |
|                                                            [Rollback latest change]              |
+--------------------------------------------------------------------------------------------------+
```

## Settings Entry

```text
+--------------------------------------------------------------------------------------------------+
| Nile / Settings                                                                                  |
| Low-frequency local configuration and diagnostics.                                               |
+--------------------------------------------------------------------------------------------------+
| Database path            ~/.nile-switcher/switcher.sqlite                                        |
| Saved connections        4                                                                        |
| Importable setups        1                                                                        |
| Supported agents         Codex, Cursor, Claude                                                   |
|--------------------------------------------------------------------------------------------------|
| Agent homes                                                                                      |
| Codex                  ~/.codex                                                                  |
| Cursor                 ~/.cursor                                                                 |
| Claude                 ~/.claude                                                                 |
+--------------------------------------------------------------------------------------------------+
```

## First-Run: One Importable Setup

```text
+--------------------------------------------------------------------------------------------------+
| Nile / First Run                                                                                 |
| Nile found your local setup on this machine.                                                     |
+--------------------------------------------------------------------------------------------------+
| Codex                                                                                             |
| OpenAI-Compatible API Key                                                                         |
| Ready to import                                                                                   |
|--------------------------------------------------------------------------------------------------|
|                                                   [Set up manually] [Import and continue]       |
+--------------------------------------------------------------------------------------------------+
```

## First-Run: Multiple Importable Setups

```text
+--------------------------------------------------------------------------------------------------+
| Nile / First Run                                                                                 |
| Choose which local setups to save into Nile.                                                     |
+--------------------------------------------------------------------------------------------------+
| [x] Codex    OpenAI-Compatible API Key                                                            |
| [x] Claude   Team Session                                                                         |
| [ ] Cursor   Cursor Session                                                                       |
|--------------------------------------------------------------------------------------------------|
|                                                       [Set up manually] [Import selected]       |
+--------------------------------------------------------------------------------------------------+
```

## First-Run: No Importable Setups

```text
+--------------------------------------------------------------------------------------------------+
| Nile / First Run                                                                                 |
| No local setups found yet.                                                                       |
| Sign into a supported agent first, or add a connection manually.                                 |
+--------------------------------------------------------------------------------------------------+
|                                                           [Add connection] [Not now]            |
+--------------------------------------------------------------------------------------------------+
```

## Interaction Summary

1. `Home` is the normal overview page.
2. `Agents` is a one-agent diagnosis page.
3. `Connections` is for managing saved connections only.
4. `Add connection` is modal, not embedded.
5. `Scan local setups` is a reusable import sheet, not a permanent page section.
6. `History` is a timeline.
7. `Settings` is low-frequency.
