import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

import type { CodexProjection } from "../../../projection";
import { writePrivateTextFile } from "../../../services/PrivateTextFile";

const MANAGED_BLOCK_START = "# BEGIN nile-switcher managed endpoint";
const MANAGED_BLOCK_END = "# END nile-switcher managed endpoint";
const LEGACY_MANAGED_BLOCK_START = "# BEGIN nile-switcher managed provider";
const LEGACY_MANAGED_BLOCK_END = "# END nile-switcher managed provider";
const CODEX_BUILT_IN_PROVIDER_IDS = new Set(["openai"]);

export class CodexConfigStore {
  readonly configPath: string;

  constructor(private readonly codexHome: string) {
    this.configPath = join(codexHome, "config.toml");
  }

  snapshot(): string | null {
    if (!existsSync(this.configPath)) {
      return null;
    }
    return readFileSync(this.configPath, "utf8");
  }

  restore(snapshot: string | null): void {
    if (snapshot === null) {
      writePrivateTextFile(this.configPath, "");
      return;
    }
    writePrivateTextFile(this.configPath, snapshot);
  }

  applyProjection(config: CodexProjection): void {
    const current = this.snapshot() ?? "";
    const withModelProvider = this.upsertModelProvider(current, config.endpointId);
    const withoutManagedBlock = this.removeManagedBlock(withModelProvider);
    const withoutProviderBlock = this.removeProviderBlock(withoutManagedBlock, config.endpointId);
    if (CODEX_BUILT_IN_PROVIDER_IDS.has(config.endpointId)) {
      writePrivateTextFile(this.configPath, withoutProviderBlock);
      return;
    }

    const withManagedBlock = this.upsertManagedBlock(withoutProviderBlock, this.buildManagedBlock(config));
    writePrivateTextFile(this.configPath, withManagedBlock);
  }

  private upsertModelProvider(content: string, providerId: string): string {
    const line = `model_provider = ${JSON.stringify(providerId)}`;
    if (/^model_provider\s*=.*$/m.test(content)) {
      return content.replace(/^model_provider\s*=.*$/m, line);
    }

    if (!content.trim()) {
      return `${line}\n`;
    }

    return `${line}\n${content}`;
  }

  private upsertManagedBlock(content: string, block: string): string {
    const pattern = this.managedBlockPattern();

    if (pattern.test(content)) {
      return content.replace(pattern, block);
    }

    if (!content.endsWith("\n") && content.length > 0) {
      return `${content}\n\n${block}`;
    }

    return `${content}${content.length > 0 ? "\n" : ""}${block}`;
  }

  private removeManagedBlock(content: string): string {
    return content.replace(this.managedBlockPattern(), "").replace(/\n{3,}/g, "\n\n");
  }

  private removeProviderBlock(content: string, providerId: string): string {
    const blockHeader = `[model_providers.${providerId}]`;
    const lines = content.split("\n");
    const kept: string[] = [];

    let index = 0;
    while (index < lines.length) {
      const line = lines[index];
      if (line.trim() === blockHeader) {
        index += 1;
        while (index < lines.length) {
          const nextLine = lines[index];
          if (this.isManagedBlockEnd(nextLine.trim())) {
            index += 1;
            break;
          }
          if (nextLine.trim().startsWith("[") && nextLine.trim() !== blockHeader) {
            break;
          }
          index += 1;
        }
        while (index < lines.length && lines[index].trim() === "") {
          index += 1;
        }
        continue;
      }

      kept.push(line);
      index += 1;
    }

    return kept.join("\n").replace(/\n{3,}/g, "\n\n");
  }

  private buildManagedBlock(config: CodexProjection): string {
    const lines = [
      MANAGED_BLOCK_START,
      `[model_providers.${config.endpointId}]`,
      `name = ${JSON.stringify(config.endpointLabel)}`,
      `base_url = ${JSON.stringify(config.baseUrl)}`,
      `wire_api = ${JSON.stringify(config.wireApi)}`,
    ];

    if (config.envKey) {
      lines.push(`env_key = ${JSON.stringify(config.envKey)}`);
    }

    lines.push(MANAGED_BLOCK_END, "");
    return lines.join("\n");
  }

  private escapeForRegex(value: string): string {
    return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  }

  private managedBlockPattern(): RegExp {
    const current = `${this.escapeForRegex(MANAGED_BLOCK_START)}[\\s\\S]*?${this.escapeForRegex(MANAGED_BLOCK_END)}\\n?`;
    const legacy = `${this.escapeForRegex(LEGACY_MANAGED_BLOCK_START)}[\\s\\S]*?${this.escapeForRegex(LEGACY_MANAGED_BLOCK_END)}\\n?`;
    return new RegExp(`(?:${current})|(?:${legacy})`, "m");
  }

  private isManagedBlockEnd(value: string): boolean {
    return value === MANAGED_BLOCK_END || value === LEGACY_MANAGED_BLOCK_END;
  }
}
