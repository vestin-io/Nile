# Desktop V2 Wireframes

## Notes

- These are structural wireframes, not final visual design.
- Phase 1 is the menubar only.
- Settings wireframes are included as second-phase direction.

## Phase 1 Menubar

### Root Menu

```text
+--------------------------------------+
| Open Main Window                     |
|--------------------------------------|
| Codex                         >       |
| Claude                        >       |
| Cursor                        >       |
|--------------------------------------|
| Settings…                            |
| Quit                                 |
+--------------------------------------+
```

### Agent Submenu

```text
+--------------------------------------+
| Codex                                |
|--------------------------------------|
| ✓ default                            |
|   work                               |
|   personal                           |
+--------------------------------------+
```

### Agent Submenu: Another Example

```text
+--------------------------------------+
| Claude                               |
|--------------------------------------|
| ✓ team                               |
|   default                            |
+--------------------------------------+
```

### Agent Submenu: Empty State

```text
+--------------------------------------+
| Cursor                               |
|--------------------------------------|
|   No saved connections               |
+--------------------------------------+
```

## Menubar Rules

```text
- current connection stays at the top
- current connection is checked
- choosing another connection switches immediately
- no status badges
- no drift or error copy
- no import or rollback actions
- no add/remove flows
```

## Phase 2 Settings

### Settings Shell

```text
+----------------------------------------------------------------------------------+
| Nile                                                                     [macOS] |
+----------------------+-----------------------------------------------------------+
| Connections          |                                                           |
| Current Agent        |                                                           |
| History              |                                                           |
| Advanced             |                                                           |
|                      |                                                           |
|                      |                                                           |
+----------------------+-----------------------------------------------------------+
```

### Connections Page

```text
+----------------------------------------------------------------------------------+
| Nile / Connections                                                     [+ Add]   |
+----------------------+-----------------------------------------------------------+
| Connections          | Search: [_____________________________]                  |
| Current Agent        |                                                           |
| History              | +-----------------------------------+-------------------+ |
| Advanced             | | Saved Connections                 | Connection Detail | |
|                      | +-----------------------------------+-------------------+ |
|                      | | • OpenAI Work                     | OpenAI Work       | |
|                      | |   OpenAI Official                 |                   | |
|                      | |   API Key                         | Provider          | |
|                      | |   Selected by Codex              | OpenAI Official   | |
|                      | +-----------------------------------+-------------------+ |
|                      | |   Personal Session                | Family            | |
|                      | |   OpenAI                          | openai            | |
|                      | |   OpenAI session                  |                   | |
|                      | +-----------------------------------+-------------------+ |
|                      |                                                           |
|                      |                                       [Use for Codex]   | |
|                      |                                       [Use for Cursor]  | |
|                      |                                       [Use for Claude]  | |
|                      |                                       [Remove]          | |
+----------------------+-----------------------------------------------------------+
```

### Current Agent Page

```text
+----------------------------------------------------------------------------------+
| Nile / Current Agent                                                              |
+----------------------+-----------------------------------------------------------+
| Connections          | Agents: [Codex] [Cursor] [Claude]                        |
| Current Agent        |                                                           |
| History              | Saved State                 Live State                   |
| Advanced             | -------------------------------------------------------  |
|                      | OpenAI Work                  OpenAI Work                 |
|                      | OpenAI Official              OpenAI Official             |
|                      |                                                           |
|                      | Status: [Synced]                                         |
|                      |                                                           |
|                      | [Use Saved Connection] [Import Current] [Rollback Latest]|
+----------------------+-----------------------------------------------------------+
```

### History Page

```text
+----------------------------------------------------------------------------------+
| Nile / History                                                                    |
+----------------------+-----------------------------------------------------------+
| Connections          | Filters: [All Agents v] [All Statuses v]                 |
| Current Agent        |                                                           |
| History              | 2026-04-29 10:22Z  Codex  OpenAI Work  applied          |
| Advanced             | 2026-04-29 10:31Z  Codex  OpenAI Work  rolled_back      |
|                      |                                                           |
|                      | Detail                                                    |
|                      | Connection: OpenAI Work                                   |
|                      | Provider: OpenAI Official                                 |
|                      | Files: auth.json, config.toml                             |
|                      |                                                           |
|                      | [Rollback Latest Safe Change]                             |
+----------------------+-----------------------------------------------------------+
```

### Advanced Page

```text
+----------------------------------------------------------------------------------+
| Nile / Advanced                                                                   |
+----------------------+-----------------------------------------------------------+
| Connections          | Database   ~/.nile-switcher/switcher.sqlite              |
| Current Agent        | Codex Home ~/.codex                                      |
| History              | Cursor Home ~/.cursor                                    |
| Advanced             | Claude Home ~/.claude                                    |
|                      |                                                           |
|                      | [Refresh State]                                           |
+----------------------+-----------------------------------------------------------+
```

## Renderer Component Groups

### Phase 1

- `MenubarMenuBuilder`
- `AgentSubmenuBuilder`

### Phase 2

- `SettingsShell`
- `ConnectionsPage`
- `CurrentAgentPage`
- `HistoryPage`
- `AdvancedPage`

## Interaction Priorities

1. Menubar must make switching obvious.
2. Settings must absorb everything else.
