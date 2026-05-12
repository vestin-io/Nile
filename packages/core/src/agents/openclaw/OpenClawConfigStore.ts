import { mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";

import type { OpenClawAuthProfileProjection, OpenClawProviderProjection } from "../../projection";
import { parseJson5Object } from "./Json5";

type JsonObject = Record<string, unknown>;

type OpenClawProviderConfig = {
  baseUrl: string;
  apiKey: string;
  api: "openai-completions" | "openai-responses" | "anthropic-messages";
  models: Array<{ id: string; name: string }>;
};

export class OpenClawConfigStore {
  readonly configPath: string;

  constructor(openclawHome: string) {
    this.configPath = join(openclawHome, "openclaw.json");
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

  applyProviderProjection(projection: OpenClawProviderProjection, envKey: string): void {
    const config = this.readParsedConfig();
    const providerId = this.providerIdForAccess(projection.accessId);
    const modelId = projection.modelId.trim();

    if (!modelId) {
      throw new Error("OpenClaw projection is missing modelId");
    }

    const root = ensureObject(config);
    const models = ensureChildObject(root, "models");
    if (typeof models.mode !== "string" || !models.mode.trim()) {
      models.mode = "merge";
    }
    const providers = ensureChildObject(models, "providers");
    providers[providerId] = this.buildProviderConfig(projection, envKey, modelId);

    const agents = ensureChildObject(root, "agents");
    const defaults = ensureChildObject(agents, "defaults");
    defaults.model = {
      primary: `${providerId}/${modelId}`,
      fallbacks: [],
    };

    this.writeConfig(root);
  }

  applyAuthProfileProjection(
    projection: OpenClawAuthProfileProjection,
    profileId: string,
    metadata?: { email?: string },
  ): void {
    const config = this.readParsedConfig();
    const modelId = projection.modelId.trim();
    if (!modelId) {
      throw new Error("OpenClaw projection is missing modelId");
    }

    const root = ensureObject(config);
    const auth = ensureChildObject(root, "auth");
    const profiles = ensureChildObject(auth, "profiles");
    profiles[profileId] = {
      provider: projection.providerId,
      mode: projection.profileMode,
      ...(metadata?.email ? { email: metadata.email } : {}),
    };

    const order = ensureChildObject(auth, "order");
    const currentOrder = Array.isArray(order[projection.providerId])
      ? (order[projection.providerId] as unknown[]).filter((value): value is string => typeof value === "string")
      : [];
    order[projection.providerId] = [profileId, ...currentOrder.filter((value) => value !== profileId)];

    const agents = ensureChildObject(root, "agents");
    const defaults = ensureChildObject(agents, "defaults");
    defaults.model = {
      primary: `${projection.providerId}/${modelId}`,
      fallbacks: [],
    };

    const models = ensureChildObject(defaults, "models");
    models[`${projection.providerId}/${modelId}`] = {};

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

  profileIdForAccess(providerId: string, accessId: string): string {
    return `${providerId}:nile-${accessId}`;
  }

  private buildProviderConfig(
    projection: OpenClawProviderProjection,
    envKey: string,
    modelId: string,
  ): OpenClawProviderConfig {
    return {
      baseUrl: projection.baseUrl,
      apiKey: `\${${envKey}}`,
      api:
        projection.protocol === "anthropic"
          ? "anthropic-messages"
          : projection.wireApi === "chat"
            ? "openai-completions"
            : "openai-responses",
      models: [
        {
          id: modelId,
          name: modelId,
        },
      ],
    };
  }

  private writeConfig(config: JsonObject): void {
    mkdirSync(dirname(this.configPath), { recursive: true });
    writeFileSync(this.configPath, `${JSON.stringify(config, null, 2)}\n`, "utf8");
  }

}

function ensureObject(value: unknown): JsonObject {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error("OpenClaw config root must be an object");
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

function asObject(value: unknown): JsonObject | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return null;
  }
  return value as JsonObject;
}
