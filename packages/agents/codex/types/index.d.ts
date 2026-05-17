import type { AgentAdapter } from "@nile/core/models/agent";
import type { AgentModule } from "@nile/core/models/agent/module";
import type { AgentManifestDefinition } from "@nile/core/models/agent/registry";
import type { AgentProjectionRegistration } from "@nile/core/projection";
import type { AgentFactoryRegistration } from "@nile/core/runtime-local/Types";
import type { CurrentSessionSourceManifest, InteractiveSessionLoginManifest } from "@nile/core/session";
import type { StoredCredential } from "@nile/core/services/credential";
import type { EnvironmentSource } from "@nile/core/services/EnvironmentSource";

export declare const CODEX_AGENT_ID: "codex";
export declare const CODEX_DECLARATION: import("@nile/core/models/agent/registry").AgentDeclarationDefinition;
export declare const CODEX_MANIFEST: AgentManifestDefinition;
export declare const CODEX_RUNTIME_FACTORY: AgentFactoryRegistration;
export declare const CODEX_CURRENT_SESSION_SOURCE: CurrentSessionSourceManifest;
export declare const CODEX_LOGIN_DECLARATION: {
  readonly authMode: "openai_session";
  readonly label: "Sign in with Codex";
  readonly interactionMode: "browser_oauth";
};
export declare const CODEX_LOGIN_SOURCE: InteractiveSessionLoginManifest;
export declare const CODEX_PROJECTION: AgentProjectionRegistration;
export declare const CODEX_AGENT_MODULE: AgentModule;

export declare class CodexAgentAdapter implements AgentAdapter {}
export declare class CodexSessionLogin {
  constructor(environment?: EnvironmentSource, spawn?: unknown);
  signIn(codexHome: string): Promise<void>;
  signInAndRead(codexHome: string): Promise<StoredCredential>;
}
