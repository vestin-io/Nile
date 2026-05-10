import { describe, expect, it } from "vitest";

import { AgentProjectionResolver, AgentProjectionError } from "./index";
import type { AccessRecord } from "../models/access";
import type { EndpointRecord } from "../models/endpoint";
import type { StoredCredential } from "../services/credential/Types";

describe("AgentProjectionResolver", () => {
  it("projects a gateway endpoint into codex and claude specs", () => {
    const resolver = new AgentProjectionResolver();
    const endpoint = gatewayEndpoint();

    const codex = resolver.resolve("codex", {
      endpoint,
      access: apiKeyAccess("gateway-codex"),
      credential: apiKeyCredential(),
    });
    const claude = resolver.resolve("claude", {
      endpoint,
      access: apiKeyAccess("gateway-claude"),
      credential: apiKeyCredential(),
    });

    expect(codex).toEqual({
      agentId: "codex",
      protocol: "openai",
      endpointId: "gateway",
      endpointLabel: "Gateway",
      accessId: "gateway-codex",
      accessLabel: "Gateway Shared",
      authMode: "api_key",
      authScheme: "bearer",
      baseUrl: "https://gateway.example.test/v1",
      wireApi: "responses",
    });
    expect(claude).toEqual({
      agentId: "claude",
      protocol: "anthropic",
      endpointId: "gateway",
      endpointLabel: "Gateway",
      accessId: "gateway-claude",
      accessLabel: "Gateway Shared",
      authMode: "api_key",
      authScheme: "bearer",
      baseUrl: "https://gateway.example.test/v1",
      envKey: "ANTHROPIC_AUTH_TOKEN",
    });
  });

  it("projects azure-openai endpoints for codex", () => {
    const resolver = new AgentProjectionResolver();

    const projection = resolver.resolve("codex", {
      endpoint: {
        id: "azure-work",
        label: "Azure Work",
        rootUrl: "https://example.cognitiveservices.azure.com",
        profile: "azure-openai",
        protocols: {
          openai: {
            basePath: "/openai/v1",
            wireApis: ["responses", "chat"],
            authSchemes: ["bearer"],
          },
        },
        createdAt: "",
        updatedAt: "",
      },
      access: apiKeyAccess("azure-work"),
      credential: apiKeyCredential(),
    });

    expect(projection).toEqual({
      agentId: "codex",
      protocol: "openai",
      endpointId: "azure-work",
      endpointLabel: "Azure Work",
      accessId: "azure-work",
      accessLabel: "Gateway Shared",
      authMode: "api_key",
      authScheme: "bearer",
      baseUrl: "https://example.cognitiveservices.azure.com/openai/v1",
      wireApi: "responses",
    });
  });

  it("preserves explicit env-key credentials for codex", () => {
    const resolver = new AgentProjectionResolver();

    const projection = resolver.resolve("codex", {
      endpoint: {
        id: "azure-work",
        label: "Azure Work",
        rootUrl: "https://example.cognitiveservices.azure.com",
        profile: "azure-openai",
        protocols: {
          openai: {
            basePath: "/openai/v1",
            wireApis: ["responses", "chat"],
            authSchemes: ["bearer"],
            envKeyOverride: "OPENAI_API_KEY",
          },
        },
        createdAt: "",
        updatedAt: "",
      },
      access: apiKeyAccess("azure-work"),
      credential: {
        kind: "api_key",
        source: "env_key",
        envKey: "OPENAI_API_KEY_WORK",
      },
    });

    expect(projection).toEqual({
      agentId: "codex",
      protocol: "openai",
      endpointId: "azure-work",
      endpointLabel: "Azure Work",
      accessId: "azure-work",
      accessLabel: "Gateway Shared",
      authMode: "api_key",
      authScheme: "bearer",
      baseUrl: "https://example.cognitiveservices.azure.com/openai/v1",
      wireApi: "responses",
      envKey: "OPENAI_API_KEY_WORK",
    });
  });

  it("projects anthropic official endpoints with x-api-key semantics", () => {
    const resolver = new AgentProjectionResolver();

    const projection = resolver.resolve("claude", {
      endpoint: {
        id: "claude-official",
        label: "Claude Official",
        rootUrl: "https://api.anthropic.com",
        profile: "anthropic-official",
        protocols: {
          anthropic: {
            authSchemes: ["x_api_key"],
            versionHeader: "2023-06-01",
          },
        },
        createdAt: "",
        updatedAt: "",
      },
      access: apiKeyAccess("claude-official"),
      credential: apiKeyCredential(),
    });

    expect(projection).toEqual({
      agentId: "claude",
      protocol: "anthropic",
      endpointId: "claude-official",
      endpointLabel: "Claude Official",
      accessId: "claude-official",
      accessLabel: "Gateway Shared",
      authMode: "api_key",
      authScheme: "x_api_key",
      baseUrl: "https://api.anthropic.com",
      envKey: "ANTHROPIC_API_KEY",
    });
  });

  it("projects cursor backend endpoints", () => {
    const resolver = new AgentProjectionResolver();

    const projection = resolver.resolve("cursor", {
      endpoint: {
        id: "cursor-backend",
        label: "Cursor Backend",
        rootUrl: "https://api2.cursor.sh",
        profile: "cursor-backend",
        protocols: {
          cursor: {
            backendPath: "/",
          },
        },
        createdAt: "",
        updatedAt: "",
      },
      access: {
        ...apiKeyAccess("cursor-backend"),
        authMode: "cursor_session",
      },
      credential: {
        kind: "cursor_session",
        accessToken: "cursor-access",
        refreshToken: "cursor-refresh",
      },
    });

    expect(projection).toEqual({
      agentId: "cursor",
      protocol: "cursor",
      endpointId: "cursor-backend",
      endpointLabel: "Cursor Backend",
      accessId: "cursor-backend",
      accessLabel: "Gateway Shared",
      authMode: "cursor_session",
      backendUrl: "https://api2.cursor.sh",
    });
  });

  it("projects OpenClaw provider and auth-profile configs", () => {
    const resolver = new AgentProjectionResolver();

    const gatewayOpenAi = resolver.resolve("openclaw", {
      endpoint: gatewayEndpoint(),
      access: {
        ...apiKeyAccess("gateway-openclaw"),
        openclawModelId: "gpt-4.1",
      },
      credential: apiKeyCredential(),
    });
    const anthropicSession = resolver.resolve("openclaw", {
      endpoint: {
        id: "claude-official",
        label: "Claude Official",
        rootUrl: "https://api.anthropic.com",
        profile: "anthropic-official",
        protocols: {
          anthropic: {
            authSchemes: ["x_api_key"],
            versionHeader: "2023-06-01",
          },
        },
        createdAt: "",
        updatedAt: "",
      },
      access: {
        ...apiKeyAccess("claude-openclaw"),
        authMode: "claude_session",
        openclawModelId: "claude-sonnet-4",
      },
      credential: {
        kind: "claude_session",
        accessToken: "claude-access",
        refreshToken: "claude-refresh",
        email: "team@example.com",
      },
    });

    expect(gatewayOpenAi).toEqual({
      agentId: "openclaw",
      protocol: "openai",
      configKind: "provider",
      endpointId: "gateway",
      endpointLabel: "Gateway",
      accessId: "gateway-openclaw",
      accessLabel: "Gateway Shared",
      authMode: "api_key",
      baseUrl: "https://gateway.example.test/v1",
      wireApi: "responses",
      modelId: "gpt-4.1",
    });
    expect(anthropicSession).toEqual({
      agentId: "openclaw",
      protocol: "anthropic",
      configKind: "auth_profile",
      endpointId: "claude-official",
      endpointLabel: "Claude Official",
      accessId: "claude-openclaw",
      accessLabel: "Gateway Shared",
      authMode: "claude_session",
      providerId: "anthropic",
      profileMode: "oauth",
      modelId: "claude-sonnet-4",
    });
  });

  it("rejects incompatible agent and protocol combinations", () => {
    const resolver = new AgentProjectionResolver();

    expect(() => resolver.resolve("codex", {
      endpoint: {
        id: "claude-only",
        label: "Claude Only",
        rootUrl: "https://api.anthropic.com",
        protocols: {
          anthropic: {
            authSchemes: ["x_api_key"],
          },
        },
        createdAt: "",
        updatedAt: "",
      },
      access: apiKeyAccess("claude-only"),
      credential: apiKeyCredential(),
    })).toThrow(AgentProjectionError);

    expect(() => resolver.resolve("claude", {
      endpoint: gatewayEndpoint(),
      access: {
        ...apiKeyAccess("bad-access"),
        authMode: "openai_session",
      },
      credential: {
        kind: "openai_session",
        idToken: "id-token",
        accessToken: "access-token",
        refreshToken: "refresh-token",
      },
    })).toThrow("Claude does not support access auth mode openai_session");

    expect(() => resolver.resolve("openclaw", {
      endpoint: gatewayEndpoint(),
      access: apiKeyAccess("openclaw-missing-model"),
      credential: apiKeyCredential(),
    })).toThrow("OpenClaw requires a saved openclawModelId");
  });
});

function gatewayEndpoint(): EndpointRecord {
  return {
    id: "gateway",
    label: "Gateway",
    rootUrl: "https://gateway.example.test",
    profile: "generic-gateway",
    protocols: {
      openai: {
        basePath: "/v1",
        wireApis: ["responses", "chat"],
        authSchemes: ["bearer"],
      },
      anthropic: {
        basePath: "/v1",
        authSchemes: ["bearer"],
      },
    },
    createdAt: "",
    updatedAt: "",
  };
}

function apiKeyAccess(id: string): AccessRecord {
  return {
    id,
    endpointId: "gateway",
    label: "Gateway Shared",
    authMode: "api_key",
    enabledAgents: ["codex", "claude"],
    credentialSource: {
      kind: "local",
      reference: `access:${id}`,
      scope: "access",
      allowLocalMaterialization: true,
    },
    createdAt: "",
    updatedAt: "",
  };
}

function apiKeyCredential(): StoredCredential {
  return {
    kind: "api_key",
    apiKey: "secret",
  };
}
