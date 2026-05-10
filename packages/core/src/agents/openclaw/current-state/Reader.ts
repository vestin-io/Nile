import { CodexAuthStore } from "../../codex/stores/CodexAuthStore";
import {
  OpenClawAuthProfileStore,
} from "../AuthProfileStore";
import { OpenClawConfigStore } from "../OpenClawConfigStore";
import type { ReadCurrentStateResult } from "./Internal";
import {
  CurrentStateResolver,
  type OpenClawAuthProfileMetadata,
  type OpenClawAuthProfileMode,
} from "./Resolver";

type JsonObject = Record<string, unknown>;

export class CurrentStateReader {
  private readonly stateResolver: CurrentStateResolver;

  constructor(
    private readonly configStore: OpenClawConfigStore,
    private readonly authProfileStore: OpenClawAuthProfileStore,
    private readonly codexAuthStore: CodexAuthStore,
  ) {
    this.stateResolver = new CurrentStateResolver(this.codexAuthStore);
  }

  read(): ReadCurrentStateResult {
    const snapshot = this.configStore.snapshot();
    if (snapshot === null) {
      return {
        kind: "invalid_structure",
        issues: [`OpenClaw config not found at ${this.configStore.configPath}`],
      };
    }

    if (!snapshot.trim()) {
      return {
        kind: "invalid_structure",
        issues: [`OpenClaw config is empty at ${this.configStore.configPath}`],
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

    const primary = this.readPrimary(config);
    if ("error" in primary) {
      return {
        kind: "invalid_semantics",
        issues: [primary.error],
        endpoint: null,
        access: null,
      };
    }

    const authProfile = this.readAuthProfile(config, primary.providerId);
    if ("error" in authProfile) {
      return {
        kind: "invalid_semantics",
        issues: [authProfile.error],
        endpoint: null,
        access: null,
      };
    }

    if (authProfile.value) {
      let authStore: ReturnType<OpenClawAuthProfileStore["readParsedStore"]>;
      try {
        authStore = this.authProfileStore.readParsedStore();
      } catch (error) {
        return {
          kind: "invalid_structure",
          issues: [error instanceof Error ? error.message : String(error)],
        };
      }

      const credential = authStore.profiles[authProfile.value.profileId];
      if (!credential) {
        return {
          kind: "invalid_semantics",
          issues: [
            `OpenClaw auth-profiles.json does not contain profile ${authProfile.value.profileId}`,
          ],
          endpoint: null,
          access: null,
        };
      }

      const resolved = this.stateResolver.resolveAuthProfileState(
        authProfile.value,
        primary.modelId,
        credential,
      );
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
        value: resolved.value,
      };
    }

    const provider = this.readProvider(config, primary.providerId);
    if ("error" in provider) {
      return {
        kind: "invalid_semantics",
        issues: [provider.error],
        endpoint: null,
        access: null,
      };
    }

    const resolved = this.stateResolver.resolveProviderState(primary.providerId, primary.modelId, provider.value);
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
      value: resolved.value,
    };
  }

  private readPrimary(
    config: Record<string, unknown>,
  ): { providerId: string; modelId: string } | { error: string } {
    const primary = asObject(config.agents)?.defaults;
    const primaryValue = asObject(primary)?.model;
    const primaryString = asObject(primaryValue)?.primary;
    if (typeof primaryString !== "string" || !primaryString.trim()) {
      return { error: "OpenClaw config does not define agents.defaults.model.primary" };
    }

    const slashIndex = primaryString.indexOf("/");
    if (slashIndex <= 0 || slashIndex === primaryString.length - 1) {
      return {
        error: `OpenClaw primary model must use provider/model format, received: ${primaryString}`,
      };
    }

    return {
      providerId: primaryString.slice(0, slashIndex).trim(),
      modelId: primaryString.slice(slashIndex + 1).trim(),
    };
  }

  private readAuthProfile(
    config: Record<string, unknown>,
    providerId: string,
  ): { value: OpenClawAuthProfileMetadata | null } | { error: string } {
    const auth = asObject(config.auth);
    const profiles = asObject(auth?.profiles);
    if (!profiles) {
      return { value: null };
    }

    const profileId = this.selectActiveProfileId(auth, profiles, providerId);
    if ("error" in profileId) {
      return profileId;
    }
    if (!profileId.value) {
      return { value: null };
    }

    const metadata = asObject(profiles[profileId.value]);
    if (!metadata) {
      return {
        error: `OpenClaw auth profile ${profileId.value} must be an object`,
      };
    }

    const profileProviderId = readString(metadata.provider);
    if (!profileProviderId) {
      return {
        error: `OpenClaw auth profile ${profileId.value} is missing provider`,
      };
    }
    if (profileProviderId !== providerId) {
      return {
        error: `OpenClaw auth profile ${profileId.value} targets provider ${profileProviderId}, expected ${providerId}`,
      };
    }

    const mode = readMode(metadata.mode);
    if (!mode) {
      return {
        error: `OpenClaw auth profile ${profileId.value} uses unsupported mode ${String(metadata.mode)}`,
      };
    }

    return {
      value: {
        profileId: profileId.value,
        providerId,
        mode,
        ...(readString(metadata.email) ? { email: readString(metadata.email)! } : {}),
      },
    };
  }

  private selectActiveProfileId(
    auth: JsonObject | null,
    profiles: JsonObject,
    providerId: string,
  ): { value: string | null } | { error: string } {
    const lastGoodId = readString(asObject(auth?.lastGood)?.[providerId]);
    if (lastGoodId && hasProfile(profiles, lastGoodId)) {
      return { value: lastGoodId };
    }

    const orderValues = asStringArray(asObject(auth?.order)?.[providerId]);
    const orderedProfileId = orderValues.find((profileId) => hasProfile(profiles, profileId));
    if (orderedProfileId) {
      return { value: orderedProfileId };
    }

    const matchingProfileIds = Object.entries(profiles)
      .filter(([, value]) => asObject(value)?.provider === providerId)
      .map(([profileId]) => profileId);

    if (matchingProfileIds.length === 0) {
      return { value: null };
    }
    if (matchingProfileIds.length > 1) {
      return {
        error: `OpenClaw config does not define an active auth profile for provider ${providerId}`,
      };
    }

    return { value: matchingProfileIds[0] };
  }

  private readProvider(
    config: Record<string, unknown>,
    providerId: string,
  ): { value: JsonObject } | { error: string } {
    const providers = asObject(asObject(config.models)?.providers);
    if (!providers) {
      return { error: "OpenClaw config does not define models.providers" };
    }

    const provider = asObject(providers[providerId]);
    if (!provider) {
      return {
        error: `OpenClaw config does not contain provider ${providerId} referenced by agents.defaults.model.primary`,
      };
    }

    return { value: provider };
  }

}

function hasProfile(profiles: JsonObject, profileId: string): boolean {
  return profileId in profiles && asObject(profiles[profileId]) !== null;
}

function asObject(value: unknown): JsonObject | null {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as JsonObject)
    : null;
}

function asStringArray(value: unknown): string[] {
  return Array.isArray(value)
    ? value.filter((entry): entry is string => typeof entry === "string" && entry.trim().length > 0)
    : [];
}

function readString(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function readMode(value: unknown): OpenClawAuthProfileMode | null {
  return value === "api_key" || value === "oauth" || value === "token"
    ? value
    : null;
}
