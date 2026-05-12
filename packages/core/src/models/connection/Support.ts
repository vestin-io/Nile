import type { AuthMode } from "../access";
import type { EndpointProtocols } from "../endpoint";
import type { ConnectionPresetFamily } from "./setup/PresetTypes";

export type ConnectionSupportKind =
  | "openai-api-key"
  | "anthropic-api-key"
  | "cursor-api-key"
  | "openai-session"
  | "claude-session"
  | "cursor-session";

type ConnectionSupportProtocols = Pick<EndpointProtocols, "openai" | "anthropic" | "cursor">;

type ReadSavedKindsInput = {
  protocols: ConnectionSupportProtocols;
  authMode: AuthMode;
};

type ReadSelectableKindsInput = {
  preset: ConnectionPresetFamily;
  authMode: AuthMode;
};

export class ConnectionSupportKinds {
  readDetectedApiKeyKinds(protocols: ConnectionSupportProtocols): ConnectionSupportKind[] {
    const kinds: ConnectionSupportKind[] = [];
    if (protocols.openai) {
      kinds.push("openai-api-key");
    }
    if (protocols.anthropic) {
      kinds.push("anthropic-api-key");
    }
    if (protocols.cursor) {
      kinds.push("cursor-api-key");
    }
    return kinds;
  }

  readSavedKinds(input: ReadSavedKindsInput): ConnectionSupportKind[] {
    switch (input.authMode) {
      case "api_key":
        return this.readDetectedApiKeyKinds(input.protocols);
      case "openai_session":
        return input.protocols.openai ? ["openai-session"] : [];
      case "claude_session":
        return input.protocols.anthropic ? ["claude-session"] : [];
      case "cursor_session":
        return input.protocols.cursor ? ["cursor-session"] : [];
      default:
        return [];
    }
  }

  readSelectableKinds(input: ReadSelectableKindsInput): ConnectionSupportKind[] {
    switch (input.authMode) {
      case "api_key":
        return this.readSelectableApiKeyKinds(input.preset);
      case "openai_session":
        return input.preset === "openai" ? ["openai-session"] : [];
      case "claude_session":
        return input.preset === "anthropic" ? ["claude-session"] : [];
      case "cursor_session":
        return input.preset === "gateway" ? ["cursor-session"] : [];
      default:
        return [];
    }
  }

  private readSelectableApiKeyKinds(
    preset: ConnectionPresetFamily,
  ): ConnectionSupportKind[] {
    switch (preset) {
      case "openai":
      case "azure-openai":
        return ["openai-api-key"];
      case "anthropic":
        return ["anthropic-api-key"];
      case "gateway":
        return ["openai-api-key", "anthropic-api-key", "cursor-api-key"];
      default:
        return [];
    }
  }
}

export const CONNECTION_SUPPORT_KINDS = new ConnectionSupportKinds();
