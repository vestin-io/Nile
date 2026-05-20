import type { AgentId } from "./Definitions";

export type AgentRuntimeCommandOverrides = Partial<Record<AgentId, string>>;
