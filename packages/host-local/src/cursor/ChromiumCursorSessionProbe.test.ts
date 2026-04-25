import { afterEach, describe, expect, it } from "vitest";
import { createCipheriv, pbkdf2Sync } from "node:crypto";
import { mkdirSync, mkdtempSync, rmSync } from "node:fs";
import { dirname, join } from "node:path";
import { tmpdir } from "node:os";
import { DatabaseSync } from "node:sqlite";

import { ChromiumCursorSessionProbe } from "./ChromiumCursorSessionProbe";
import { SecurityCli, type SecurityCliResult } from "./SecurityCli";

const tempDirs: string[] = [];

afterEach(() => {
  while (tempDirs.length > 0) {
    rmSync(tempDirs.pop()!, { recursive: true, force: true });
  }
});

describe("ChromiumCursorSessionProbe", () => {
  it("reads and decrypts Cursor web session cookies from a Chromium profile", () => {
    const dir = mkdtempSync(join(tmpdir(), "nile-chromium-probe-"));
    tempDirs.push(dir);
    const cookiesPath = join(dir, "Cookies");
    writeCookiesDatabase(cookiesPath, SAFE_STORAGE_SECRET);

    const probe = new ChromiumCursorSessionProbe(
      [
        {
          sourceId: "chrome",
          sourceLabel: "Chrome",
          locationLabel: "Profile 1",
          cookiesPath,
          safeStorageService: "Chrome Safe Storage",
          safeStorageAccount: "Chrome",
        },
      ],
      new StubSecurityCli(),
    );

    expect(probe.probe()).toEqual([
      {
        sourceId: "chrome",
        sourceLabel: "Chrome",
        locationLabel: "Profile 1",
        workosUserId: "user_01K03K41CNGRCADY5VT0JPH69Y",
        sessionToken: CURSOR_WEB_SESSION_TOKEN,
      },
    ]);
  });

  it("falls back to service-only safe storage lookup when the scoped account lookup misses", () => {
    const dir = mkdtempSync(join(tmpdir(), "nile-chromium-probe-"));
    tempDirs.push(dir);
    const cookiesPath = join(dir, "Cookies");
    writeCookiesDatabase(cookiesPath, SAFE_STORAGE_SECRET);

    const probe = new ChromiumCursorSessionProbe(
      [
        {
          sourceId: "chrome",
          sourceLabel: "Chrome",
          locationLabel: "Profile 1",
          cookiesPath,
          safeStorageService: "Chrome Safe Storage",
          safeStorageAccount: "Chrome",
        },
      ],
      new FallbackSecurityCli(),
    );

    expect(probe.probe()).toEqual([
      {
        sourceId: "chrome",
        sourceLabel: "Chrome",
        locationLabel: "Profile 1",
        workosUserId: "user_01K03K41CNGRCADY5VT0JPH69Y",
        sessionToken: CURSOR_WEB_SESSION_TOKEN,
      },
    ]);
  });
});

function writeCookiesDatabase(databasePath: string, safeStorageSecret: string): void {
  mkdirSync(dirname(databasePath), { recursive: true });
  const db = new DatabaseSync(databasePath);
  try {
    db.exec(
      [
        "create table cookies (",
        "host_key text not null,",
        "name text not null,",
        "value text not null,",
        "encrypted_value blob not null",
        ");",
      ].join(" "),
    );
    insertCookie(db, "cursor.com", "WorkosCursorSessionToken", encryptCookieValue(WEB_JWT, safeStorageSecret));
    insertCookie(db, "cursor.com", "workos_id", encryptCookieValue("user_01K03K41CNGRCADY5VT0JPH69Y", safeStorageSecret));
    insertCookie(db, ".cursor.com", "cursor-web-target-synced-user", encryptCookieValue("user_01K03K41CNGRCADY5VT0JPH69Y", safeStorageSecret));
  } finally {
    db.close();
  }
}

function insertCookie(db: DatabaseSync, hostKey: string, name: string, encryptedValue: Buffer): void {
  db.prepare(
    "insert into cookies (host_key, name, value, encrypted_value) values (?, ?, '', ?)",
  ).run(hostKey, name, encryptedValue);
}

function encryptCookieValue(value: string, safeStorageSecret: string): Buffer {
  const key = pbkdf2Sync(safeStorageSecret, "saltysalt", 1003, 16, "sha1");
  const iv = Buffer.alloc(16, 0x20);
  const cipher = createCipheriv("aes-128-cbc", key, iv);
  return Buffer.concat([Buffer.from("v10"), cipher.update(value, "utf8"), cipher.final()]);
}

class StubSecurityCli extends SecurityCli {
  override run(_args: string[]): SecurityCliResult {
    return {
      exitCode: 0,
      stdout: `${SAFE_STORAGE_SECRET}\n`,
      stderr: "",
    };
  }
}

class FallbackSecurityCli extends SecurityCli {
  override run(args: string[]): SecurityCliResult {
    if (args.includes("-a")) {
      return {
        exitCode: 44,
        stdout: "",
        stderr: "security: SecKeychainSearchCopyNext: The specified item could not be found in the keychain.\n",
      };
    }

    return {
      exitCode: 0,
      stdout: `${SAFE_STORAGE_SECRET}\n`,
      stderr: "",
    };
  }
}

const SAFE_STORAGE_SECRET = "AAAAAAAAAAAAAAAAAAAAAA==";
const WEB_JWT = "eyJhbGciOiJub25lIiwidHlwIjoiSldUIn0.eyJzdWIiOiJhdXRoMHx1c2VyXzAxSzAzSzQxQ05HUkNBRFk1VlQwSlBINjlZIiwidHlwZSI6IndlYiIsImV4cCI6NDEwMjQ0NDgwMH0.sig";
const CURSOR_WEB_SESSION_TOKEN = `user_01K03K41CNGRCADY5VT0JPH69Y::${WEB_JWT}`;
