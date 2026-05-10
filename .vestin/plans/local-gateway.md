# Local Gateway

## Purpose

Local Gateway is a future runtime routing layer that can route model/API requests across multiple saved connections.

It is different from Profile Mode. Profile Mode chooses a workspace state. Local Gateway decides which backing connection should handle a specific request at runtime.

## Relationship To Profile Mode

The boundary is:

```text
Profile Mode = configuration shortcut
Local Gateway = runtime router
```

Profile Mode answers:

- which connection should this agent use by default?
- which home path should this agent use?

Local Gateway answers:

- when this request arrives, which backing connection should actually handle it?
- should the request use primary, fallback, overflow, or another route?

They are compatible if Local Gateway is represented as a saved connection. A profile can assign an agent to a gateway connection without knowing how the gateway routes internally.

## Conceptual Model

Recommended high-level model:

```text
Agent
-> selected connection
-> maybe a Local Gateway connection
-> gateway routing policy
-> backing saved connection
-> provider endpoint
```

Profile example:

```text
Company Profile
- Codex -> Company Gateway
- Claude -> Anthropic Work Account
- OpenClaw -> Company OpenAI
```

Gateway example:

```text
Company Gateway
- primary: OpenAI Work
- fallback: Azure Work
- overflow: Gateway Provider
```

## Core Concepts

### Gateway Connection

A gateway should appear to agents as a connection. This keeps agent selection and Profile Mode simple.

Conceptual shape:

```ts
type GatewayConnection = {
  id: string;
  name: string;
  routingPolicyId: string;
};
```

### Gateway Routing Policy

Routing policy belongs to the gateway, not to profiles.

Conceptual shape:

```ts
type GatewayRoutingPolicy = {
  id: string;
  name: string;
  routes: GatewayRoute[];
};

type GatewayRoute = {
  backingConnectionId: string;
  role: "primary" | "fallback" | "overflow";
  enabled: boolean;
};
```

Later policy dimensions may include:

- model capability
- provider health
- quota or usage availability
- latency
- cost
- time window
- workspace/project context

## Non-Goals For Profile Mode

Profile Mode should not store gateway routes.

Avoid this shape:

```text
Profile
-> Codex uses OpenAI before 17:00
-> Codex uses Personal after 17:00
```

That would make profiles responsible for request-time routing and time-based automation. It would mix environment selection with runtime policy.

Recommended separation:

```text
ProfileRule -> chooses/applies a profile
GatewayPolicy -> routes requests inside a selected gateway
```

## Apply And Routing Boundaries

Profile apply is low frequency and explicit:

```text
User applies profile
-> selected agent connection changes
```

Gateway routing is high frequency and request-time:

```text
Request arrives
-> gateway evaluates policy
-> selected backing connection handles request
```

These two flows should not call each other directly.

## Future Rule Relationship

Rules can exist in two different layers:

- `ProfileRule`: when to suggest or apply a workspace profile
- `GatewayPolicy`: how to route requests inside a gateway

Example:

```text
ProfileRule:
  weekdays 09:00-17:00 -> apply Company Profile

GatewayPolicy:
  Company Gateway -> primary OpenAI Work, fallback Azure Work
```

This keeps time-based workspace switching separate from request fallback behavior.

## Risks

- If Local Gateway is implemented as profile logic, profiles will become hard to reason about and hard to delete safely.
- If gateway policy mutates selected agent connections, users may lose a stable understanding of the current workspace state.
- If the gateway has access to credentials directly instead of going through saved connection references, it can duplicate credential handling and weaken secret boundaries.
- If routing becomes automatic without visible explanation, users may not understand which account handled a request.

## Design Guardrails

- Treat gateway as a connection-like abstraction from the agent/profile perspective.
- Keep backing connections as saved connection references.
- Keep routing policy outside Profile Mode.
- Keep routing decisions observable in logs/UI before enabling advanced automation.
- Do not implement automatic profile rules as part of the gateway MVP.

## Decisions

- Local Gateway is related to Profile Mode but not owned by it.
- Profile assignments should be able to target a gateway connection by `connectionId`.
- Gateway routing policy is a separate domain concept.
- Request-time routing must not silently mutate an agent's selected connection.
