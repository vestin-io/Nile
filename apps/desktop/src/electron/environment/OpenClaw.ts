import { readFileSync } from "node:fs";
import { join } from "node:path";

type JsonObject = Record<string, unknown>;

export class DesktopOpenClawEnvironmentReader {
  readonly configPath: string;

  constructor(openclawHome: string) {
    this.configPath = join(openclawHome, "openclaw.json");
  }

  readManagedEnvKeys(): string[] {
    const config = this.readConfig();
    const providers = this.asObject(this.asObject(config.models)?.providers);
    if (!providers) {
      return [];
    }

    const envKeys = new Set<string>();
    for (const providerId of Object.keys(providers)) {
      if (!providerId.startsWith("nile-")) {
        continue;
      }
      const provider = this.asObject(providers[providerId]);
      const apiKey = typeof provider?.apiKey === "string" ? provider.apiKey.trim() : "";
      const envKey = this.readEnvKeyReference(apiKey);
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
    const match = /^\$\{([A-Z_][A-Z0-9_]*)\}$/.exec(value);
    return match?.[1] ?? null;
  }
}
