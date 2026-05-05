import type { AgentId } from "@nile/core/models/agent/types";

export const SUPPORTED_LANGUAGES = [
  "en",
  "zh",
  "ko",
  "ja",
  "th",
  "fr",
  "es",
  "it",
  "de",
  "vi",
] as const;

export type LanguagePreference = (typeof SUPPORTED_LANGUAGES)[number];
export type ThemePreference = "system" | "light" | "dark";
export type AgentOrderPreference = AgentId[];

export type DesktopPreferences = {
  agentOrder: AgentOrderPreference;
  language: LanguagePreference;
  quickSetupDismissed: boolean;
  theme: ThemePreference;
};

const STORAGE_KEY = "nile.desktop.preferences";
const DEFAULT_AGENT_ORDER: AgentOrderPreference = ["codex", "claude", "cursor", "openclaw"];

export class DesktopPreferencesStore {
  constructor(
    private readonly storage: Storage,
    private readonly root: HTMLElement,
  ) {}

  load(): DesktopPreferences {
    const fallback: DesktopPreferences = {
      agentOrder: [...DEFAULT_AGENT_ORDER],
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
  return typeof value === "string" && SUPPORTED_LANGUAGES.includes(value as LanguagePreference)
    ? (value as LanguagePreference)
    : "en";
}

function normalizeThemePreference(value: unknown): ThemePreference {
  return value === "system" || value === "light" || value === "dark"
    ? value
    : "system";
}

function normalizeAgentOrder(value: unknown): AgentOrderPreference {
  if (!Array.isArray(value)) {
    return [...DEFAULT_AGENT_ORDER];
  }

  const knownAgents = new Set(DEFAULT_AGENT_ORDER);
  const uniqueAgents = value.filter(
    (agentId): agentId is AgentOrderPreference[number] =>
      typeof agentId === "string" && knownAgents.has(agentId as AgentOrderPreference[number]),
  ).filter((agentId, index, array) => array.indexOf(agentId) === index);

  for (const agentId of DEFAULT_AGENT_ORDER) {
    if (!uniqueAgents.includes(agentId)) {
      uniqueAgents.push(agentId);
    }
  }

  return uniqueAgents;
}
