import { existsSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";

import { CopiedSqliteDatabase } from "./Db";
import { CursorLocalIdentity } from "./Identity";
import { HostLocalLogger } from "./Logger";
import type { CursorUsageSessionCandidate, CursorUsageSessionProbe } from "./Types";

type CursorStateDbSource = {
  sourceId: string;
  sourceLabel: string;
  locationLabel: string;
  databasePath: string;
};

export class CursorStateDbProbe implements CursorUsageSessionProbe {
  static createDefault(): CursorStateDbProbe {
    return new CursorStateDbProbe(this.listDefaultSources(process.env.NILE_CURSOR_HOME?.trim() || homedir()));
  }

  static listDefaultSources(homePath: string = homedir()): CursorStateDbSource[] {
    return [
      {
        sourceId: "cursor-local-state",
        sourceLabel: "Cursor",
        locationLabel: "Local session",
        databasePath: join(
          homePath,
          "Library",
          "Application Support",
          "Cursor",
          "User",
          "globalStorage",
          "state.vscdb",
        ),
      },
    ];
  }

  constructor(
    private readonly sources: CursorStateDbSource[],
    private readonly logger: HostLocalLogger = HostLocalLogger.silent().child({ module: "cursor-state-db-probe" }),
  ) {}

  probe(): CursorUsageSessionCandidate[] {
    const candidates: CursorUsageSessionCandidate[] = [];
    for (const source of this.sources) {
      const candidate = this.readSource(source);
      if (candidate) {
        candidates.push(candidate);
      }
    }
    return candidates;
  }

  private readSource(source: CursorStateDbSource): CursorUsageSessionCandidate | null {
    if (!existsSync(source.databasePath)) {
      return null;
    }

    const accessToken = CopiedSqliteDatabase.readValue(
      source.databasePath,
      "select value from ItemTable where key = ?",
      ["cursorAuth/accessToken"],
    );
    if (!accessToken) {
      return null;
    }

    const authId = this.readAuthId(accessToken);
    if (!authId) {
      this.logger.warn("cursor.usage.probe.state_db.invalid_auth_id", {
        sourceId: source.sourceId,
        locationLabel: source.locationLabel,
      });
      return null;
    }

    const workosUserId = CursorLocalIdentity.parseWorkosUserId(authId);
    if (!workosUserId) {
      this.logger.warn("cursor.usage.probe.state_db.invalid_workos_user", {
        sourceId: source.sourceId,
        locationLabel: source.locationLabel,
      });
      return null;
    }

    return {
      sourceId: source.sourceId,
      sourceLabel: source.sourceLabel,
      locationLabel: source.locationLabel,
      workosUserId,
      sessionToken: `${workosUserId}::${accessToken}`,
    };
  }

  private readAuthId(jwt: string): string | null {
    const parts = jwt.split(".");
    if (parts.length !== 3 || !parts[1]) {
      return null;
    }

    try {
      const payload = JSON.parse(Buffer.from(this.normalizeBase64(parts[1]), "base64").toString("utf8")) as {
        sub?: unknown;
      };
      return typeof payload.sub === "string" && payload.sub.trim() ? payload.sub.trim() : null;
    } catch {
      return null;
    }
  }

  private normalizeBase64(value: string): string {
    const normalized = value.replace(/-/g, "+").replace(/_/g, "/");
    const remainder = normalized.length % 4;
    return remainder === 0 ? normalized : `${normalized}${"=".repeat(4 - remainder)}`;
  }
}
