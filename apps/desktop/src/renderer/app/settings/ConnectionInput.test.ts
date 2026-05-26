import { describe, expect, it } from "vitest";

import { SettingsConnectionInputBuilder } from "./ConnectionInput";

describe("SettingsConnectionInputBuilder", () => {
  it("maps add-connection submit input to desktop bridge input", () => {
    const builder = new SettingsConnectionInputBuilder();

    const result = builder.build({
      preset: "openai",
      authMode: "openai_session",
      label: "Work",
      endpointUrl: "https://api.example.com",
      enabledAgents: ["codex"],
      allowUndetectedGateway: true,
      credentialStorageBackend: "encrypted_local_storage",
      encryptedLocalPassphrase: "2508",
      apiKeySource: "env_key",
      apiKey: "secret",
      envKey: "OPENAI_API_KEY",
      sessionSource: "current_codex",
      sessionAuthJsonPath: "C:\\auth.json",
    });

    expect(result).toEqual({
      preset: "openai",
      authMode: "openai_session",
      label: "Work",
      endpointUrl: "https://api.example.com",
      enabledAgents: ["codex"],
      allowUndetectedGateway: true,
      credentialStorageBackend: "encrypted_local_storage",
      encryptedLocalPassphrase: "2508",
      apiKeySource: "env_key",
      apiKey: "secret",
      envKey: "OPENAI_API_KEY",
      sessionSource: "current_codex",
      sessionAuthJsonPath: "C:\\auth.json",
    });
  });
});
