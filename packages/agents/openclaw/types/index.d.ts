import type { AgentAdapter } from "@nile/core/models/agent";
import type { AgentModule } from "@nile/core/models/agent/module";
import type { AgentManifestDefinition } from "@nile/core/models/agent/registry";
import type { AgentProjectionRegistration } from "@nile/core/projection";
import type { AgentFactoryRegistration } from "@nile/core/runtime-local/Types";

export declare const OPENCLAW_AGENT_ID: "openclaw";
export declare const OPENCLAW_DECLARATION: import("@nile/core/models/agent/registry").AgentDeclarationDefinition;
export declare const OPENCLAW_MANIFEST: AgentManifestDefinition;
export declare const OPENCLAW_RUNTIME_FACTORY: AgentFactoryRegistration;
export declare const OPENCLAW_PROJECTION: AgentProjectionRegistration;
export declare const OPENCLAW_AGENT_MODULE: AgentModule;

export declare class OpenClawAgentAdapter implements AgentAdapter {}
