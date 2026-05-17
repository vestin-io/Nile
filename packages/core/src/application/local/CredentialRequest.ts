import type {
  CurrentSessionStoredCredential,
  SessionCredentialRequest,
} from "../../session";

export type LocalCredentialRequest =
  | {
      authMode: "api_key";
      source?: "direct";
      apiKey: string;
      envKey?: string;
    }
  | {
      authMode: "api_key";
      source: "env_key";
      envKey: string;
    }
  | SessionCredentialRequest;

export type { SessionCredentialRequest, CurrentSessionStoredCredential };
