import type { AgentId } from "@nile/core/models/agent/types";

import type { Definition } from "../../shared/Definitions";

export type AddConnectionSubmitInput = {
  preset: Definition["preset"];
  authMode: Definition["supportedAuthModes"][number];
  label?: string;
  endpointUrl?: string;
  enabledAgents?: AgentId[];
  allowUndetectedGateway?: boolean;
  apiKeySource?: "direct" | "env_key";
  apiKey?: string;
  envKey?: string;
  openAiSessionSource?: "login" | "current_codex";
  openAiAuthJsonPath?: string;
  claudeSessionSource?: "login" | "current_claude";
};

export type AddConnectionPreparedSaveInput = {
  draftId: string;
  label?: string;
  enabledAgents?: AgentId[];
};

export type PreparedConnectionDraft = Awaited<
  ReturnType<typeof window.nileDesktop.connections.prepareConnectionDraft>
>;
