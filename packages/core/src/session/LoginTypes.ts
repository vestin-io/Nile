import type { AgentHomes } from "../models/agent/Homes";
import type { EnvironmentSource } from "../services/EnvironmentSource";
import type { StoredCredential } from "../services/credential/Types";

export type InteractiveSessionLoginRequest =
  | {
      authMode: "openai_session";
      source: "login";
      authJsonPath?: string;
    }
  | {
      authMode: "claude_session";
      source: "login";
    }
  | {
      authMode: "gemini_cli_session";
      source: "login";
    };

export type InteractiveSessionLoginStoredCredential = Extract<
  StoredCredential,
  | { kind: "openai_session" }
  | { kind: "claude_session" }
  | { kind: "gemini_cli_session" }
>;

export type InteractiveSessionLoginInteractionMode =
  | "browser_oauth"
  | "terminal_interactive";

export type InteractiveSessionLoginContext = {
  agentHomes: AgentHomes | undefined;
  environment: EnvironmentSource;
  openExternalUrl?: (url: string) => Promise<void>;
};

export type InteractiveSessionLoginManifest = {
  authMode: InteractiveSessionLoginRequest["authMode"];
  label: string;
  interactionMode: InteractiveSessionLoginInteractionMode;
  signInAndRead(
    context: InteractiveSessionLoginContext,
    request: InteractiveSessionLoginRequest,
  ): Promise<InteractiveSessionLoginStoredCredential>;
};
