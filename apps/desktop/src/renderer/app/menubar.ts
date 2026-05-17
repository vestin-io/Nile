import { registerBuiltinAgentDeclarations } from "@nile/builtins/agents";
import { createTranslator } from "../shared/I18n";
import { DesktopPreferencesStore } from "../settings/Preferences";
import { authModeLabel } from "../shared/DisplayText";

type MenubarState = Awaited<ReturnType<typeof window.nileDesktop.state.getMenubarState>>;

const preferencesStore = new DesktopPreferencesStore(window.localStorage, document.documentElement);
const currentElement = document.getElementById("menubar-current");
const driftElement = document.getElementById("menubar-drift");
const connectionsElement = document.getElementById("menubar-connections");
const settingsButton = document.getElementById("settings-button");
const refreshButton = document.getElementById("refresh-button");
const currentTitleElement = document.getElementById("menubar-current-title");
const switchTitleElement = document.getElementById("menubar-switch-title");

registerBuiltinAgentDeclarations();

function applyFramePreferences() {
  const preferences = preferencesStore.load();
  const t = createTranslator(preferences.language);
  preferencesStore.applyTheme(preferences.theme);
  if (currentTitleElement) {
    currentTitleElement.textContent = t("menubar.currentConnectionTitle");
  }
  if (driftElement) {
    driftElement.textContent = t("menubar.currentConnectionDrift");
  }
  if (switchTitleElement) {
    switchTitleElement.textContent = t("menubar.switchConnectionTitle");
  }
  if (refreshButton) {
    refreshButton.textContent = t("common.refresh");
  }
  if (settingsButton) {
    settingsButton.textContent = t("menubar.openSettings");
  }
}

async function render(): Promise<void> {
  const preferences = preferencesStore.load();
  const t = createTranslator(preferences.language);
  const state = await window.nileDesktop.state.getMenubarState();
  const codex = state.agents.find((agent) => agent.agentId === "codex") ?? state.agents[0] ?? null;
  renderCurrent(codex, t);
  renderConnections(codex, t);
}

function renderCurrent(
  agent: MenubarState["agents"][number] | null,
  t: ReturnType<typeof createTranslator>,
): void {
  if (!currentElement || !driftElement) {
    return;
  }

  currentElement.textContent = agent?.currentConnection
    ? `${agent.currentConnection.endpointLabel} / ${agent.currentConnection.label}${agent.currentUsage?.status === "available" ? ` · ${agent.currentUsage.text}` : ""}`
    : t("menubar.currentConnectionEmpty");

  driftElement.classList.add("is-hidden");
}

function renderConnections(
  agent: MenubarState["agents"][number] | null,
  t: ReturnType<typeof createTranslator>,
): void {
  if (!connectionsElement) {
    return;
  }

  if (!agent || agent.connections.length === 0) {
    connectionsElement.innerHTML = `<div class="connection-row"><div><div class="connection-name">${escapeHtml(t("menubar.noSavedConnectionsTitle"))}</div><div class="connection-meta">${escapeHtml(t("menubar.noSavedConnectionsDescription"))}</div></div></div>`;
    return;
  }

  connectionsElement.replaceChildren(
    ...agent.connections.map((connection) => {
      const row = document.createElement("div");
      row.className = "connection-row";

      const info = document.createElement("div");
      info.innerHTML = `
        <div class="connection-name">${escapeHtml(connection.label)}</div>
        <div class="connection-meta">${escapeHtml(connection.endpointLabel)} • ${escapeHtml(authModeLabel(connection.authMode, t))}</div>
      `;

      const button = document.createElement("button");
      button.className = connection.isCurrent ? "connection-button connection-button-current" : "connection-button";
      button.textContent = connection.isCurrent ? t("common.current") : t("common.use");
      button.disabled = connection.isCurrent;
      button.addEventListener("click", async () => {
        await window.nileDesktop.connections.switchConnection(agent.agentId, connection.id);
        await render();
      });

      row.append(info, button);
      return row;
    }),
  );
}

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;");
}

settingsButton?.addEventListener("click", async () => {
  await window.nileDesktop.app.openSettings();
});

refreshButton?.addEventListener("click", async () => {
  await window.nileDesktop.state.refreshMenubar();
  await render();
});

window.nileDesktopEvents.onStateChanged(() => {
  void render();
});

preferencesStore.subscribe(() => {
  applyFramePreferences();
  void render();
});

applyFramePreferences();
void render();

export {};
