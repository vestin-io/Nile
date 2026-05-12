import { afterEach, describe, expect, it } from "vitest";
import { mkdtempSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";

import { AccessRegistry } from "../../models/access";
import { EndpointRegistry } from "../../models/endpoint";
import { AgentSelection } from "../../models/selection/Selection";
import { AgentConnectionSettings } from "../../models/agent-settings";
import { LiveSetupMatcher } from "./Matcher";
import type { CredentialStore } from "../../services/credential/Store";
import type { StoredCredential } from "../../services/credential/Types";

const tempDirs: string[] = [];

afterEach(() => {
  while (tempDirs.length > 0) {
    rmSync(tempDirs.pop()!, { recursive: true, force: true });
  }
});

describe("LiveSetupMatcher", () => {
  it("matches a saved Claude gateway api_key connection even when the live env var name differs", () => {
    const dbPath = createTempDatabasePath();
    const credentialStore = new MemoryCredentialStore();
    const endpointRegistry = EndpointRegistry.open(dbPath);
    const accessRegistry = AccessRegistry.open(dbPath, credentialStore);
    const selection = AgentSelection.open(dbPath);

    try {
      endpointRegistry.add({
        id: "claude",
        label: "Gateway (llmfk.dpdns.org)",
        rootUrl: "https://llmfk.dpdns.org",
        profile: "generic-gateway",
        protocols: {
          anthropic: {
            basePath: "/v1",
            authSchemes: ["bearer"],
            envKeyOverride: "ANTHROPIC_AUTH_TOKEN",
            versionHeader: "2023-06-01",
          },
        },
      });
      accessRegistry.add(
        {
          id: "gateway-llmfk-dpdns-org-api-key",
          endpointId: "claude",
          label: "Gateway (llmfk.dpdns.org) API Key",
          authMode: "api_key",
          enabledAgents: ["claude", "openclaw"],
        },
        {
          kind: "api_key",
          source: "direct",
          apiKey: "secret-key",
          envKey: "NILE_GATEWAY_LLMFK_DPDNS_ORG_API_KEY_API_KEY",
        },
      );

      const matcher = new LiveSetupMatcher(
        endpointRegistry,
        accessRegistry,
        selection,
        "claude",
      );

      const result = matcher.match({
        endpoint: {
          id: "claude",
          label: "Gateway (llmfk.dpdns.org)",
          rootUrl: "https://llmfk.dpdns.org",
          profile: "generic-gateway",
          protocols: {
            anthropic: {
              authSchemes: ["bearer"],
              envKeyOverride: "ANTHROPIC_API_KEY",
              versionHeader: "2023-06-01",
            },
          },
        },
        access: {
          label: "Gateway (llmfk.dpdns.org) API Key",
          authMode: "api_key",
        },
        detectedEndpoint: {
          envKey: "ANTHROPIC_API_KEY",
        },
        credential: {
          kind: "api_key",
          source: "direct",
          apiKey: "secret-key",
        },
        detectedAccess: {
          authMode: "api_key",
        },
      });

      expect(result).toEqual({
        validity: "valid_matched",
        matchedConnection: {
          connectionId: "gateway-llmfk-dpdns-org-api-key",
          endpointId: "claude",
          accessId: "gateway-llmfk-dpdns-org-api-key",
          matchesAgentSelection: false,
        },
      });
    } finally {
      selection.close();
      accessRegistry.close();
      endpointRegistry.close();
    }
  });

  it("ignores OpenClaw-selected model settings when matching a Claude api_key connection", () => {
    const dbPath = createTempDatabasePath();
    const credentialStore = new MemoryCredentialStore();
    const endpointRegistry = EndpointRegistry.open(dbPath);
    const accessRegistry = AccessRegistry.open(dbPath, credentialStore);
    const selection = AgentSelection.open(dbPath);

    try {
      endpointRegistry.add({
        id: "claude",
        label: "Gateway (llmfk.dpdns.org)",
        rootUrl: "https://llmfk.dpdns.org",
        profile: "generic-gateway",
        protocols: {
          anthropic: {
            basePath: "/v1",
            authSchemes: ["bearer"],
            envKeyOverride: "ANTHROPIC_AUTH_TOKEN",
            versionHeader: "2023-06-01",
          },
        },
      });
      accessRegistry.add(
        {
          id: "gateway-llmfk-dpdns-org-api-key",
          endpointId: "claude",
          label: "Gateway (llmfk.dpdns.org) API Key",
          authMode: "api_key",
          enabledAgents: ["claude", "openclaw"],
        },
        {
          kind: "api_key",
          source: "direct",
          apiKey: "secret-key",
          envKey: "NILE_GATEWAY_LLMFK_DPDNS_ORG_API_KEY_API_KEY",
        },
      );
      const settings = AgentConnectionSettings.open(dbPath);
      settings.setModelId("openclaw", "gateway-llmfk-dpdns-org-api-key", "gpt-5.3-codex");
      settings.close();

      const matcher = new LiveSetupMatcher(
        endpointRegistry,
        accessRegistry,
        selection,
        "claude",
      );

      const result = matcher.match({
        endpoint: {
          id: "claude",
          label: "Gateway (llmfk.dpdns.org)",
          rootUrl: "https://llmfk.dpdns.org",
          profile: "generic-gateway",
          protocols: {
            anthropic: {
              authSchemes: ["bearer"],
              envKeyOverride: "ANTHROPIC_API_KEY",
              versionHeader: "2023-06-01",
            },
          },
        },
        access: {
          label: "Gateway (llmfk.dpdns.org) API Key",
          authMode: "api_key",
        },
        detectedEndpoint: {
          envKey: "ANTHROPIC_API_KEY",
        },
        credential: {
          kind: "api_key",
          source: "direct",
          apiKey: "secret-key",
        },
        detectedAccess: {
          authMode: "api_key",
        },
      });

      expect(result.validity).toBe("valid_matched");
      expect(result.matchedConnection?.connectionId).toBe("gateway-llmfk-dpdns-org-api-key");
    } finally {
      selection.close();
      accessRegistry.close();
      endpointRegistry.close();
    }
  });
});

function createTempDatabasePath(): string {
  const dir = mkdtempSync(join(tmpdir(), "nile-live-setup-matcher-"));
  tempDirs.push(dir);
  return join(dir, "switcher.sqlite");
}

class MemoryCredentialStore implements CredentialStore {
  private readonly values = new Map<string, StoredCredential>();

  create(reference: string, credential: StoredCredential): void {
    this.values.set(reference, credential);
  }

  update(reference: string, credential: StoredCredential): void {
    this.values.set(reference, credential);
  }

  set(reference: string, credential: StoredCredential): void {
    this.values.set(reference, credential);
  }

  get(reference: string): StoredCredential {
    const credential = this.values.get(reference);
    if (!credential) {
      throw new Error(`Missing credential: ${reference}`);
    }
    return credential;
  }

  remove(reference: string): void {
    this.values.delete(reference);
  }

  has(reference: string): boolean {
    return this.values.has(reference);
  }
}
