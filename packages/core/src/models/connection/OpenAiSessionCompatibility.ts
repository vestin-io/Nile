import type { AuthMode } from "../access";
import type { StoredCredential } from "../../services/credential/Types";

export class OpenAiSessionCompatibility {
  static includes(authMode: AuthMode): boolean {
    return authMode === "openai_session" || authMode === "openclaw_openai_session";
  }

  static matches(left: AuthMode, right: AuthMode): boolean {
    return left === right || (this.includes(left) && this.includes(right));
  }

  static readCanonicalAuthMode(existing: AuthMode, incoming: AuthMode): AuthMode {
    if (this.includes(existing) && this.includes(incoming)) {
      return "openai_session";
    }
    return incoming;
  }

  static shouldPreserveStoredCredential(
    existing: AuthMode,
    incomingCredential: StoredCredential,
  ): boolean {
    return existing === "openai_session" && incomingCredential.kind === "openclaw_openai_session";
  }

  static readPreferredSavedAuthMode(candidates: readonly AuthMode[]): AuthMode | null {
    return candidates.includes("openai_session") ? "openai_session" : null;
  }
}
