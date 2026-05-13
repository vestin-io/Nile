import { afterEach, describe, expect, it } from "vitest";
import { chmodSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";

import { EnvironmentSource } from "../services/EnvironmentSource";
import { SqliteDatabase } from "../services/database/SqliteDatabase";
import { SessionRuntime } from "./SessionRuntime";

const tempDirs: string[] = [];

afterEach(() => {
  while (tempDirs.length > 0) {
    rmSync(tempDirs.pop()!, { recursive: true, force: true });
  }
});

describe("SessionRuntime", () => {
  it("uses the injected environment when building the default Codex login helper", async () => {
    const originalPath = process.env.PATH;
    const dir = mkdtempSync(join(tmpdir(), "nile-runtime-"));
    tempDirs.push(dir);
    const binDir = join(dir, "bin");
    const codexHome = join(dir, ".codex");
    const database = SqliteDatabase.open(join(dir, "db.sqlite"));
    writeFakeCodex(binDir);

    process.env.PATH = "";
    const runtime = new SessionRuntime({
      agentHomes: { codex: codexHome },
      credentialStore: {
        create: () => {},
        update: () => {},
        get: () => {
          throw new Error("not used");
        },
        has: () => false,
        remove: () => {},
      } as never,
      database,
      databasePath: join(dir, "db.sqlite"),
      environment: EnvironmentSource.from({ PATH: binDir }),
    });

    try {
      const credential = await runtime.createLocalCredentialResolver().resolveAsync({
        authMode: "openai_session",
        source: "login",
      });

      expect(credential).toEqual(
        expect.objectContaining({
          kind: "openai_session",
          accountId: "acct-injected-env",
        }),
      );
    } finally {
      process.env.PATH = originalPath;
      runtime.close();
    }
  });
});

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
}
