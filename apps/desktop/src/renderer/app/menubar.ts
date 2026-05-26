import { registerBuiltinAgentDeclarations } from "@nile/builtins/agents";

import type { AgentId } from "@nile/core/models/agent";

import { readDocumentPlatform } from "../../state/DesktopPlatform";
import { readDefaultDesktopPreferences, type DesktopPreferences } from "../../state/DesktopPreferences";
import {
  DesktopStatusEntryPresenter,
  type DesktopPresentedStatusEntryAgent,
  type DesktopPresentedStatusEntryConnection,
} from "../../state/StatusEntryPresenter";
import { DesktopPreferencesClient } from "../settings/PreferencesClient";
import { ThemeController } from "../settings/ThemeController";
import { authModeLabel } from "../shared/DisplayText";
import { createTranslator } from "../shared/I18n";

type StatusEntryState = Awaited<ReturnType<typeof window.nileDesktop.statusEntry.getStatusEntryState>>;

const preferencesClient = new DesktopPreferencesClient();
const themeController = new ThemeController(document.documentElement);
const contentElement = document.getElementById("menubar-content");
const openAppButton = document.getElementById("open-app-button");
const kickerElement = document.getElementById("menubar-kicker");
const viewTitleElement = document.getElementById("menubar-view-title");
const viewSubtitleElement = document.getElementById("menubar-view-subtitle");
const backButton = document.getElementById("back-button");
let selectedAgentId: AgentId | null = null;
let currentPreferences: DesktopPreferences = readDefaultDesktopPreferences();
let didMigrateLegacyPreferences = false;

registerBuiltinAgentDeclarations();

function applyFramePreferences(): void {
  const t = createTranslator(currentPreferences.language);
  themeController.apply(currentPreferences.theme);
  document.documentElement.dataset.platform = readDocumentPlatform();
  if (openAppButton) {
    openAppButton.textContent = t("tray.openApp");
  }
}

async function render(): Promise<void> {
  const state = await window.nileDesktop.statusEntry.getStatusEntryState();
  const t = createTranslator(currentPreferences.language);
  const presenter = new DesktopStatusEntryPresenter(
    state,
    currentPreferences.connectionQuotaMetricPreferences,
  );
  const agents = presenter.readConfiguredAgents();
  const selectedAgent = selectedAgentId ? presenter.readConfiguredAgent(selectedAgentId) : null;

  if (!selectedAgent) {
    selectedAgentId = null;
    renderAgentList(agents, t);
    return;
  }

  renderAgentDetail(selectedAgent, t);
}

function renderAgentList(
  agents: DesktopPresentedStatusEntryAgent[],
  t: ReturnType<typeof createTranslator>,
): void {
  if (!contentElement || !viewTitleElement || !viewSubtitleElement || !backButton || !kickerElement) {
    return;
  }

  kickerElement.classList.remove("is-hidden");
  viewTitleElement.textContent = "Agents";
  viewSubtitleElement.textContent = "";
  viewSubtitleElement.classList.add("is-hidden");
  backButton.classList.add("is-hidden");
  viewTitleElement.classList.remove("is-hidden");

  if (agents.length === 0) {
    const emptyRow = document.createElement("div");
    emptyRow.className = "tray-empty-state";

    const title = document.createElement("div");
    title.className = "tray-empty-title";
    title.textContent = t("menubar.noSavedConnectionsTitle");

    const description = document.createElement("div");
    description.className = "tray-empty-description";
    description.textContent = t("menubar.noSavedConnectionsDescription");

    emptyRow.append(title, description);
    contentElement.replaceChildren(emptyRow);
    return;
  }

  contentElement.replaceChildren(...agents.map((agent) => createAgentListItem(agent, t)));
}

