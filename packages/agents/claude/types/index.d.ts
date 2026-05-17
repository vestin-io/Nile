import type { LocalModelCatalogSourceManifest } from "@nile/core/application/local/model-catalog-source";
import type { AgentAdapter } from "@nile/core/models/agent";
import type { AgentModule } from "@nile/core/models/agent/module";
import type { AgentManifestDefinition } from "@nile/core/models/agent/registry";
import type { AgentProjectionRegistration } from "@nile/core/projection";
import type { AgentFactoryRegistration } from "@nile/core/runtime-local/Types";
import type { CurrentSessionSourceManifest, InteractiveSessionLoginManifest } from "@nile/core/session";
import type { ClaudeSessionCredential } from "@nile/core/services/credential";
import type { EnvironmentSource } from "@nile/core/services/EnvironmentSource";

export declare const CLAUDE_AGENT_ID: "claude";
export declare const CLAUDE_DECLARATION: import("@nile/core/models/agent/registry").AgentDeclarationDefinition;
export declare const CLAUDE_MANIFEST: AgentManifestDefinition;
export declare const CLAUDE_RUNTIME_FACTORY: AgentFactoryRegistration;
export declare const CLAUDE_CURRENT_SESSION_SOURCE: CurrentSessionSourceManifest;
export declare const CLAUDE_LOGIN_SOURCE: InteractiveSessionLoginManifest;
export declare const CLAUDE_MODEL_CATALOG_SOURCE: LocalModelCatalogSourceManifest;
export declare const CLAUDE_PROJECTION: AgentProjectionRegistration;
export declare const CLAUDE_AGENT_MODULE: AgentModule;

export declare class ClaudeAgentAdapter implements AgentAdapter {}
export declare class ClaudeSessionLogin {
  constructor(environment?: EnvironmentSource, spawn?: unknown);
  signIn(claudeHome: string): Promise<void>;
  signInAndRead(claudeHome: string): Promise<ClaudeSessionCredential>;
}
