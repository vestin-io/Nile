import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";

import { parseJson5Object } from "./Json5";
import type { OpenCodeApiKeyProjection, OpenCodeProjection } from "./ProjectionTypes";

type JsonObject = Record<string, unknown>;

export class OpenCodeConfigStore {
  readonly configPath: string;

  constructor(opencodeHome: string) {
    const standardPath = join(opencodeHome, "opencode.json");
    const legacyPath = join(opencodeHome, "config.json");
    this.configPath = existsSync(standardPath)
      ? standardPath
      : existsSync(legacyPath)
        ? legacyPath
        : standardPath;
  }

  snapshot(): string | null {
    try {
      return readFileSync(this.configPath, "utf8");
    } catch {
      return null;
    }
  }

  readParsedConfig(): Record<string, unknown> {
    const snapshot = this.snapshot();
    if (!snapshot || !snapshot.trim()) {
      return {};
    }
    return parseJson5Object(snapshot);
  }

  applyProjection(projection: OpenCodeProjection, envKey?: string): void {
    const config = this.readParsedConfig();
    const root = ensureObject(config);
    const modelId = projection.modelId.trim();

    if (!modelId) {
      throw new Error("OpenCode projection is missing modelId");
    }

    const providerId = projection.authMode === "openai_session"
      ? "openai"
      : this.providerIdForAccess(projection.accessId);
    const selectedModel = `${providerId}/${modelId}`;

    if (projection.authMode === "api_key") {
      if (!envKey) {
        throw new Error("OpenCode api_key projections require an env key");
      }

      const providers = ensureChildObject(root, "provider");
      providers[providerId] = this.buildProviderConfig(projection, envKey);
    }

    root.model = selectedModel;
    this.applyPrimaryAgentModels(root, selectedModel);
    root.enabled_providers = [providerId];
    this.removeDisabledProvider(root, providerId);
    this.writeConfig(root);
  }

  restore(snapshot: string | null): void {
    if (snapshot === null) {
      rmSync(this.configPath, { force: true });
      return;
    }

    mkdirSync(dirname(this.configPath), { recursive: true });
    writeFileSync(this.configPath, snapshot, "utf8");
  }

  providerIdForAccess(accessId: string): string {
    return `nile-${accessId}`;
  }

  private applyPrimaryAgentModels(root: JsonObject, selectedModel: string): void {
    const agent = ensureChildObject(root, "agent");
    for (const agentId of ["build", "plan", "general"]) {
      ensureChildObject(agent, agentId).model = selectedModel;
    }
  }

  private removeDisabledProvider(root: JsonObject, providerId: string): void {
    if (!Array.isArray(root.disabled_providers)) {
      return;
    }
    root.disabled_providers = root.disabled_providers.filter((value) => value !== providerId);
  }

  private buildProviderConfig(
    projection: OpenCodeApiKeyProjection,
    envKey: string,
  ): JsonObject {
    const modelId = projection.modelId.trim();
    const options: JsonObject = {
      apiKey: `{env:${envKey}}`,
    };

    if (projection.baseUrl) {
      options.baseURL = projection.baseUrl;
    }

    const headers = this.buildHeaders(projection, envKey);
    if (headers) {
      options.headers = headers;
    }

    return {
      npm: projection.providerPackage,
      name: projection.endpointLabel,
      options,
      models: {
        [modelId]: {
          name: modelId,
        },
      },
    };
  }

  private buildHeaders(
    projection: OpenCodeApiKeyProjection,
    envKey: string,
  ): JsonObject | null {
    const headers: JsonObject = {};
    if (projection.protocol === "anthropic" && projection.authScheme === "bearer") {
      headers.Authorization = `Bearer {env:${envKey}}`;
    }
    if (projection.versionHeader?.trim()) {
      headers["anthropic-version"] = projection.versionHeader.trim();
    }
    return Object.keys(headers).length > 0 ? headers : null;
  }

  private writeConfig(config: JsonObject): void {
    mkdirSync(dirname(this.configPath), { recursive: true });
    writeFileSync(this.configPath, `${JSON.stringify(config, null, 2)}\n`, "utf8");
  }
}

function ensureObject(value: unknown): JsonObject {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error("OpenCode config root must be an object");
  }
  return value as JsonObject;
}

function ensureChildObject(parent: JsonObject, key: string): JsonObject {
  const current = parent[key];
  if (current && typeof current === "object" && !Array.isArray(current)) {
    return current as JsonObject;
  }

  const next: JsonObject = {};
  parent[key] = next;
  return next;
}
