import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { dirname, resolve } from "node:path";

import { resolveAgentHome, type AgentHomes } from "@nile/core/models/agent";
import { isAgentId, type AgentId } from "@nile/core/models/agent";

export class AgentHomesStore {
  constructor(private readonly filePath: string) {}

  read(): AgentHomes {
    if (!existsSync(this.filePath)) {
      return {};
    }

    const raw = readFileSync(this.filePath, "utf8");
    if (!raw.trim()) {
      return {};
    }

    const parsed = JSON.parse(raw) as unknown;
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
      throw new Error("Desktop agent homes config must contain a JSON object");
    }

    return Object.fromEntries(
      Object.entries(parsed).flatMap(([agentId, path]) => {
        if (!isAgentId(agentId)) {
          return [];
        }
        if (typeof path !== "string" || !path.trim()) {
          return [];
        }
        return [[agentId, path.trim()]];
      }),
    ) as AgentHomes;
  }

  update(agentId: AgentId, path: string | null | undefined): AgentHomes {
    const next = this.read();
    const normalizedPath = this.normalizePath(path);
    if (!normalizedPath || normalizedPath === resolveAgentHome(agentId)) {
      delete next[agentId];
    } else {
      next[agentId] = normalizedPath;
    }

    this.write(next);
    return next;
  }

  private write(homes: AgentHomes): void {
    if (Object.keys(homes).length === 0) {
      rmSync(this.filePath, { force: true });
      return;
    }

    mkdirSync(dirname(this.filePath), { recursive: true });
    writeFileSync(this.filePath, `${JSON.stringify(homes, null, 2)}\n`, "utf8");
  }

  private normalizePath(path: string | null | undefined): string | null {
    const trimmed = path?.trim();
    if (!trimmed) {
      return null;
    }

    const expanded = trimmed === "~"
      ? homedir()
      : trimmed.startsWith("~/")
        ? resolve(homedir(), trimmed.slice(2))
        : resolve(trimmed);
    return expanded.trim() || null;
  }
}
