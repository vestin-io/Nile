import { describe, expect, it, vi } from "vitest";

import type { SavedConnectionSummary } from "@nile/core/models/connection";
import type { StoredCredential } from "@nile/core/services/credential";

import { ManagedApiKeyEnvironment } from "./ManagedApiKeyEnvironment";

describe("ManagedApiKeyEnvironment", () => {
  it("attaches an env key through the direct-api-key metadata path without wiring shell exports for non-shell agents", async () => {
    const write = vi.fn();
    const ensureShell = vi.fn();
    const setConnectionDirectApiKeyEnvKey = vi.fn().mockReturnValue({
      id: "gateway-shared-api-key",
      endpointId: "gateway-shared",
      endpointUrl: "https://llmfk.dpdns.org/v1",
      label: "Gateway (llmfk.dpdns.org) API Key",
      endpointLabel: "Gateway (llmfk.dpdns.org)",
      endpointFamily: "gateway",
      authMode: "api_key",
      apiKeySource: "direct",
      envKey: "NILE_GATEWAY_SHARED_API_KEY_API_KEY",
      enabledAgents: ["codex", "claude"],
      configurableAgents: ["codex", "claude", "openclaw"],
      selectedByAgents: ["claude"],
    } satisfies SavedConnectionSummary);
    const updateConnection = vi.fn();

    const environment = new ManagedApiKeyEnvironment(
      {
        read: vi.fn().mockReturnValue(null),
        write,
      } as never,
      {
        has: vi.fn().mockReturnValue(false),
        ensure: ensureShell,
        remove: vi.fn(),
      } as never,
    );

    const result = await environment.ensureForConnection({
      listSavedConnections: () => [{
        id: "gateway-shared-api-key",
        endpointId: "gateway-shared",
        endpointUrl: "https://llmfk.dpdns.org/v1",
        label: "Gateway (llmfk.dpdns.org) API Key",
        endpointLabel: "Gateway (llmfk.dpdns.org)",
        endpointFamily: "gateway",
        authMode: "api_key",
        apiKeySource: "direct",
        enabledAgents: ["codex", "claude"],
        configurableAgents: ["codex", "claude", "openclaw"],
        selectedByAgents: ["claude"],
      }],
      readConnectionCredential: (): StoredCredential => ({
        kind: "api_key",
        apiKey: "gateway-secret",
      }),
      setConnectionDirectApiKeyEnvKey,
      updateConnection,
    } as never, "gateway-shared-api-key");

    expect(write).toHaveBeenCalledWith(
      "NILE_GATEWAY_SHARED_API_KEY_API_KEY",
      "gateway-secret",
    );
    expect(ensureShell).not.toHaveBeenCalled();
    expect(setConnectionDirectApiKeyEnvKey).toHaveBeenCalledWith(
      "gateway-shared-api-key",
      "NILE_GATEWAY_SHARED_API_KEY_API_KEY",
    );
    expect(updateConnection).not.toHaveBeenCalled();
    expect(result).toEqual(
      expect.objectContaining({
        envKey: "NILE_GATEWAY_SHARED_API_KEY_API_KEY",
      }),
    );
  });

  it("wires shell exports when an enabled agent requires managed env keys", async () => {
    const write = vi.fn();
    const ensureShell = vi.fn();
    const environment = new ManagedApiKeyEnvironment(
      {
        read: vi.fn().mockReturnValue(null),
        write,
      } as never,
      {
        ensure: ensureShell,
        remove: vi.fn(),
      } as never,
    );

    await environment.ensureForConnection({
      listSavedConnections: () => [{
        id: "gateway-shared-api-key",
        endpointId: "gateway-shared",
        endpointUrl: "https://llmfk.dpdns.org/v1",
        label: "Gateway (llmfk.dpdns.org) API Key",
        endpointLabel: "Gateway (llmfk.dpdns.org)",
        endpointFamily: "gateway",
        authMode: "api_key",
        apiKeySource: "direct",
        enabledAgents: ["claude", "openclaw"],
        configurableAgents: ["codex", "claude", "openclaw"],
        selectedByAgents: ["claude"],
      }],
      readConnectionCredential: (): StoredCredential => ({
        kind: "api_key",
        apiKey: "gateway-secret",
      }),
      setConnectionDirectApiKeyEnvKey: vi.fn().mockReturnValue({
        id: "gateway-shared-api-key",
        endpointId: "gateway-shared",
        endpointUrl: "https://llmfk.dpdns.org/v1",
        label: "Gateway (llmfk.dpdns.org) API Key",
        endpointLabel: "Gateway (llmfk.dpdns.org)",
        endpointFamily: "gateway",
        authMode: "api_key",
        apiKeySource: "direct",
        envKey: "NILE_GATEWAY_SHARED_API_KEY_API_KEY",
        enabledAgents: ["claude", "openclaw"],
        configurableAgents: ["codex", "claude", "openclaw"],
        selectedByAgents: ["claude"],
      } satisfies SavedConnectionSummary),
    } as never, "gateway-shared-api-key");

    expect(write).toHaveBeenCalledWith(
      "NILE_GATEWAY_SHARED_API_KEY_API_KEY",
      "gateway-secret",
      { mirrorToSystem: true },
    );
    expect(ensureShell).toHaveBeenCalledWith("NILE_GATEWAY_SHARED_API_KEY_API_KEY");
  });

  it("removes shell exports immediately when an existing managed env key is no longer needed by shell-backed agents", async () => {
    const read = vi.fn().mockReturnValue("gateway-secret");
    const write = vi.fn();
    const ensureShell = vi.fn();
    const removeShell = vi.fn();
    const removeSystemCopy = vi.fn();
    const environment = new ManagedApiKeyEnvironment(
      {
        read,
        write,
        removeSystemCopy,
      } as never,
      {
        ensure: ensureShell,
        remove: removeShell,
      } as never,
    );

    const result = await environment.ensureForConnection({
      listSavedConnections: () => [{
        id: "gateway-shared-api-key",
        endpointId: "gateway-shared",
        endpointUrl: "https://llmfk.dpdns.org/v1",
        label: "Gateway (llmfk.dpdns.org) API Key",
        endpointLabel: "Gateway (llmfk.dpdns.org)",
        endpointFamily: "gateway",
        authMode: "api_key",
        apiKeySource: "direct",
        envKey: "NILE_GATEWAY_SHARED_API_KEY_API_KEY",
        enabledAgents: ["claude"],
        configurableAgents: ["codex", "claude", "openclaw"],
        selectedByAgents: ["claude"],
      }],
      readConnectionCredential: (): StoredCredential => ({
        kind: "api_key",
        apiKey: "gateway-secret",
      }),
      setConnectionDirectApiKeyEnvKey: vi.fn(),
    } as never, "gateway-shared-api-key");

    expect(read).toHaveBeenCalledWith("NILE_GATEWAY_SHARED_API_KEY_API_KEY");
    expect(write).not.toHaveBeenCalled();
    expect(ensureShell).not.toHaveBeenCalled();
    expect(removeShell).toHaveBeenCalledWith("NILE_GATEWAY_SHARED_API_KEY_API_KEY");
    expect(removeSystemCopy).toHaveBeenCalledWith("NILE_GATEWAY_SHARED_API_KEY_API_KEY");
    expect(result?.envKey).toBe("NILE_GATEWAY_SHARED_API_KEY_API_KEY");
  });

  it("re-syncs shell exports for an existing managed env key when an enabled agent requires them", async () => {
    const write = vi.fn();
    const ensureShell = vi.fn();
    const environment = new ManagedApiKeyEnvironment(
      {
        read: vi.fn().mockReturnValue(null),
        write,
      } as never,
      {
        has: vi.fn().mockReturnValue(false),
        ensure: ensureShell,
        remove: vi.fn(),
      } as never,
    );

    const result = await environment.ensureForConnection({
      listSavedConnections: () => [{
        id: "gateway-shared-api-key",
        endpointId: "gateway-shared",
        endpointUrl: "https://llmfk.dpdns.org/v1",
        label: "Gateway (llmfk.dpdns.org) API Key",
        endpointLabel: "Gateway (llmfk.dpdns.org)",
        endpointFamily: "gateway",
        authMode: "api_key",
        apiKeySource: "direct",
        envKey: "NILE_GATEWAY_SHARED_API_KEY_API_KEY",
        enabledAgents: ["claude", "openclaw"],
        configurableAgents: ["codex", "claude", "openclaw"],
        selectedByAgents: ["claude"],
      }],
      readConnectionCredential: (): StoredCredential => ({
        kind: "api_key",
        apiKey: "gateway-secret",
        envKey: "NILE_GATEWAY_SHARED_API_KEY_API_KEY",
      }),
      setConnectionDirectApiKeyEnvKey: vi.fn(),
    } as never, "gateway-shared-api-key");

    expect(write).toHaveBeenCalledWith(
      "NILE_GATEWAY_SHARED_API_KEY_API_KEY",
      "gateway-secret",
      { mirrorToSystem: true },
    );
    expect(ensureShell).toHaveBeenCalledWith("NILE_GATEWAY_SHARED_API_KEY_API_KEY");
    expect(result?.envKey).toBe("NILE_GATEWAY_SHARED_API_KEY_API_KEY");
  });

  it("skips re-writing an unchanged managed env value while keeping shell exports for shell-backed agents", async () => {
    const read = vi.fn().mockReturnValue("gateway-secret");
    const write = vi.fn();
    const ensureShell = vi.fn();
    const environment = new ManagedApiKeyEnvironment(
      {
        read,
        write,
      } as never,
      {
        has: vi.fn().mockReturnValue(true),
        ensure: ensureShell,
        remove: vi.fn(),
      } as never,
    );

    await environment.ensureForConnection({
      listSavedConnections: () => [{
        id: "gateway-shared-api-key",
        endpointId: "gateway-shared",
        endpointUrl: "https://llmfk.dpdns.org/v1",
        label: "Gateway (llmfk.dpdns.org) API Key",
        endpointLabel: "Gateway (llmfk.dpdns.org)",
        endpointFamily: "gateway",
        authMode: "api_key",
        apiKeySource: "direct",
        envKey: "NILE_GATEWAY_SHARED_API_KEY_API_KEY",
        enabledAgents: ["claude", "openclaw"],
        configurableAgents: ["codex", "claude", "openclaw"],
        selectedByAgents: ["claude"],
      }],
      readConnectionCredential: (): StoredCredential => ({
        kind: "api_key",
        apiKey: "gateway-secret",
        envKey: "NILE_GATEWAY_SHARED_API_KEY_API_KEY",
      }),
      setConnectionDirectApiKeyEnvKey: vi.fn(),
    } as never, "gateway-shared-api-key");

    expect(read).toHaveBeenCalledWith("NILE_GATEWAY_SHARED_API_KEY_API_KEY");
    expect(write).not.toHaveBeenCalled();
    expect(ensureShell).toHaveBeenCalledWith("NILE_GATEWAY_SHARED_API_KEY_API_KEY");
  });

  it("rolls metadata back when writing the managed env key fails", async () => {
    const write = vi.fn(() => {
      throw new Error("keychain unavailable");
    });
    const remove = vi.fn();
    const setConnectionDirectApiKeyEnvKey = vi
      .fn()
      .mockReturnValueOnce({
        id: "gateway-shared-api-key",
        endpointId: "gateway-shared",
        endpointUrl: "https://llmfk.dpdns.org/v1",
        label: "Gateway (llmfk.dpdns.org) API Key",
        endpointLabel: "Gateway (llmfk.dpdns.org)",
        endpointFamily: "gateway",
        authMode: "api_key",
        apiKeySource: "direct",
        envKey: "NILE_GATEWAY_SHARED_API_KEY_API_KEY",
        enabledAgents: ["codex", "claude"],
        configurableAgents: ["codex", "claude", "openclaw"],
        selectedByAgents: ["claude"],
      } satisfies SavedConnectionSummary)
      .mockReturnValueOnce({
        id: "gateway-shared-api-key",
        endpointId: "gateway-shared",
        endpointUrl: "https://llmfk.dpdns.org/v1",
        label: "Gateway (llmfk.dpdns.org) API Key",
        endpointLabel: "Gateway (llmfk.dpdns.org)",
        endpointFamily: "gateway",
        authMode: "api_key",
        apiKeySource: "direct",
        enabledAgents: ["codex", "claude"],
        configurableAgents: ["codex", "claude", "openclaw"],
        selectedByAgents: ["claude"],
      } satisfies SavedConnectionSummary);

    const environment = new ManagedApiKeyEnvironment(
      {
        read: vi.fn().mockReturnValue(null),
        write,
        remove,
      } as never,
      {
        ensure: vi.fn(),
        remove: vi.fn(),
      } as never,
    );

    await expect(environment.ensureForConnection({
      listSavedConnections: () => [{
        id: "gateway-shared-api-key",
        endpointId: "gateway-shared",
        endpointUrl: "https://llmfk.dpdns.org/v1",
        label: "Gateway (llmfk.dpdns.org) API Key",
        endpointLabel: "Gateway (llmfk.dpdns.org)",
        endpointFamily: "gateway",
        authMode: "api_key",
        apiKeySource: "direct",
        enabledAgents: ["codex", "claude"],
        configurableAgents: ["codex", "claude", "openclaw"],
        selectedByAgents: ["claude"],
      }],
      readConnectionCredential: (): StoredCredential => ({
        kind: "api_key",
        apiKey: "gateway-secret",
      }),
      setConnectionDirectApiKeyEnvKey,
    } as never, "gateway-shared-api-key")).rejects.toThrow("keychain unavailable");

    expect(setConnectionDirectApiKeyEnvKey).toHaveBeenNthCalledWith(
      1,
      "gateway-shared-api-key",
      "NILE_GATEWAY_SHARED_API_KEY_API_KEY",
    );
    expect(setConnectionDirectApiKeyEnvKey).toHaveBeenNthCalledWith(
      2,
      "gateway-shared-api-key",
      null,
    );
    expect(remove).toHaveBeenCalledWith("NILE_GATEWAY_SHARED_API_KEY_API_KEY");
  });

  it("rolls metadata back when shell export setup fails", async () => {
    const write = vi.fn();
    const remove = vi.fn();
    const ensureShell = vi.fn(() => {
      throw new Error("profile locked");
    });
    const setConnectionDirectApiKeyEnvKey = vi
      .fn()
      .mockReturnValueOnce({
        id: "gateway-shared-api-key",
        endpointId: "gateway-shared",
        endpointUrl: "https://llmfk.dpdns.org/v1",
        label: "Gateway (llmfk.dpdns.org) API Key",
        endpointLabel: "Gateway (llmfk.dpdns.org)",
        endpointFamily: "gateway",
        authMode: "api_key",
        apiKeySource: "direct",
        envKey: "NILE_GATEWAY_SHARED_API_KEY_API_KEY",
        enabledAgents: ["claude", "openclaw"],
        configurableAgents: ["codex", "claude", "openclaw"],
        selectedByAgents: ["claude"],
      } satisfies SavedConnectionSummary)
      .mockReturnValueOnce({
        id: "gateway-shared-api-key",
        endpointId: "gateway-shared",
        endpointUrl: "https://llmfk.dpdns.org/v1",
        label: "Gateway (llmfk.dpdns.org) API Key",
        endpointLabel: "Gateway (llmfk.dpdns.org)",
        endpointFamily: "gateway",
        authMode: "api_key",
        apiKeySource: "direct",
        enabledAgents: ["claude", "openclaw"],
        configurableAgents: ["codex", "claude", "openclaw"],
        selectedByAgents: ["claude"],
      } satisfies SavedConnectionSummary);

    const environment = new ManagedApiKeyEnvironment(
      {
        read: vi.fn().mockReturnValue(null),
        write,
        remove,
      } as never,
      {
        ensure: ensureShell,
        remove: vi.fn(),
      } as never,
    );

    await expect(environment.ensureForConnection({
      listSavedConnections: () => [{
        id: "gateway-shared-api-key",
        endpointId: "gateway-shared",
        endpointUrl: "https://llmfk.dpdns.org/v1",
        label: "Gateway (llmfk.dpdns.org) API Key",
        endpointLabel: "Gateway (llmfk.dpdns.org)",
        endpointFamily: "gateway",
        authMode: "api_key",
        apiKeySource: "direct",
        enabledAgents: ["claude", "openclaw"],
        configurableAgents: ["codex", "claude", "openclaw"],
        selectedByAgents: ["claude"],
      }],
      readConnectionCredential: (): StoredCredential => ({
        kind: "api_key",
        apiKey: "gateway-secret",
      }),
      setConnectionDirectApiKeyEnvKey,
    } as never, "gateway-shared-api-key")).rejects.toThrow("profile locked");

    expect(write).toHaveBeenCalledWith(
      "NILE_GATEWAY_SHARED_API_KEY_API_KEY",
      "gateway-secret",
      { mirrorToSystem: true },
    );
    expect(ensureShell).toHaveBeenCalledWith("NILE_GATEWAY_SHARED_API_KEY_API_KEY");
    expect(remove).toHaveBeenCalledWith("NILE_GATEWAY_SHARED_API_KEY_API_KEY");
    expect(setConnectionDirectApiKeyEnvKey).toHaveBeenNthCalledWith(
      2,
      "gateway-shared-api-key",
      null,
    );
  });

  it("removes the managed shell export when deleting a connection env key", () => {
    const remove = vi.fn();
    const removeSystemCopy = vi.fn();
    const removeShell = vi.fn();
    const environment = new ManagedApiKeyEnvironment(
      {
        read: vi.fn().mockReturnValue(null),
        remove,
        removeSystemCopy,
      } as never,
      {
        ensure: vi.fn(),
        remove: removeShell,
      } as never,
    );

    environment.removeForConnection({
      listSavedConnections: () => [{
        id: "gateway-shared-api-key",
        endpointId: "gateway-shared",
        endpointUrl: "https://llmfk.dpdns.org/v1",
        label: "Gateway (llmfk.dpdns.org) API Key",
        endpointLabel: "Gateway (llmfk.dpdns.org)",
        endpointFamily: "gateway",
        authMode: "api_key",
        apiKeySource: "direct",
        envKey: "NILE_GATEWAY_SHARED_API_KEY_API_KEY",
        enabledAgents: ["codex", "claude"],
        configurableAgents: ["codex", "claude", "openclaw"],
        selectedByAgents: ["claude"],
      }],
    } as never, "gateway-shared-api-key");

    expect(remove).toHaveBeenCalledWith("NILE_GATEWAY_SHARED_API_KEY_API_KEY");
    expect(removeSystemCopy).toHaveBeenCalledWith("NILE_GATEWAY_SHARED_API_KEY_API_KEY");
    expect(removeShell).toHaveBeenCalledWith("NILE_GATEWAY_SHARED_API_KEY_API_KEY");
  });

  it("does not sync shell exports for api-key connections that no enabled agent needs", () => {
    const write = vi.fn();
    const syncShell = vi.fn();
    const environment = new ManagedApiKeyEnvironment(
      {
        read: vi.fn().mockReturnValue(null),
        write,
      } as never,
      {
        ensure: vi.fn(),
        sync: syncShell,
        remove: vi.fn(),
      } as never,
    );

    const failures = environment.syncForSession({
      listSavedConnections: () => [{
        id: "gateway-shared-api-key",
        endpointId: "gateway-shared",
        endpointUrl: "https://llmfk.dpdns.org/v1",
        label: "Gateway (llmfk.dpdns.org) API Key",
        endpointLabel: "Gateway (llmfk.dpdns.org)",
        endpointFamily: "gateway",
        authMode: "api_key",
        enabledAgents: ["claude"],
        configurableAgents: ["claude", "openclaw"],
        selectedByAgents: ["claude"],
      }],
      readConnectionCredential: (): StoredCredential => ({
        kind: "api_key",
        apiKey: "gateway-secret",
      }),
      setConnectionDirectApiKeyEnvKey: vi.fn(),
    } as never);

    expect(failures).toEqual([]);
    expect(write).toHaveBeenCalledWith("NILE_GATEWAY_SHARED_API_KEY_API_KEY", "gateway-secret");
    expect(syncShell).toHaveBeenCalledWith([]);
  });

  it("syncs managed shell exports once for the full session when an enabled agent needs them", () => {
    const write = vi.fn();
    const syncShell = vi.fn();
    const setConnectionDirectApiKeyEnvKey = vi.fn();
    const environment = new ManagedApiKeyEnvironment(
      {
        read: vi.fn().mockReturnValue(null),
        write,
      } as never,
      {
        has: vi.fn().mockReturnValue(false),
        ensure: vi.fn(),
        sync: syncShell,
        remove: vi.fn(),
      } as never,
    );

    const failures = environment.syncForSession({
      listSavedConnections: () => [
        {
          id: "gateway-shared-api-key",
          endpointId: "gateway-shared",
          endpointUrl: "https://llmfk.dpdns.org/v1",
          label: "Gateway (llmfk.dpdns.org) API Key",
          endpointLabel: "Gateway (llmfk.dpdns.org)",
          endpointFamily: "gateway",
          authMode: "api_key",
          enabledAgents: ["claude", "openclaw"],
          configurableAgents: ["claude", "openclaw"],
          selectedByAgents: ["claude"],
        },
        {
          id: "openai-session",
          endpointId: "openai",
          endpointUrl: "https://api.openai.com",
          label: "jay.ji@test.ai",
          endpointLabel: "OpenAI",
          endpointFamily: "openai",
          authMode: "openai_session",
          enabledAgents: ["codex"],
          configurableAgents: ["codex", "openclaw"],
          selectedByAgents: ["codex"],
        },
      ],
      readConnectionCredential: (connectionId: string): StoredCredential =>
        connectionId === "gateway-shared-api-key"
          ? {
              kind: "api_key",
              apiKey: "gateway-secret",
            }
          : {
              kind: "openai_session",
              accessToken: "token",
              accountId: "acct",
              idToken: "id-token",
              refreshToken: "refresh-token",
            },
      setConnectionDirectApiKeyEnvKey,
    } as never);

    expect(failures).toEqual([]);
    expect(write).toHaveBeenCalledWith(
      "NILE_GATEWAY_SHARED_API_KEY_API_KEY",
      "gateway-secret",
      { mirrorToSystem: true },
    );
    expect(syncShell).toHaveBeenCalledTimes(1);
    expect(syncShell).toHaveBeenCalledWith(["NILE_GATEWAY_SHARED_API_KEY_API_KEY"]);
    expect(setConnectionDirectApiKeyEnvKey).toHaveBeenCalledWith(
      "gateway-shared-api-key",
      "NILE_GATEWAY_SHARED_API_KEY_API_KEY",
    );
  });

  it("keeps externally preserved env keys in the full-session shell sync", () => {
    const syncShell = vi.fn();
    const environment = new ManagedApiKeyEnvironment(
      {
        read: vi.fn().mockReturnValue(null),
        write: vi.fn(),
      } as never,
      {
        ensure: vi.fn(),
        sync: syncShell,
        remove: vi.fn(),
      } as never,
    );

    const failures = environment.syncForSession(
      {
        listSavedConnections: () => [],
      } as never,
      ["NILE_GATEWAY_LLMFK_DPDNS_ORG_API_KEY_API_KEY"],
    );

    expect(failures).toEqual([]);
    expect(syncShell).toHaveBeenCalledWith(["NILE_GATEWAY_LLMFK_DPDNS_ORG_API_KEY_API_KEY"]);
  });

  it("captures shell sync failures without throwing during full-session sync", () => {
    const environment = new ManagedApiKeyEnvironment(
      {
        read: vi.fn().mockReturnValue(null),
        write: vi.fn(),
      } as never,
      {
        ensure: vi.fn(),
        sync: vi.fn(() => {
          throw new Error("profile locked");
        }),
        remove: vi.fn(),
      } as never,
    );

    const failures = environment.syncForSession({
      listSavedConnections: () => [],
    } as never);

    expect(failures).toEqual([
      {
        connectionId: "managed-shell-environment",
        error: new Error("profile locked"),
      },
    ]);
  });

  it("rolls metadata back when batch sync cannot write the managed env key", () => {
    const setConnectionDirectApiKeyEnvKey = vi.fn();
    const environment = new ManagedApiKeyEnvironment(
      {
        read: vi.fn().mockReturnValue(null),
        write: vi.fn(() => {
          throw new Error("keychain unavailable");
        }),
      } as never,
      {
        ensure: vi.fn(),
        sync: vi.fn(),
        remove: vi.fn(),
      } as never,
    );

    const failures = environment.syncForSession({
      listSavedConnections: () => [{
        id: "gateway-shared-api-key",
        endpointId: "gateway-shared",
        endpointUrl: "https://llmfk.dpdns.org/v1",
        label: "Gateway (llmfk.dpdns.org) API Key",
        endpointLabel: "Gateway (llmfk.dpdns.org)",
        endpointFamily: "gateway",
        authMode: "api_key",
        enabledAgents: ["claude", "openclaw"],
        configurableAgents: ["claude", "openclaw"],
        selectedByAgents: ["claude"],
      }],
      readConnectionCredential: (): StoredCredential => ({
        kind: "api_key",
        apiKey: "gateway-secret",
      }),
      setConnectionDirectApiKeyEnvKey,
    } as never);

    expect(setConnectionDirectApiKeyEnvKey).toHaveBeenNthCalledWith(
      1,
      "gateway-shared-api-key",
      "NILE_GATEWAY_SHARED_API_KEY_API_KEY",
    );
    expect(setConnectionDirectApiKeyEnvKey).toHaveBeenNthCalledWith(
      2,
      "gateway-shared-api-key",
      null,
    );
    expect(failures).toHaveLength(1);
    expect(failures[0]?.connectionId).toBe("gateway-shared-api-key");
    expect(failures[0]?.error.message).toBe("keychain unavailable");
  });

  it("clears removed managed env keys and syncs the preserved shell set once", () => {
    const remove = vi.fn();
    const removeSystemCopy = vi.fn();
    const sync = vi.fn();
    const environment = new ManagedApiKeyEnvironment(
      {
        read: vi.fn().mockReturnValue(null),
        remove,
        removeSystemCopy,
      } as never,
      {
        ensure: vi.fn(),
        sync,
        remove: vi.fn(),
      } as never,
    );

    environment.clearForSession({
      listSavedConnections: () => [
        {
          id: "keep",
          endpointId: "gateway-shared",
          endpointUrl: "https://llmfk.dpdns.org/v1",
          label: "Keep",
          endpointLabel: "Gateway",
          endpointFamily: "gateway",
          authMode: "api_key",
          envKey: "NILE_KEEP_API_KEY",
          enabledAgents: ["claude"],
          configurableAgents: ["claude", "openclaw"],
          selectedByAgents: ["claude"],
        },
        {
          id: "remove",
          endpointId: "gateway-shared",
          endpointUrl: "https://llmfk.dpdns.org/v1",
          label: "Remove",
          endpointLabel: "Gateway",
          endpointFamily: "gateway",
          authMode: "api_key",
          envKey: "NILE_REMOVE_API_KEY",
          enabledAgents: ["claude"],
          configurableAgents: ["claude", "openclaw"],
          selectedByAgents: ["claude"],
        },
      ],
    } as never, ["NILE_KEEP_API_KEY"]);

    expect(remove).toHaveBeenCalledTimes(1);
    expect(remove).toHaveBeenCalledWith("NILE_REMOVE_API_KEY");
    expect(removeSystemCopy).toHaveBeenCalledWith("NILE_REMOVE_API_KEY");
    expect(sync).toHaveBeenCalledTimes(1);
    expect(sync).toHaveBeenCalledWith(["NILE_KEEP_API_KEY"]);
  });
});
