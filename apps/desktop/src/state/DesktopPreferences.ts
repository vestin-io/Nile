import { SUPPORTED_AGENT_IDS, type AgentId } from "@nile/core/models/agent/Definitions";
import type { CredentialStorageBackend } from "@nile/core/services/credential";

import {
  normalizeConnectionQuotaMetricPreferences,
  type ConnectionQuotaMetricPreferences,
} from "./ConnectionQuotaMetricPreferences";
import { normalizeLanguagePreference, type LanguagePreference, type ThemePreference } from "./UiPreferences";

export type AgentOrderPreference = AgentId[];

export type DesktopPreferences = {
  agentOrder: AgentOrderPreference;
  credentialStorageMode: CredentialStorageBackend | null;
  connectionQuotaMetricPreferences: ConnectionQuotaMetricPreferences;
  language: LanguagePreference;
  quickSetupDismissed: boolean;
  theme: ThemePreference;
};

const SUPPORTED_CREDENTIAL_STORAGE_BACKENDS: CredentialStorageBackend[] = [
  "system_secure_storage",
  "encrypted_local_storage",
];

export function readDefaultDesktopPreferences(): DesktopPreferences {
  return {
    agentOrder: [...SUPPORTED_AGENT_IDS],
    credentialStorageMode: null,
    connectionQuotaMetricPreferences: {},
    language: "en",
    quickSetupDismissed: false,
    theme: "system",
  };
}

export function normalizeDesktopPreferences(value: unknown): DesktopPreferences {
  const fallback = readDefaultDesktopPreferences();
  if (!value || typeof value !== "object") {
    return fallback;
  }

  const parsed = value as Partial<DesktopPreferences>;
  return {
    agentOrder: normalizeAgentOrder(parsed.agentOrder),
    credentialStorageMode: normalizeCredentialStorageBackendPreference(parsed.credentialStorageMode),
    connectionQuotaMetricPreferences: normalizeConnectionQuotaMetricPreferences(parsed.connectionQuotaMetricPreferences),
    language: normalizeLanguagePreference(parsed.language),
    quickSetupDismissed: parsed.quickSetupDismissed === true,
    theme: normalizeThemePreference(parsed.theme),
  };
}

export function parseDesktopPreferences(value: string | null): DesktopPreferences {
  if (!value) {
    return readDefaultDesktopPreferences();
  }

  try {
    return normalizeDesktopPreferences(JSON.parse(value));
  } catch {
    return readDefaultDesktopPreferences();
  }
}

export function serializeDesktopPreferences(preferences: DesktopPreferences): string {
  return JSON.stringify(normalizeDesktopPreferences(preferences));
}

function normalizeThemePreference(value: unknown): ThemePreference {
  return value === "system" || value === "light" || value === "dark"
    ? value
    : "system";
}

function normalizeAgentOrder(value: unknown): AgentOrderPreference {
  const defaultAgentOrder = [...SUPPORTED_AGENT_IDS];
  if (!Array.isArray(value)) {
    return defaultAgentOrder;
  }

  const knownAgents = new Set(defaultAgentOrder);
  const uniqueAgents = value.filter(
    (agentId): agentId is AgentOrderPreference[number] =>
      typeof agentId === "string" && knownAgents.has(agentId as AgentOrderPreference[number]),
  ).filter((agentId, index, array) => array.indexOf(agentId) === index);

  for (const agentId of defaultAgentOrder) {
    if (!uniqueAgents.includes(agentId)) {
      uniqueAgents.push(agentId);
    }
  }

  return uniqueAgents;
}

function normalizeCredentialStorageBackendPreference(
  value: unknown,
): CredentialStorageBackend | null {
  if (value === null || value === undefined) {
    return null;
  }

  return typeof value === "string"
    && SUPPORTED_CREDENTIAL_STORAGE_BACKENDS.includes(value as CredentialStorageBackend)
    ? value as CredentialStorageBackend
    : null;
}
