import type { AgentAdapter } from "@nile/core/models/agent";
import type { AgentModule } from "@nile/core/models/agent/module";
import type { AgentManifestDefinition } from "@nile/core/models/agent/registry";
import type { AgentProjectionRegistration } from "@nile/core/projection";
import type { AgentFactoryRegistration } from "@nile/core/runtime-local/Types";

export declare const OPENCODE_AGENT_ID: "opencode";
export declare const OPENCODE_DECLARATION: import("@nile/core/models/agent/registry").AgentDeclarationDefinition;
export declare const OPENCODE_MANIFEST: AgentManifestDefinition;
export declare const OPENCODE_RUNTIME_FACTORY: AgentFactoryRegistration;
export declare const OPENCODE_PROJECTION: AgentProjectionRegistration;
export declare const OPENCODE_AGENT_MODULE: AgentModule;

export declare class OpenCodeAgentAdapter implements AgentAdapter {}
