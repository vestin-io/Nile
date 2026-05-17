import { afterEach, describe, expect, it } from "vitest";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { LiveSetupMatcher } from "@nile/core/actions/live-setup";
import { KeychainCredentialStore } from "@nile/core/services/credential";
import { NileLogger } from "@nile/core/services/NileLogger";
import { AgentWorkspaceSession } from "@nile/core/runtime-local/AgentWorkspaceSession";
import { GeminiAccountsStore } from "../AccountsStore";
import { GeminiCredentialBackend } from "../Backend";
import { GeminiCredentialStore } from "../CredentialStore";
import { GeminiKeychainCredentialStore } from "../KeychainStore";
import { GeminiSessionReader } from "../Reader";
import { GeminiSettingsStore } from "../SettingsStore";
import { GEMINI_AGENT_ID } from "../types";
import { LiveSetupDetector } from "./Detector";
import { LiveSetupReader } from "./Reader";

const tempDirs: string[] = [];

afterEach(() => {
  while (tempDirs.length > 0) {
    rmSync(tempDirs.pop()!, { recursive: true, force: true });
  }
});

describe("Gemini LiveSetupDetector", () => {
  it("reports an import candidate for a complete local Gemini session", () => {
    const setup = createSetup();
    seedGeminiLocalSession(setup.geminiHome, "gemini.primary@example.test", "google-sub-123");

    const context = AgentWorkspaceSession.open(setup.dbPath, setup.credentialStore);
    const detector = new LiveSetupDetector(
      createLiveSetupReader(setup.geminiHome),
      new LiveSetupMatcher(
        context.sharedContext.endpointRegistry,
        context.sharedContext.accessRegistry,
        context.agentSelection,
        GEMINI_AGENT_ID,
        context.sharedContext.agentConnectionSettings,
      ),
      NileLogger.silent(),
      context,
    );

    expect(detector.detect()).toEqual({
      agentId: GEMINI_AGENT_ID,
      validity: "valid_import_candidate",
      issues: [],
      endpoint: {
        endpointFamily: "gemini",
        endpointIdHint: "gemini",
        labelHint: "Gemini",
        baseUrl: "https://generativelanguage.googleapis.com",
      },
      access: {
        authMode: "gemini_cli_session",
        labelHint: "gemini.primary@example.test",
        identityKey: "google-sub:google-sub-123",
      },
      matchedConnection: null,
    });

    detector.close();
  });
});

function createSetup() {
  const dir = mkdtempSync(join(tmpdir(), "nile-gemini-detector-"));
  tempDirs.push(dir);
  const geminiHome = join(dir, ".gemini");
  mkdirSync(geminiHome, { recursive: true });
  return {
    dbPath: join(dir, "switcher.sqlite"),
    geminiHome,
    credentialStore: new StubCredentialStore(),
  };
}

function seedGeminiLocalSession(geminiHome: string, email: string, subject: string): void {
  writeFileSync(
    join(geminiHome, "settings.json"),
    JSON.stringify({
      security: {
        auth: {
          selectedType: "oauth-personal",
        },
      },
    }, null, 2),
    "utf8",
  );
  writeFileSync(
    join(geminiHome, "google_accounts.json"),
    JSON.stringify({
      active: email,
      old: [],
    }, null, 2),
    "utf8",
  );
  writeFileSync(
    join(geminiHome, "oauth_creds.json"),
    JSON.stringify({
      access_token: "gemini-access",
      refresh_token: "gemini-refresh",
      id_token: createJwt({ email, sub: subject }),
      expiry_date: 1800000000000,
    }, null, 2),
    "utf8",
  );
}

function createLiveSetupReader(geminiHome: string): LiveSetupReader {
  return new LiveSetupReader(
    new GeminiSessionReader(
      new GeminiCredentialBackend(
        new GeminiCredentialStore(geminiHome),
        new GeminiKeychainCredentialStore(new MemoryGenericPasswordClient()),
      ),
      new GeminiAccountsStore(geminiHome),
      new GeminiSettingsStore(geminiHome),
    ),
  );
}

function createJwt(payload: Record<string, string>): string {
  return `header.${Buffer.from(JSON.stringify(payload)).toString("base64url")}.signature`;
}

class MemoryGenericPasswordClient {
  read() {
    return {
      exitCode: 44,
      stdout: "",
      stderr: "The specified item could not be found in the keychain.",
    };
  }

  write() {
    return {
      exitCode: 0,
      stdout: "",
      stderr: "",
    };
  }

  remove() {
    return {
      exitCode: 0,
      stdout: "",
      stderr: "",
    };
  }
}

class StubCredentialStore extends KeychainCredentialStore {}
