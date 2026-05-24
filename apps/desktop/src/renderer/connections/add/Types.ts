import type { AgentId } from "@nile/core/models/agent/definitions";
import type { CredentialStorageBackend } from "@nile/core/services/credential";

import type { Definition } from "../../shared/DesktopData";

export type AddConnectionSubmitInput = {
  preset: Definition["preset"];
  authMode: Definition["supportedAuthModes"][number];
  label?: string;
  endpointUrl?: string;
  enabledAgents?: AgentId[];
  allowUndetectedGateway?: boolean;
  credentialStorageBackend: CredentialStorageBackend;
  encryptedLocalPassphrase?: string;
  apiKeySource?: "direct" | "env_key";
  apiKey?: string;
  envKey?: string;
  sessionSource?: "login" | "current_codex" | "current_claude" | "current_gemini" | "current_cursor";
  sessionAuthJsonPath?: string;
};

export type AddConnectionPreparedSaveInput = {
  draftId: string;
  label?: string;
  enabledAgents?: AgentId[];
};

export type PreparedConnectionDraft = Awaited<
  ReturnType<typeof window.nileDesktop.connections.prepareConnectionDraft>
>;
