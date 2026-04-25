import { pbkdf2Sync, createDecipheriv } from "node:crypto";
import { existsSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";

import { CopiedSqliteDatabase } from "./Db";
import { HostLocalLogger } from "./Logger";
import { SecurityCli } from "./SecurityCli";
import type { CursorUsageSessionCandidate, CursorUsageSessionProbe } from "./Types";

type ChromiumCookieRow = {
  host_key: string;
  name: string;
  value: string;
  encrypted_value: Uint8Array;
};

type ChromiumProfileSource = {
  sourceId: string;
  sourceLabel: string;
  locationLabel: string;
  cookiesPath: string;
  safeStorageService: string;
  safeStorageAccount: string;
};

export class ChromiumCursorSessionProbe implements CursorUsageSessionProbe {
  static createDefault(): ChromiumCursorSessionProbe {
    return new ChromiumCursorSessionProbe(
      ChromiumCursorSessionProbe.listDefaultSources(process.env.NILE_BROWSER_HOME?.trim() || homedir()),
    );
  }

  static listDefaultSources(homePath: string = homedir()): ChromiumProfileSource[] {
    const base = join(homePath, "Library", "Application Support");
    return [
      {
        sourceId: "chrome",
        sourceLabel: "Chrome",
        locationLabel: "Profile 1",
        cookiesPath: join(base, "Google", "Chrome", "Profile 1", "Cookies"),
        safeStorageService: "Chrome Safe Storage",
        safeStorageAccount: "Chrome",
      },
      {
        sourceId: "chromium",
        sourceLabel: "Chromium",
        locationLabel: "Default",
        cookiesPath: join(base, "Chromium", "Default", "Cookies"),
        safeStorageService: "Chromium Safe Storage",
        safeStorageAccount: "Chromium",
      },
      {
        sourceId: "brave",
        sourceLabel: "Brave",
        locationLabel: "Default",
        cookiesPath: join(base, "BraveSoftware", "Brave-Browser", "Default", "Cookies"),
        safeStorageService: "Brave Safe Storage",
        safeStorageAccount: "Brave",
      },
      {
        sourceId: "edge",
        sourceLabel: "Microsoft Edge",
        locationLabel: "Default",
        cookiesPath: join(base, "Microsoft Edge", "Default", "Cookies"),
        safeStorageService: "Microsoft Edge Safe Storage",
        safeStorageAccount: "Microsoft Edge",
      },
    ];
  }

  constructor(
    private readonly sources: ChromiumProfileSource[],
    private readonly securityCli: SecurityCli = new SecurityCli(),
    private readonly logger: HostLocalLogger = HostLocalLogger.silent().child({ module: "chromium-cursor-session-probe" }),
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

  private readSource(source: ChromiumProfileSource): CursorUsageSessionCandidate | null {
    if (!existsSync(source.cookiesPath)) {
      return null;
    }

    const safeStorageSecret = this.readSafeStorageSecret(source);
    if (!safeStorageSecret) {
      return null;
    }

    const cookies = this.readRelevantCookies(source.cookiesPath);
    const sessionJwt = this.readCookieValue(cookies, "cursor.com", "WorkosCursorSessionToken", safeStorageSecret);
    const workosUserId = this.readCookieValue(cookies, "cursor.com", "workos_id", safeStorageSecret);
    if (!sessionJwt || !workosUserId) {
      return null;
    }

    const syncedUser = this.readCookieValue(cookies, ".cursor.com", "cursor-web-target-synced-user", safeStorageSecret);
    if (syncedUser && syncedUser !== workosUserId) {
      this.logger.warn("cursor.usage.probe.synced_user_mismatch", {
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
      sessionToken: `${workosUserId}::${sessionJwt}`,
    };
  }

  private readSafeStorageSecret(source: ChromiumProfileSource): string | null {
    const scopedResult = this.securityCli.run([
      "find-generic-password",
      "-s",
      source.safeStorageService,
      "-a",
      source.safeStorageAccount,
      "-w",
    ]);

    if (scopedResult.exitCode === 0) {
      const secret = scopedResult.stdout.trim();
      return secret || null;
    }

    const fallbackResult = this.securityCli.run([
      "find-generic-password",
      "-s",
      source.safeStorageService,
      "-w",
    ]);

    if (fallbackResult.exitCode !== 0) {
      this.logger.warn("cursor.usage.probe.safe_storage_missing", {
        sourceId: source.sourceId,
        locationLabel: source.locationLabel,
        service: source.safeStorageService,
        scopedError: scopedResult.stderr.trim(),
        fallbackError: fallbackResult.stderr.trim(),
      });
      return null;
    }

    const secret = fallbackResult.stdout.trim();
    return secret || null;
  }

  private readRelevantCookies(databasePath: string): ChromiumCookieRow[] {
    const value = CopiedSqliteDatabase.readValue(
      databasePath,
      [
        "select json_group_array(json_object(",
        "'host_key', host_key,",
        "'name', name,",
        "'value', value,",
        "'encrypted_value', hex(encrypted_value)",
        ")) as value",
        "from cookies",
        "where (host_key = 'cursor.com' and name in ('WorkosCursorSessionToken', 'workos_id'))",
        "or (host_key = '.cursor.com' and name = 'cursor-web-target-synced-user')",
      ].join(" "),
    );
    if (!value) {
      return [];
    }
    if (value === "null") {
      return [];
    }
    const rows = JSON.parse(value) as Array<{
      host_key: string;
      name: string;
      value: string;
      encrypted_value: string;
    }>;
    return rows.map((row) => ({
      host_key: row.host_key,
      name: row.name,
      value: row.value,
      encrypted_value: Buffer.from(row.encrypted_value, "hex"),
    }));
  }

  private readCookieValue(
    cookies: ChromiumCookieRow[],
    hostKey: string,
    name: string,
    safeStorageSecret: string,
  ): string | null {
    const row = cookies.find((candidate) => candidate.host_key === hostKey && candidate.name === name);
    if (!row) {
      return null;
    }

    if (row.value.trim()) {
      return row.value.trim();
    }

    return this.decryptCookieValue(row.encrypted_value, safeStorageSecret);
  }

  private decryptCookieValue(encryptedValue: Uint8Array, safeStorageSecret: string): string | null {
    const encrypted = Buffer.from(encryptedValue);
    if (encrypted.length === 0) {
      return null;
    }

    const payload = encrypted.subarray(3);
    if (encrypted.subarray(0, 3).toString("utf8") !== "v10" || payload.length === 0) {
      return null;
    }

    const key = pbkdf2Sync(safeStorageSecret, "saltysalt", 1003, 16, "sha1");
    const iv = Buffer.alloc(16, 0x20);

    try {
      const decipher = createDecipheriv("aes-128-cbc", key, iv);
      const decrypted = Buffer.concat([decipher.update(payload), decipher.final()]);
      return decrypted.toString("utf8").trim() || null;
    } catch (error) {
      this.logger.warn("cursor.usage.probe.decrypt_failed", {
        error: error instanceof Error ? error.message : String(error),
      });
      return null;
    }
  }
}
