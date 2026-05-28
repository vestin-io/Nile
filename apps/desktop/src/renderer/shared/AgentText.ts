import type { Translator } from "./I18n";

export function formatEnvBackedApiKeyRequirement(agentLabel: string, t: Translator): string {
  return t("agents.model.openclawEnvKeyRequired").replaceAll("OpenClaw", agentLabel);
}

export function formatModelUnavailable(agentLabel: string, t: Translator): string {
  return t("quickSetup.openclawModelUnavailable").replaceAll("OpenClaw", agentLabel);
}
