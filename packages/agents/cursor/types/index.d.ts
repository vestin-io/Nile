import type { AgentAdapter } from "@nile/core/models/agent";
import type { AgentModule } from "@nile/core/models/agent/module";
import type { AgentManifestDefinition } from "@nile/core/models/agent/registry";
import type { AgentProjectionRegistration } from "@nile/core/projection";
import type { AgentFactoryRegistration } from "@nile/core/runtime-local/Types";
import type { CurrentSessionSourceManifest } from "@nile/core/session";

export declare const CURSOR_AGENT_ID: "cursor";
export declare const CURSOR_DECLARATION: import("@nile/core/models/agent/registry").AgentDeclarationDefinition;
export declare const CURSOR_MANIFEST: AgentManifestDefinition;
export declare const CURSOR_RUNTIME_FACTORY: AgentFactoryRegistration;
export declare const CURSOR_CURRENT_SESSION_SOURCE: CurrentSessionSourceManifest;
export declare const CURSOR_PROJECTION: AgentProjectionRegistration;
export declare const CURSOR_AGENT_MODULE: AgentModule;

export declare class CursorAgentAdapter implements AgentAdapter {}
