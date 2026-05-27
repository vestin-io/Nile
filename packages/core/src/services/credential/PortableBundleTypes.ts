import type { AgentId } from "../../models/agent/Definitions";
import type { AuthMode } from "../../models/access";
import type { EndpointFamily } from "../../models/endpoint";
import type { CredentialStorageBackend } from "./Store";
import type { StoredCredential } from "./Types";

export type PortableBundlePlatform = "macos" | "windows" | "linux";

export type PortableBundleSource = {
  appVersion: string;
  platform: PortableBundlePlatform;
  storageMode: CredentialStorageBackend;
};

export type PortableBundleConnection = {
  stableKey: string;
  label: string;
  endpointId: string;
  endpointFamily: EndpointFamily | "unknown";
  endpointUrl: string | null;
  authMode: AuthMode;
  identityKey?: string | null;
  enabledAgents: AgentId[];
  configurableAgents: AgentId[];
  selectedByAgents: string[];
  modelSelections?: Record<string, string | null>;
  credential: StoredCredential;
};

export type PortableBundlePayload = {
  version: 1;
  exportedAt: string;
  source: PortableBundleSource;
  connections: PortableBundleConnection[];
};

export type PortableBundleEnvelope = {
  version: 1;
  format: "nile-portable-bundle";
  kdf: {
    algorithm: "scrypt";
    saltBase64: string;
    cost: number;
    blockSize: number;
    parallelization: number;
    keyLength: number;
  };
  cipher: {
    algorithm: "aes-256-gcm";
    nonceBase64: string;
    tagBase64: string;
  };
  ciphertextBase64: string;
};
