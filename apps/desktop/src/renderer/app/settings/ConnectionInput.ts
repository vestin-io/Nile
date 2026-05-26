import type { DesktopAddConnectionInput } from "../../../electron/connections/contracts";
import type { AddConnectionSubmitInput } from "../../connections/add/Types";

export class SettingsConnectionInputBuilder {
  build(input: AddConnectionSubmitInput): DesktopAddConnectionInput {
    return {
      preset: input.preset,
      authMode: input.authMode,
      label: input.label,
      endpointUrl: input.endpointUrl,
      enabledAgents: input.enabledAgents,
      allowUndetectedGateway: input.allowUndetectedGateway,
      credentialStorageBackend: input.credentialStorageBackend,
      encryptedLocalPassphrase: input.encryptedLocalPassphrase,
      apiKeySource: input.apiKeySource,
      apiKey: input.apiKey,
      envKey: input.envKey,
      sessionSource: input.sessionSource,
      sessionAuthJsonPath: input.sessionAuthJsonPath,
    };
  }
}
