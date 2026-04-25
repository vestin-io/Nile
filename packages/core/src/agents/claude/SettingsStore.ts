import { readFileSync, rmSync } from "node:fs";
import { dirname, join } from "node:path";

import { writePrivateTextFile } from "../../services/PrivateTextFile";

export type ClaudeSettingsEnv = {
  ANTHROPIC_API_KEY?: string;
  ANTHROPIC_AUTH_TOKEN?: string;
  ANTHROPIC_BASE_URL?: string;
  [key: string]: string | undefined;
};

export type ClaudeOauthAccount = {
  emailAddress?: string;
  accountUuid?: string;
  organizationUuid?: string;
  organizationName?: string;
  organizationRole?: string;
  displayName?: string;
};

type ClaudeSettingsDocument = {
  env?: Record<string, unknown>;
  oauthAccount?: Record<string, unknown>;
  model?: unknown;
  [key: string]: unknown;
};

type ClaudeGatewayModelCache = {
  baseUrl?: unknown;
  models?: unknown;
};

const DEFAULT_CLAUDE_BASE_URL = "https://api.anthropic.com";
const CLAUDE_GATEWAY_BETA_DISABLE_ENV = "CLAUDE_CODE_DISABLE_EXPERIMENTAL_BETAS";

/**
 * Reads and writes ~/.claude/settings.json.
 *
 * Claude Code hot-reloads this file — no restart needed after apply.
 *
 * Layout we read/write for Claude connection switching:
 *   { "env": { "ANTHROPIC_BASE_URL": "...", "ANTHROPIC_API_KEY": "sk-ant-..." } }
 *
 * All other top-level keys (e.g. mcpServers) are preserved as-is.
 */
export class ClaudeSettingsStore {
  readonly settingsPath: string;

  constructor(claudeHome: string) {
    this.settingsPath = join(claudeHome, "settings.json");
  }

  snapshot(): string | null {
    try {
      return readFileSync(this.settingsPath, "utf8");
    } catch {
      return null;
    }
  }

  readEnv(): ClaudeSettingsEnv {
    const raw = this.snapshot();
    if (!raw?.trim()) {
      return {};
    }

    const document = this.parse(raw);
    const env = document.env;
    if (!env || typeof env !== "object" || Array.isArray(env)) {
      return {};
    }

    return Object.fromEntries(
      Object.entries(env).filter(([, v]) => typeof v === "string"),
    ) as ClaudeSettingsEnv;
  }

  readOauthAccount(): ClaudeOauthAccount | null {
    const document = this.readDocument();
    const account = document.oauthAccount;
    if (!account || typeof account !== "object" || Array.isArray(account)) {
      return null;
    }

    return {
      emailAddress: this.readString(account, "emailAddress"),
      accountUuid: this.readString(account, "accountUuid"),
      organizationUuid: this.readString(account, "organizationUuid"),
      organizationName: this.readString(account, "organizationName"),
      organizationRole: this.readString(account, "organizationRole"),
      displayName: this.readString(account, "displayName"),
    };
  }

  applyApiKey(
    apiKey: string,
    baseUrl?: string,
    envKey: "ANTHROPIC_API_KEY" | "ANTHROPIC_AUTH_TOKEN" = "ANTHROPIC_API_KEY",
  ): void {
    const document = this.readDocument();
    this.clearManagedAuthConflictSettings(document);
    const needsGatewayCompatibility = this.requiresManagedModelCleanup(baseUrl);
    if (needsGatewayCompatibility) {
      this.syncManagedGatewayModel(document, baseUrl);
    }

    const env: Record<string, unknown> = {
      ...this.preservedEnvEntries(document.env),
      ANTHROPIC_BASE_URL: baseUrl ?? DEFAULT_CLAUDE_BASE_URL,
      [envKey]: apiKey,
    };
    if (needsGatewayCompatibility) {
      env[CLAUDE_GATEWAY_BETA_DISABLE_ENV] = "1";
    }

    document.env = env;

    if (envKey === "ANTHROPIC_API_KEY") {
      delete (document.env as Record<string, unknown>)["ANTHROPIC_AUTH_TOKEN"];
    } else {
      delete (document.env as Record<string, unknown>)["ANTHROPIC_API_KEY"];
    }
    delete document.oauthAccount;
    this.writeDocument(document);
  }

