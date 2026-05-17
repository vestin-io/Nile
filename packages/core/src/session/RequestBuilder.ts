import type { AuthMode } from "../models/access/AuthMode";
import type { CurrentSessionSourceId } from "../models/connection/SourceTypes";
import { CURRENT_SESSION_SOURCE_REGISTRY } from "./Registry";
import type { CurrentSessionCredentialRequest } from "./Types";
import { INTERACTIVE_SESSION_LOGIN_REGISTRY } from "./Login";
import type { InteractiveSessionLoginRequest } from "./LoginTypes";

type CurrentSessionRequestInput = {
  authJsonPath?: string;
};

type SessionSourceSelection = "login" | CurrentSessionSourceId;

export class SessionCredentialRequestBuilder {
  buildInteractiveLogin(authMode: InteractiveSessionLoginRequest["authMode"]): InteractiveSessionLoginRequest {
    INTERACTIVE_SESSION_LOGIN_REGISTRY.read(authMode);
    return {
      authMode,
      source: "login",
    };
  }

  build(
    authMode: Exclude<AuthMode, "api_key" | "openclaw_openai_session">,
    source: SessionSourceSelection | undefined,
    input?: CurrentSessionRequestInput,
  ): CurrentSessionCredentialRequest | InteractiveSessionLoginRequest {
    if (source === "login") {
      return this.buildInteractiveLogin(authMode as InteractiveSessionLoginRequest["authMode"]);
    }
    if (source) {
      return this.buildCurrent(source, input);
    }
    return this.buildCurrentByAuthMode(authMode, input);
  }

  buildUpdate(
    authMode: Exclude<AuthMode, "api_key" | "openclaw_openai_session">,
    source: SessionSourceSelection | undefined,
    input?: CurrentSessionRequestInput,
  ): CurrentSessionCredentialRequest | InteractiveSessionLoginRequest | undefined {
    if (!source) {
      return undefined;
    }
    return this.build(authMode, source, input);
  }

  buildCurrentByAuthMode(
    authMode: CurrentSessionCredentialRequest["authMode"],
    input?: CurrentSessionRequestInput,
  ): CurrentSessionCredentialRequest {
    const manifests = CURRENT_SESSION_SOURCE_REGISTRY.list().filter((manifest) => manifest.authMode === authMode);
    if (manifests.length === 0) {
      throw new Error(`Unsupported current session auth mode: ${authMode}`);
    }
    if (manifests.length > 1) {
      throw new Error(`Ambiguous current session source for auth mode: ${authMode}`);
    }

    return this.buildCurrent(manifests[0].id, input);
  }

  private buildCurrent(
    source: CurrentSessionSourceId,
    input?: CurrentSessionRequestInput,
  ): CurrentSessionCredentialRequest {
    const manifest = CURRENT_SESSION_SOURCE_REGISTRY.read(source);
    return {
      authMode: manifest.authMode,
      source,
      ...(input?.authJsonPath ? { authJsonPath: input.authJsonPath } : {}),
    };
  }
}
