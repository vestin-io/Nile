import { readFileSync } from "node:fs";
import { join } from "node:path";

type JsonObject = Record<string, unknown>;

export class DesktopOpenCodeEnvironmentReader {
  readonly configPath: string;

  constructor(opencodeHome: string) {
    this.configPath = join(opencodeHome, "opencode.json");
  }

  readManagedEnvKeys(): string[] {
    const config = this.readConfig();
    const providers = this.asObject(config.provider);
    if (!providers) {
      return [];
    }

    const envKeys = new Set<string>();
    for (const providerId of Object.keys(providers)) {
      if (!providerId.startsWith("nile-")) {
        continue;
      }
      const provider = this.asObject(providers[providerId]);
      const apiKey = readString(this.asObject(provider?.options)?.apiKey);
      const envKey = apiKey ? this.readEnvKeyReference(apiKey) : null;
      if (envKey) {
        envKeys.add(envKey);
      }
    }

    return [...envKeys].sort();
  }

  private readConfig(): JsonObject {
    const snapshot = readFileSync(this.configPath, "utf8");
    const parsed = JSON.parse(snapshot) as unknown;
    return this.asObject(parsed) ?? {};
  }

  private asObject(value: unknown): JsonObject | null {
    if (!value || typeof value !== "object" || Array.isArray(value)) {
      return null;
    }
    return value as JsonObject;
  }

  private readEnvKeyReference(value: string): string | null {
    const match = /^\{env:([A-Z_][A-Z0-9_]*)\}$/.exec(value);
    return match?.[1] ?? null;
  }
}

function readString(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}