  applySession(account: ClaudeOauthAccount): void {
    const document = this.readDocument();
    this.clearManagedAuthConflictSettings(document);
    document.env = this.preservedEnvEntries(document.env);
    document.oauthAccount = {
      ...this.preservedOauthAccount(document.oauthAccount),
      ...(account.emailAddress ? { emailAddress: account.emailAddress } : {}),
      ...(account.accountUuid ? { accountUuid: account.accountUuid } : {}),
      ...(account.organizationUuid ? { organizationUuid: account.organizationUuid } : {}),
      ...(account.organizationName ? { organizationName: account.organizationName } : {}),
      ...(account.organizationRole ? { organizationRole: account.organizationRole } : {}),
      ...(account.displayName ? { displayName: account.displayName } : {}),
    };

    this.writeDocument(document);
  }

  restore(snapshot: string | null): void {
    if (snapshot === null) {
      rmSync(this.settingsPath, { force: true });
      return;
    }

    writePrivateTextFile(this.settingsPath, snapshot);
  }

  private readDocument(): ClaudeSettingsDocument {
    const raw = this.snapshot();
    if (!raw?.trim()) {
      return {};
    }
    return this.parse(raw);
  }

  private writeDocument(document: ClaudeSettingsDocument): void {
    writePrivateTextFile(this.settingsPath, `${JSON.stringify(document, null, 2)}\n`);
  }

