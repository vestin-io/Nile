import { readFileSync, rmSync } from "node:fs";
import { join } from "node:path";
import { readOptionalTextFile } from "../../services/OptionalTextFile";
import { writePrivateTextFile } from "../../services/PrivateTextFile";
import { ClaudeGatewayModelCatalog } from "./GatewayModelCatalog";

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
  private readonly gatewayModels: ClaudeGatewayModelCatalog;

  constructor(claudeHome: string) {
    this.settingsPath = join(claudeHome, "settings.json");
    this.gatewayModels = new ClaudeGatewayModelCatalog(this.settingsPath);
  }

  snapshot(): string | null {
    return readOptionalTextFile(this.settingsPath, "Claude settings.json");
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

  readModel(): string | null {
    const document = this.readDocument();
    return typeof document.model === "string" && document.model.trim()
      ? document.model.trim()
      : null;
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
    const availableModels = this.gatewayModels.readModels(baseUrl);
    if (availableModels.length === 0) {
      this.clearManagedModelConflictSettings(document);
      return;
    }

    const currentModel = typeof document.model === "string" ? document.model.trim() : "";
    if (currentModel && availableModels.includes(currentModel)) {
      document.model = currentModel;
      return;
    }

    const preferredModel = this.gatewayModels.selectPreferredModel(availableModels);
    if (!preferredModel) {
      this.clearManagedModelConflictSettings(document);
      return;
    }

    document.model = preferredModel;
  }

  private requiresManagedModelCleanup(baseUrl?: string): boolean {
    return Boolean(baseUrl && baseUrl !== DEFAULT_CLAUDE_BASE_URL);
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
