import { OpenCodeAuthStore } from "../OpenCodeAuthStore";
import { OpenCodeConfigStore } from "../OpenCodeConfigStore";
import type { ReadLiveSetupResult } from "./Internal";
import { LiveSetupResolver } from "./Resolver";

type JsonObject = Record<string, unknown>;

export class LiveSetupReader {
  private readonly stateResolver: LiveSetupResolver;

  constructor(
    private readonly configStore: OpenCodeConfigStore,
    private readonly authStore: OpenCodeAuthStore,
  ) {
    this.stateResolver = new LiveSetupResolver();
  }

  read(): ReadLiveSetupResult {
    const snapshot = this.configStore.snapshot();
    if (snapshot === null) {
      return {
        kind: "invalid_structure",
        issues: [`OpenCode config not found at ${this.configStore.configPath}`],
      };
    }

    if (!snapshot.trim()) {
      return {
        kind: "invalid_structure",
        issues: [`OpenCode config is empty at ${this.configStore.configPath}`],
      };
    }

    let config: Record<string, unknown>;
    try {
      config = this.configStore.readParsedConfig();
    } catch (error) {
      return {
        kind: "invalid_structure",
        issues: [error instanceof Error ? error.message : String(error)],
      };
    }

    const current = this.readCurrentModel(config);
    if ("error" in current) {
      return {
        kind: "invalid_semantics",
        issues: [current.error],
        endpoint: null,
        access: null,
      };
    }

    const alignmentIssue = this.readAlignmentIssue(config, current.providerId, current.modelId);
    if (alignmentIssue) {
      return {
        kind: "invalid_semantics",
        issues: [alignmentIssue],
        endpoint: null,
        access: null,
      };
    }

    if (current.providerId === "openai") {
      const oauth = this.readOpenAiOauthCredential();
      if ("value" in oauth) {
        return {
          kind: "resolved",
          value: {
            ...this.stateResolver.resolveOpenAiOauthState(current.modelId, oauth.value),
            modelId: current.modelId,
          },
        };
      }
      if ("error" in oauth) {
        return {
          kind: "invalid_semantics",
          issues: [oauth.error],
          endpoint: null,
          access: null,
        };
      }
    }

    const provider = this.readProvider(config, current.providerId);
    if ("error" in provider) {
      return {
        kind: "invalid_semantics",
        issues: [provider.error],
        endpoint: null,
        access: null,
      };
    }

    const resolved = this.stateResolver.resolveProviderState(current.providerId, current.modelId, provider.value);
    if ("error" in resolved) {
      return {
        kind: "invalid_semantics",
        issues: [resolved.error],
        endpoint: resolved.endpoint ?? null,
        access: resolved.access ?? null,
      };
    }

    return {
      kind: "resolved",
      value: {
        ...resolved.value,
        modelId: current.modelId,
      },
    };
  }

  private readOpenAiOauthCredential():
    | { value: NonNullable<ReturnType<OpenCodeAuthStore["readOauthCredential"]>> }
    | { error: string }
    | { none: true } {
    try {
      const credential = this.authStore.readOauthCredential("openai");
      return credential ? { value: credential } : { none: true };
    } catch (error) {
      return {
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }

  private readCurrentModel(
    config: Record<string, unknown>,
  ): { providerId: string; modelId: string } | { error: string } {
    const modelValue = readString(config.model);
    if (!modelValue) {
      return { error: "OpenCode config does not define model" };
    }

    const slashIndex = modelValue.indexOf("/");
    if (slashIndex <= 0 || slashIndex === modelValue.length - 1) {
      return {
        error: `OpenCode model must use provider/model format, received: ${modelValue}`,
      };
    }

    return {
      providerId: modelValue.slice(0, slashIndex).trim(),
      modelId: modelValue.slice(slashIndex + 1).trim(),
    };
  }

  private readProvider(
    config: Record<string, unknown>,
    providerId: string,
  ): { value: JsonObject } | { error: string } {
    const providers = asObject(config.provider);
    if (!providers) {
      return { error: "OpenCode config does not define provider" };
    }

    const provider = asObject(providers[providerId]);
    if (!provider) {
      return {
        error: `OpenCode config does not contain provider ${providerId} referenced by model`,
      };
    }

    return { value: provider };
  }

  private readAlignmentIssue(
    config: Record<string, unknown>,
    providerId: string,
    modelId: string,
  ): string | null {
    const selectedModel = `${providerId}/${modelId}`;
    const enabledProviders = readStringArray(config.enabled_providers);
    if (enabledProviders && !enabledProviders.includes(providerId)) {
      return `OpenCode enabled_providers excludes provider ${providerId} referenced by model`;
    }

    const disabledProviders = readStringArray(config.disabled_providers);
    if (disabledProviders?.includes(providerId)) {
      return `OpenCode disabled_providers disables provider ${providerId} referenced by model`;
    }

    const agents = asObject(config.agent);
    if (!agents) {
      return null;
    }
    for (const agentId of ["build", "plan", "general"]) {
      const agent = asObject(agents[agentId]);
      const agentModel = readString(agent?.model);
      if (agentModel && agentModel !== selectedModel) {
        return `OpenCode agent.${agentId}.model overrides the selected model with ${agentModel}`;
      }
    }
    return null;
  }
}

function asObject(value: unknown): JsonObject | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return null;
  }
  return value as JsonObject;
}

function readString(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function readStringArray(value: unknown): string[] | null {
  if (!Array.isArray(value)) {
    return null;
  }
  return value
    .map((entry) => readString(entry))
    .filter((entry): entry is string => Boolean(entry));
}
