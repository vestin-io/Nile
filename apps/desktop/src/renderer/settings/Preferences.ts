import { SUPPORTED_AGENT_IDS, type AgentId } from "@nile/core/models/agent/definitions";
import {
  LANGUAGE_SELF_LABELS,
  SUPPORTED_LANGUAGES,
  normalizeLanguagePreference as normalizeStoredLanguagePreference,
  type LanguagePreference,
  type ThemePreference,
} from "../../state/UiPreferences";
import {
  normalizeConnectionQuotaMetricPreferences,
  type ConnectionQuotaMetricPreferences,
} from "../../state/ConnectionQuotaMetricPreferences";

export type AgentOrderPreference = AgentId[];

export type DesktopPreferences = {
  agentOrder: AgentOrderPreference;
  connectionQuotaMetricPreferences: ConnectionQuotaMetricPreferences;
  language: LanguagePreference;
  quickSetupDismissed: boolean;
  theme: ThemePreference;
};

const STORAGE_KEY = "nile.desktop.preferences";
export { SUPPORTED_LANGUAGES };
export { LANGUAGE_SELF_LABELS };
export type { LanguagePreference, ThemePreference };

function readDefaultAgentOrder(): AgentOrderPreference {
  return [...SUPPORTED_AGENT_IDS];
}

export class DesktopPreferencesStore {
  constructor(
    private readonly storage: Storage,
    private readonly root: HTMLElement,
  ) {}

  load(): DesktopPreferences {
    const fallback: DesktopPreferences = {
      agentOrder: readDefaultAgentOrder(),
      connectionQuotaMetricPreferences: {},
      language: "en",
      quickSetupDismissed: false,
      theme: "system",
    };
    const raw = this.storage.getItem(STORAGE_KEY);
    if (!raw) {
      return fallback;
    }

    try {
      const parsed = JSON.parse(raw) as Partial<DesktopPreferences>;
      return {
        agentOrder: normalizeAgentOrder(parsed.agentOrder),
        connectionQuotaMetricPreferences: normalizeConnectionQuotaMetricPreferences(
          parsed.connectionQuotaMetricPreferences,
        ),
        language: normalizeLanguagePreference(parsed.language),
        quickSetupDismissed: parsed.quickSetupDismissed === true,
        theme: normalizeThemePreference(parsed.theme),
      };
    } catch {
      return fallback;
    }
  }

  save(preferences: DesktopPreferences) {
    this.storage.setItem(STORAGE_KEY, JSON.stringify(preferences));
    window.dispatchEvent(new CustomEvent("nile:preferences-changed"));
  }

  applyTheme(theme: ThemePreference) {
    const prefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
    const resolvedTheme = theme === "system" ? (prefersDark ? "dark" : "light") : theme;
    this.root.dataset.theme = theme;
    this.root.classList.toggle("dark", resolvedTheme === "dark");
    this.root.style.colorScheme = resolvedTheme;
  }

  subscribe(callback: () => void) {
    const onStorage = (event: StorageEvent) => {
      if (event.key === STORAGE_KEY || event.key === null) {
        callback();
      }
    };
    const onCustom = () => callback();

    window.addEventListener("storage", onStorage);
    window.addEventListener("nile:preferences-changed", onCustom);
    return () => {
      window.removeEventListener("storage", onStorage);
      window.removeEventListener("nile:preferences-changed", onCustom);
    };
  }
}

function normalizeLanguagePreference(value: unknown): LanguagePreference {
  return normalizeStoredLanguagePreference(value);
}

function normalizeThemePreference(value: unknown): ThemePreference {
  return value === "system" || value === "light" || value === "dark"
    ? value
    : "system";
}

function normalizeAgentOrder(value: unknown): AgentOrderPreference {
  const defaultAgentOrder = readDefaultAgentOrder();
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
