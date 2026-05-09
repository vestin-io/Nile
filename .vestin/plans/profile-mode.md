# Profile Mode

## Purpose

Profile Mode is a manual shortcut for applying a named multi-agent workspace state.

It exists to reduce repeated per-agent setup work. Instead of changing each agent one by one, the user can click one profile and apply the saved connection and home-path choices for multiple agents at once.

## MVP Scope

Profile Mode only manages two per-agent values:

- which saved connection each agent should use
- which home path override each agent should use

Profile Mode does not manage:

- credentials or secret values
- endpoint definitions
- model choices
- usage data
- provider account mutation rules
- automatic switching rules

## Display Rule

The desktop UI should only expose Profile Mode when it has real value:

- at least two agents exist
- at least two agents have usable saved connections

Agent home-path overrides should not be required for showing Profile Mode. Home paths are an enhancement to the profile payload, not the primary reason Profile Mode exists.

## Core Concepts

### WorkspaceProfile

A `WorkspaceProfile` is a named set of optional per-agent assignments.

Conceptual shape:

```ts
type WorkspaceProfile = {
  id: string;
  name: string;
  assignments: WorkspaceProfileAssignment[];
};

type WorkspaceProfileAssignment = {
  agentId: AgentId;
  connectionId?: string;
  homePath?: string | null;
};
```

An assignment field is optional. If a profile assignment omits `connectionId`, applying the profile must not change that agent's selected connection. If it omits `homePath`, applying the profile must not change that agent's home path.

If `homePath` is `null`, applying the profile resets that agent to its default home path. This lets profiles switch cleanly between a custom home profile and a default-home profile.

## Apply Semantics

Applying a profile is an explicit user action.

Conceptual flow:

```text
User clicks Apply Profile
-> validate profile assignments
-> for each assignment with homePath:
     update that agent home override
-> for each assignment with connectionId:
     switch agent to that saved connection
-> refresh desktop state
-> show apply result
```

Profile application should not delete anything. It mutates the current selected connection/home state for agents, using existing desktop/core mutation paths.

Home path updates run before connection switches so agent config mutations are written into the target home directory, not the previous one.

## Delete Semantics

Deleting a profile deletes only the profile record.

It must not delete:

- saved connections
- credentials
- agents
- agent current selections
- agent home path overrides

If future profile rules reference the deleted profile, those rules should become invalid or disabled rather than cascading deletion into other domain data.

## Interaction Model

MVP actions:

- create profile from current agent state
- apply profile
- rename profile
- delete profile

Optional later actions:

- edit individual agent assignments inside a profile
- duplicate profile
- detect invalid assignments
- show profile diff before apply

## Boundaries

Profile Mode should live above existing agent/connection/home mutation capabilities. It is an orchestration shortcut, not a new source of truth for credentials or endpoint data.

Recommended boundary:

```text
Desktop UI
-> Profile orchestration
-> existing connection switch mutation
-> existing agent home update mutation
-> refresh state
```

Profile code should not know how credentials are stored. It should only reference saved `connectionId` values and call existing mutation services.

## Future Rules

Future automatic or suggested profile selection should be modeled separately from the profile itself.

Recommended future concept:

```ts
type ProfileRule = {
  id: string;
  name: string;
  enabled: boolean;
  trigger: ProfileRuleTrigger;
  targetProfileId: string;
};
```

The boundary is:

```text
Profile = what to apply
Rule = when to suggest or apply it
Apply = explicit user action, or a future user-authorized automatic action
```

Rules should reference profiles by ID. They should not be embedded inside profile records. This keeps a profile reusable across multiple triggers and avoids turning Profile Mode into a rule engine.

## Compatibility With Local Gateway

Profile assignments should point to saved `connectionId` values only.

If Local Gateway later becomes a connection type, profiles can select that gateway connection the same way they select any other connection. Profile Mode must not own gateway routing policy.

## Risks

- If profile records store too much state, Profile Mode will become a second settings system.
- If profile application bypasses existing switch/home mutation paths, it can drift from normal agent behavior.
- If automatic rules are added too early, the feature can violate Nile's current explicit-switching principle.

## Decisions

- Use `WorkspaceProfile` as the implementation-domain name to avoid conflict with existing endpoint `profile`.
- Keep MVP manual-only.
- Keep assignments sparse and optional.
- Keep deletion non-cascading.
- Keep future rules separate from profile records.