function createAgentListItem(
  agent: DesktopPresentedStatusEntryAgent,
  t: ReturnType<typeof createTranslator>,
): HTMLElement {
  const button = document.createElement("button");
  button.className = "tray-agent-list-item";
  button.type = "button";
  button.addEventListener("click", () => {
    selectedAgentId = agent.agentId;
    void render();
  });

  const copy = document.createElement("div");
  copy.className = "tray-agent-list-copy";

  const name = document.createElement("div");
  name.className = "tray-agent-list-name";
  name.textContent = agent.agentLabel;

  const meta = document.createElement("div");
  meta.className = "tray-agent-list-meta";
  meta.textContent = agent.currentConnectionSummary ?? t("menubar.currentConnectionEmpty");

  const badge = document.createElement("div");
  badge.className = "tray-agent-list-badge";
  badge.textContent = agent.quotaBadgeText ?? t("common.unknown");

  const chevron = document.createElement("div");
  chevron.className = "tray-agent-list-chevron";
  chevron.textContent = ">";

  copy.append(name, meta);
  button.append(copy, badge, chevron);
  return button;
}

function renderAgentDetail(
  agent: DesktopPresentedStatusEntryAgent,
  t: ReturnType<typeof createTranslator>,
): void {
  if (!contentElement || !viewTitleElement || !viewSubtitleElement || !backButton || !kickerElement) {
    return;
  }

  kickerElement.classList.add("is-hidden");
  viewTitleElement.textContent = "";
  viewSubtitleElement.textContent = "";
  viewSubtitleElement.classList.add("is-hidden");
  viewTitleElement.classList.add("is-hidden");
  backButton.classList.remove("is-hidden");
  backButton.textContent = `Agents > ${agent.agentLabel}`;

  const connectionList = document.createElement("div");
  connectionList.className = "tray-connection-list";

  if (agent.connections.length === 0) {
    const empty = document.createElement("div");
    empty.className = "tray-empty-state";
    const title = document.createElement("div");
    title.className = "tray-empty-title";
    title.textContent = t("menubar.noSavedConnectionsTitle");
    const description = document.createElement("div");
    description.className = "tray-empty-description";
    description.textContent = t("menubar.noSavedConnectionsDescription");
    empty.append(title, description);
    connectionList.append(empty);
  } else {
    connectionList.append(...agent.connections.map((connection) => createConnectionRow(agent.agentId, connection, t)));
  }

  contentElement.replaceChildren(connectionList);
}

function createConnectionRow(
  agentId: AgentId,
  connection: DesktopPresentedStatusEntryConnection,
  t: ReturnType<typeof createTranslator>,
): HTMLElement {
  const row = document.createElement("div");
  row.className = "tray-connection-row";

  const info = document.createElement("div");
  info.className = "tray-connection-copy";

  const name = document.createElement("div");
  name.className = "tray-connection-name";
  name.textContent = connection.label;

  const meta = document.createElement("div");
  meta.className = "tray-connection-meta";
  meta.textContent = `${connection.endpointLabel} - ${authModeLabel(connection.authMode, t)}`;

  const button = document.createElement("button");
  button.className = connection.isCurrent ? "tray-connection-button is-current" : "tray-connection-button";
  button.textContent = connection.isCurrent ? t("common.current") : t("common.use");
  button.disabled = connection.isCurrent;
  button.addEventListener("click", async () => {
    button.disabled = true;
    try {
      await window.nileDesktop.connections.switchConnection(agentId, connection.id);
      await refreshAndRender();
    } finally {
      if (!connection.isCurrent) {
        button.disabled = false;
      }
    }
  });

  info.append(name, meta);
  row.append(info, button);
  return row;
}

openAppButton?.addEventListener("click", async () => {
  await window.nileDesktop.app.openSettings();
});

backButton?.addEventListener("click", () => {
  selectedAgentId = null;
  void render();
});

window.nileDesktopEvents.onStateChanged(() => {
  void syncPreferencesAndRender();
});

preferencesClient.subscribe(() => {
  void syncPreferencesAndRender();
});

window.addEventListener("focus", () => {
  void refreshAndRender();
});

async function refreshAndRender(): Promise<void> {
  await syncPreferences();
  await window.nileDesktop.statusEntry.refreshStatusEntry().catch(() => undefined);
  await render();
}

async function syncPreferences(): Promise<void> {
  currentPreferences = didMigrateLegacyPreferences
    ? await preferencesClient.load().catch(() => currentPreferences)
    : await preferencesClient.migrateLegacy(window.localStorage).catch(() => currentPreferences);
  didMigrateLegacyPreferences = true;
  applyFramePreferences();
}

async function syncPreferencesAndRender(): Promise<void> {
  await syncPreferences();
  await render();
}

void syncPreferencesAndRender();

export {};