  private parse(raw: string): ClaudeSettingsDocument {
    const parsed = JSON.parse(raw) as unknown;
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
      throw new Error("Claude settings.json must contain a JSON object");
    }
    return parsed as ClaudeSettingsDocument;
  }

  private clearManagedAuthConflictSettings(document: ClaudeSettingsDocument): void {
    delete document.apiKeyHelper;
  }

  private clearManagedModelConflictSettings(document: ClaudeSettingsDocument): void {
    delete document.model;
  }

  private syncManagedGatewayModel(
    document: ClaudeSettingsDocument,
    baseUrl?: string,
  ): void {
    const availableModels = this.readGatewayModels(baseUrl);
    if (availableModels.length === 0) {
      this.clearManagedModelConflictSettings(document);
      return;
    }

    const currentModel = typeof document.model === "string" ? document.model.trim() : "";
    if (currentModel && availableModels.includes(currentModel)) {
      document.model = currentModel;
      return;
    }

    const preferredModel = this.selectPreferredGatewayModel(availableModels);
    if (!preferredModel) {
      this.clearManagedModelConflictSettings(document);
      return;
    }

    document.model = preferredModel;
  }

  private requiresManagedModelCleanup(baseUrl?: string): boolean {
    return Boolean(baseUrl && baseUrl !== DEFAULT_CLAUDE_BASE_URL);
  }

  private readGatewayModels(baseUrl?: string): string[] {
    if (!baseUrl) {
      return [];
    }

    const cache = this.readGatewayModelCache();
    if (!cache) {
      return [];
    }

    const cacheBaseUrl = typeof cache.baseUrl === "string" ? cache.baseUrl.trim() : "";
    if (!cacheBaseUrl || this.normalizeUrl(cacheBaseUrl) !== this.normalizeUrl(baseUrl)) {
      return [];
    }

    if (!Array.isArray(cache.models)) {
      return [];
    }

    return cache.models.flatMap((model) => {
      if (!model || typeof model !== "object" || Array.isArray(model)) {
        return [];
      }
      const id = (model as Record<string, unknown>).id;
      return typeof id === "string" && id.trim() ? [id.trim()] : [];
    });
  }

  private readGatewayModelCache(): ClaudeGatewayModelCache | null {
    try {
      const cachePath = join(dirname(this.settingsPath), "cache", "gateway-models.json");
      const raw = readFileSync(cachePath, "utf8");
      const parsed = JSON.parse(raw) as unknown;
      if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
        return null;
      }
      return parsed as ClaudeGatewayModelCache;
    } catch {
      return null;
    }
  }

  private selectPreferredGatewayModel(models: string[]): string | null {
    const ranked = models
      .map((model) => ({ model, score: this.rankGatewayModel(model) }))
      .filter((candidate): candidate is { model: string; score: number[] } => candidate.score !== null)
      .sort((left, right) => this.compareGatewayModelRank(right.score, left.score));

    return ranked[0]?.model ?? null;
  }

  private rankGatewayModel(model: string): number[] | null {
    const match = /^claude-(sonnet|opus|haiku)-(.+)$/.exec(model);
    if (!match) {
      return null;
    }

    const family = match[1];
    const version = match[2];
    const familyWeight = family === "sonnet" ? 3 : family === "opus" ? 2 : 1;
    const normalizedVersion = version.replace(/\./g, "-");
    const parts = normalizedVersion.split("-").filter(Boolean);
    const numericParts = parts
      .filter((part) => /^\d+$/.test(part))
      .map((part) => Number.parseInt(part, 10));
    const hasDateSuffix = numericParts.length >= 3 && numericParts[numericParts.length - 1] > 10000000;
    const date = hasDateSuffix ? numericParts.pop() ?? 0 : 0;
    const major = numericParts[0] ?? 0;
    const minor = numericParts[1] ?? 0;
    const patch = numericParts[2] ?? 0;
    const exactStyleWeight = version.includes(".") ? 0 : 1;

    return [familyWeight, major, minor, patch, date, exactStyleWeight];
  }

  private compareGatewayModelRank(left: number[], right: number[]): number {
    const length = Math.max(left.length, right.length);
    for (let index = 0; index < length; index += 1) {
      const delta = (left[index] ?? 0) - (right[index] ?? 0);
      if (delta !== 0) {
        return delta;
      }
    }
    return 0;
  }

  private normalizeUrl(value: string): string {
    return value.trim().replace(/\/+$/, "");
  }

  /** Preserve non-Anthropic env vars that Claude Code may set for other tools. */
  private preservedEnvEntries(
    env: Record<string, unknown> | undefined,
  ): Record<string, unknown> {
    if (!env) {
      return {};
    }

    return Object.fromEntries(
      Object.entries(env).filter(
        ([key]) =>
          key !== "ANTHROPIC_API_KEY" &&
          key !== "ANTHROPIC_AUTH_TOKEN" &&
          key !== "ANTHROPIC_BASE_URL" &&
          !/^ANTHROPIC_DEFAULT_.+_MODEL$/.test(key) &&
          key !== "ANTHROPIC_FOUNDRY_API_KEY" &&
          key !== "ANTHROPIC_FOUNDRY_RESOURCE" &&
          key !== "CLAUDE_CODE_USE_FOUNDRY" &&
          key !== CLAUDE_GATEWAY_BETA_DISABLE_ENV,
      ),
    );
  }

  private preservedOauthAccount(
    account: Record<string, unknown> | undefined,
  ): Record<string, unknown> {
    if (!account) {
      return {};
    }

    return Object.fromEntries(
      Object.entries(account).filter(
        ([key]) =>
          key !== "emailAddress" &&
          key !== "accountUuid" &&
          key !== "organizationUuid" &&
          key !== "organizationName" &&
          key !== "organizationRole" &&
          key !== "displayName",
      ),
    );
  }

  private readString(value: Record<string, unknown>, key: string): string | undefined {
    const field = value[key];
    return typeof field === "string" && field.trim() ? field : undefined;
  }
}
