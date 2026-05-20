import { afterEach, describe, expect, it, vi } from "vitest";
import { chmodSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { tmpdir } from "node:os";

import { CursorUsageBindingRegistry, CursorUsageSnapshotStore } from "@nile/agent-cursor/usage";
import { AccessRegistry } from "@nile/core/models/access";
import { EndpointRegistry } from "@nile/core/models/endpoint";
import { EnvironmentSource } from "@nile/core/services/EnvironmentSource";
import { NileLogger } from "@nile/core/services/NileLogger";
import { NileSession } from "./NileSession";

const tempDirs: string[] = [];

afterEach(() => {
  while (tempDirs.length > 0) {
    rmSync(tempDirs.pop()!, { recursive: true, force: true });
  }
});

describe("NileSession", () => {
  it("uses the injected environment when resolving the default Codex login helper", async () => {
    const originalPath = process.env.PATH;
    const dir = mkdtempSync(join(tmpdir(), "nile-runtime-"));
    tempDirs.push(dir);
    const binDir = join(dir, "bin");
    const codexHome = join(dir, ".codex");
    writeFakeCodex(binDir);
    const createDefaultLogger = vi.spyOn(NileLogger, "createDefault").mockReturnValue(NileLogger.silent());

    process.env.PATH = "";
    const session = NileSession.open({
      agentHomes: { codex: codexHome },
      credentialStore: new StubCredentialStore() as never,
      databasePath: join(dir, "db.sqlite"),
      environment: EnvironmentSource.from({ PATH: binDir }),
      logger: NileLogger.silent(),
    });

    try {
      const result = await session.createLocalConnection({
        preset: "openai",
        authMode: "openai_session",
        credentialRequest: {
          authMode: "openai_session",
          source: "login",
        },
      });

      expect(session.readConnectionCredential(result.id)).toEqual(
        expect.objectContaining({
          kind: "openai_session",
          accountId: "acct-injected-env",
        }),
      );
    } finally {
      createDefaultLogger.mockRestore();
      process.env.PATH = originalPath;
      session.close();
    }
  });

  it("removes saved Cursor usage artifacts when deleting a connection", () => {
    const setup = createSetup();

    const endpointRegistry = EndpointRegistry.open(setup.dbPath);
    endpointRegistry.add({
      id: "cursor",
      label: "Cursor",
      rootUrl: "https://api2.cursor.sh",
      profile: "cursor-backend",
      protocols: {
        cursor: {},
      },
    });
    endpointRegistry.close();

    const accessRegistry = AccessRegistry.open(setup.dbPath, setup.credentialStore);
    accessRegistry.add(
      {
        id: "cursor-session",
        endpointId: "cursor",
        label: "cursor.user@example.com",
        authMode: "cursor_session",
        identityKey: "auth:auth0|user_01K03K41CNGRCADY5VT0JPH69Y",
      },
      {
        kind: "cursor_session",
        accessToken: "cursor-access-token",
        refreshToken: "cursor-refresh-token",
        authId: "auth0|user_01K03K41CNGRCADY5VT0JPH69Y",
        email: "cursor.user@example.com",
      },
    );
    accessRegistry.close();

    const bindingRegistry = CursorUsageBindingRegistry.open(setup.dbPath, setup.credentialStore);
    bindingRegistry.bind(
      {
        connectionId: "cursor-session",
        accountFingerprint: {
          authId: "auth0|user_01K03K41CNGRCADY5VT0JPH69Y",
          workosUserId: "user_01K03K41CNGRCADY5VT0JPH69Y",
          email: "cursor.user@example.com",
        },
      },
      CURSOR_WEB_SESSION_TOKEN,
    );
    bindingRegistry.close();

    const snapshotStore = CursorUsageSnapshotStore.open(setup.dbPath);
    snapshotStore.save({
      connectionId: "cursor-session",
      accountFingerprint: {
        authId: "auth0|user_01K03K41CNGRCADY5VT0JPH69Y",
        workosUserId: "user_01K03K41CNGRCADY5VT0JPH69Y",
        email: "cursor.user@example.com",
      },
      totalPercentUsed: 12,
      autoPercentUsed: 8,
      apiPercentUsed: 4,
      billingCycleStart: "2026-05-01T00:00:00.000Z",
      billingCycleEnd: "2026-06-01T00:00:00.000Z",
      fetchedAt: "2026-05-03T00:00:00.000Z",
      freshness: "live",
    });
    snapshotStore.close();

    const session = NileSession.open({
      databasePath: setup.dbPath,
      credentialStore: setup.credentialStore,
      logger: NileLogger.silent(),
    });

    try {
      expect(session.removeConnection("cursor-session")).toEqual({
        id: "cursor-session",
        removed: true,
        clearedAgents: [],
      });
    } finally {
      session.close();
    }

    const verificationBindings = CursorUsageBindingRegistry.open(setup.dbPath, setup.credentialStore);
    const verificationSnapshots = CursorUsageSnapshotStore.open(setup.dbPath);
    const verificationAccesses = AccessRegistry.open(setup.dbPath, setup.credentialStore);

    try {
      expect(verificationBindings.get("cursor-session")).toBeNull();
      expect(verificationSnapshots.get("cursor-session")).toBeNull();
      expect(verificationAccesses.get("cursor-session")).toBeNull();
      expect(setup.credentialStore.has("usage:cursor:cursor-session")).toBe(false);
    } finally {
      verificationBindings.close();
      verificationSnapshots.close();
      verificationAccesses.close();
    }
  });
});

function createSetup(): {
  dbPath: string;
  credentialStore: StubCredentialStore;
} {
  const dir = mkdtempSync(join(tmpdir(), "nile-session-remove-"));
  tempDirs.push(dir);
  return {
    dbPath: join(dir, "switcher.sqlite"),
    credentialStore: new StubCredentialStore(),
  };
}

class StubCredentialStore {
  private readonly credentials = new Map<string, unknown>();

  create(id: string, credential: unknown): void {
    this.credentials.set(id, credential);
  }

  update(id: string, credential: unknown): void {
    this.credentials.set(id, credential);
  }

  get(id: string) {
    const credential = this.credentials.get(id);
    if (!credential) {
      throw new Error(`Missing stub credential: ${id}`);
    }
    return credential as never;
  }

  has(id: string): boolean {
    return this.credentials.has(id);
  }

  remove(id: string): void {
    this.credentials.delete(id);
  }
}

function writeFakeCodex(binDir: string): void {
  mkdirSync(binDir, { recursive: true });
  const scriptPath = join(binDir, "codex");
  writeFileSync(
    scriptPath,
    `#!/bin/sh
set -eu
/bin/mkdir -p "$CODEX_HOME"
/bin/cat > "$CODEX_HOME/auth.json" <<'EOF'
{
  "OPENAI_API_KEY": null,
  "tokens": {
    "id_token": "id-token",
    "access_token": "access-token",
    "refresh_token": "refresh-token",
    "account_id": "acct-injected-env"
  },
  "last_refresh": "2026-05-05T00:00:00.000Z"
}
EOF
`,
    "utf8",
  );
  chmodSync(scriptPath, 0o755);

  const targetTriple = readTargetTriple();
  if (!targetTriple) {
    throw new Error(`Unsupported test platform: ${process.platform}/${process.arch}`);
  }
  const vendorRoot = join(dirname(binDir), "node_modules", "@openai", readOptionalPackageDirectoryName(), "vendor", targetTriple, "codex");
  mkdirSync(vendorRoot, { recursive: true });
  writeFileSync(join(vendorRoot, "codex"), "", "utf8");
}

const CURSOR_WEB_SESSION_TOKEN =
  "user_01K03K41CNGRCADY5VT0JPH69Y::eyJhbGciOiJub25lIiwidHlwIjoiSldUIn0.eyJzdWIiOiJhdXRoMHx1c2VyXzAxSzAzSzQxQ05HUkNBRFk1VlQwSlBINjlZIiwidHlwZSI6IndlYiIsImV4cCI6NDEwMjQ0NDgwMH0.sig";

function readTargetTriple(): string | null {
  if (process.platform === "darwin" && process.arch === "arm64") {
    return "aarch64-apple-darwin";
  }
  if (process.platform === "darwin" && process.arch === "x64") {
    return "x86_64-apple-darwin";
  }
  if (process.platform === "linux" && process.arch === "arm64") {
    return "aarch64-unknown-linux-gnu";
  }
  if (process.platform === "linux" && process.arch === "x64") {
    return "x86_64-unknown-linux-gnu";
  }
  if (process.platform === "win32" && process.arch === "arm64") {
    return "aarch64-pc-windows-msvc";
  }
  if (process.platform === "win32" && process.arch === "x64") {
    return "x86_64-pc-windows-msvc";
  }
  return null;
}

function readOptionalPackageDirectoryName(): string {
  if (process.platform === "darwin" && process.arch === "arm64") {
    return "codex-darwin-arm64";
  }
  if (process.platform === "darwin" && process.arch === "x64") {
    return "codex-darwin-x64";
  }
  if (process.platform === "linux" && process.arch === "arm64") {
    return "codex-linux-arm64";
  }
  if (process.platform === "linux" && process.arch === "x64") {
    return "codex-linux-x64";
  }
  if (process.platform === "win32" && process.arch === "arm64") {
    return "codex-win32-arm64";
  }
  if (process.platform === "win32" && process.arch === "x64") {
    return "codex-win32-x64";
  }
  throw new Error(`Unsupported test platform: ${process.platform}/${process.arch}`);
}
