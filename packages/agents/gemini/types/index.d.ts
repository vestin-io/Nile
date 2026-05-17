import type { AgentAdapter } from "@nile/core/models/agent";
import type { AgentModule } from "@nile/core/models/agent/module";
import type { AgentManifestDefinition } from "@nile/core/models/agent/registry";
import type { AgentProjectionRegistration } from "@nile/core/projection";
import type { AgentFactoryRegistration } from "@nile/core/runtime-local/Types";
import type { CurrentSessionSourceManifest } from "@nile/core/session";
import type { InteractiveSessionLoginManifest } from "@nile/core/session";

export declare const GEMINI_AGENT_ID: "gemini";
export declare const GEMINI_DECLARATION: import("@nile/core/models/agent/registry").AgentDeclarationDefinition;
export declare const GEMINI_MANIFEST: AgentManifestDefinition;
export declare const GEMINI_RUNTIME_FACTORY: AgentFactoryRegistration;
export declare const GEMINI_CURRENT_SESSION_SOURCE: CurrentSessionSourceManifest;
export declare const GEMINI_LOGIN_DECLARATION: {
  readonly authMode: "gemini_cli_session";
  readonly label: "Sign in with Gemini";
  readonly interactionMode: "terminal_interactive";
};
export declare const GEMINI_LOGIN_SOURCE: InteractiveSessionLoginManifest;
export declare const GEMINI_PROJECTION: AgentProjectionRegistration;
export declare const GEMINI_AGENT_MODULE: AgentModule;

export declare class GeminiAgentAdapter implements AgentAdapter {}
export declare class GeminiSessionLogin {}
