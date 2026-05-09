import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";

type ProfileFeatureFile = {
  enabled?: unknown;
};

export class DesktopProfileFeatureStore {
  constructor(private readonly filePath: string) {}

  read(): boolean {
    if (!existsSync(this.filePath)) {
      return true;
    }

    const raw = readFileSync(this.filePath, "utf8");
    if (!raw.trim()) {
      return true;
    }

    const parsed = JSON.parse(raw) as ProfileFeatureFile;
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
      throw new Error("Desktop profile feature config must contain a JSON object");
    }

    return parsed.enabled !== false;
  }

  write(enabled: boolean): boolean {
    if (enabled) {
      rmSync(this.filePath, { force: true });
      return true;
    }

    mkdirSync(dirname(this.filePath), { recursive: true });
    writeFileSync(this.filePath, `${JSON.stringify({ enabled: false }, null, 2)}\n`, "utf8");
    return false;
  }
}
