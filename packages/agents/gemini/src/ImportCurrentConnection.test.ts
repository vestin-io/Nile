import { afterEach, describe, expect, it } from "vitest";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { LiveSetupImportSupport } from "@nile/core/actions/live-setup";
import { LiveSetupMatcher } from "@nile/core/actions/live-setup";
import { AccessRegistry } from "@nile/core/models/access";
import { KeychainCredentialStore } from "@nile/core/services/credential";
import type { StoredCredential } from "@nile/core/services/credential";
import { NileLogger } from "@nile/core/services/NileLogger";
import { AgentWorkspaceSession } from "@nile/core/runtime-local/AgentWorkspaceSession";
import { GeminiAccountsStore } from "./AccountsStore";
import { GeminiCredentialBackend } from "./Backend";
import { GeminiCredentialStore } from "./CredentialStore";
import { ImportCurrentConnection } from "./ImportCurrentConnection";
import { GeminiKeychainCredentialStore } from "./KeychainStore";
import { GeminiSessionReader } from "./Reader";
import { GeminiSettingsStore } from "./SettingsStore";
import { GEMINI_AGENT_ID } from "./types";
import { LiveSetupDetector } from "./live-setup/Detector";
import { LiveSetupReader } from "./live-setup/Reader";

const tempDirs: string[] = [];

afterEach(() => {
  while (tempDirs.length > 0) {
    rmSync(tempDirs.pop()!, { recursive: true, force: true });
  }
});

describe("Gemini ImportCurrentConnection", () => {
  it("imports the current Gemini CLI session as a Gemini-only saved connection", async () => {
    const setup = createSetup();
    seedGeminiLocalSession(setup.geminiHome, "gemini.primary@example.test", "google-sub-123");
    const context = AgentWorkspaceSession.open(setup.dbPath, setup.credentialStore);
    const reader = createLiveSetupReader(setup.geminiHome);
    const detector = new LiveSetupDetector(
      reader,
      new LiveSetupMatcher(
        context.sharedContext.endpointRegistry,
        context.sharedContext.accessRegistry,
        context.agentSelection,
        GEMINI_AGENT_ID,
        context.sharedContext.agentConnectionSettings,
      ),
      NileLogger.silent(),
    );
    const importer = new ImportCurrentConnection(
      new LiveSetupImportSupport(
        GEMINI_AGENT_ID,
        "Gemini",
        context.sharedContext.endpointRegistry,
        context.sharedContext.accessRegistry,
        context.agentSelection,
        context.sharedContext.agentConnectionSettings,
        NileLogger.silent(),
      ),
      detector,
      reader,
      context,
    );

    const result = await importer.importCurrent();

    expect(result).toEqual({
      id: "gemini-primary-example-test",
      label: "gemini.primary@example.test",
      endpointId: "gemini",
      endpointLabel: "Gemini",
      endpointFamily: "gemini",
      authMode: "gemini_cli_session",
    });

    const accesses = AccessRegistry.open(setup.dbPath, setup.credentialStore);
    const imported = accesses.get(result.id);
    expect(imported?.authMode).toBe("gemini_cli_session");
    expect(imported?.identityKey).toBe("google-sub:google-sub-123");
    expect(imported?.enabledAgents).toEqual(["gemini"]);
    expect(accesses.readCredential(result.id)).toEqual({
      kind: "gemini_cli_session",
      accessToken: "gemini-access",
      refreshToken: "gemini-refresh",
      idToken: createJwt({ email: "gemini.primary@example.test", sub: "google-sub-123" }),
      expiryDate: 1800000000000,
    });
    accesses.close();

    importer.close();
  });
});

function createSetup() {
  const dir = mkdtempSync(join(tmpdir(), "nile-gemini-import-"));
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

class StubCredentialStore extends KeychainCredentialStore {
  private readonly records = new Map<string, StoredCredential>();

  override create(reference: string, credential: StoredCredential): void {
    this.records.set(reference, credential);
  }

  override update(reference: string, credential: StoredCredential): void {
    this.records.set(reference, credential);
  }

  override get(reference: string): StoredCredential {
    const credential = this.records.get(reference);
    if (!credential) {
      throw new Error(`Credential not found: ${reference}`);
    }
    return credential;
  }

  override has(reference: string): boolean {
    return this.records.has(reference);
  }

  override remove(reference: string): void {
    this.records.delete(reference);
  }
}
