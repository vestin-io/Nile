import type { AuthMode, AccessRecord, AccessRegistry } from "../access";
import type { AgentId } from "../agent/Definitions";
import type { ConnectionPresetFamily } from "./preset";
import type {
  EndpointAnthropicProtocol,
  EndpointFamily,
  EndpointOpenAiProtocol,
  EndpointRegistry,
} from "../endpoint";
import type { EndpointRegistryInput } from "../endpoint";
import type { AgentSelection } from "../selection/Selection";
import type { StoredCredential } from "../../services/credential/Types";
import type { CredentialStorageBackend } from "../../services/credential/Store";
import type { SqliteDatabase } from "../../services/database/SqliteDatabase";
import type { EnvironmentSource } from "../../services/EnvironmentSource";
import type { LocalModelCatalogSource } from "../../application/local/ModelCatalogSourceTypes";

export type ConnectionOnboardingSuggestion = {
  configurableAgents: AgentId[];
  defaultEnabledAgents: AgentId[];
};

export type CreateConnectionInput = {
  preset: ConnectionPresetFamily;
  authMode: AuthMode;
  credential: StoredCredential;
  probeCredential?: StoredCredential;
  endpointUrl?: string;
  id?: string;
  label?: string;
  enabledAgents?: AgentId[];
  allowUndetectedGateway?: boolean;
  credentialStorageBackend?: CredentialStorageBackend;
};

export type CreateConnectionResult = {
  id: string;
  label: string;
  endpointId: string;
  endpointLabel: string;
  endpointFamily: EndpointFamily;
  authMode: AuthMode;
  reused?: true;
};

export type UpdateConnectionInput = {
  connectionId: string;
  label?: string;
  enabledAgents?: AgentId[];
  endpointUrl?: string;
  credential?: StoredCredential;
  probeCredential?: StoredCredential;
  credentialStorageBackend?: CredentialStorageBackend;
};

export type ConnectionModelCatalogResult = {
  connectionId: string;
  status: "available" | "unavailable" | "error";
  models: string[];
  message?: string;
};

export type GatewayProbeResult = {
  openai: EndpointOpenAiProtocol | null;
  anthropic: EndpointAnthropicProtocol | null;
};

export type GatewayCapabilityProbe = {
  probe(baseUrl: string, apiKey: string): Promise<GatewayProbeResult>;
};

export type ConnectionCreatorContract = {
  create(input: CreateConnectionInput): Promise<CreateConnectionResult>;
  describeOnboarding(input: CreateConnectionInput): Promise<ConnectionOnboardingSuggestion>;
};

export type ConnectionUpdaterContract = {
  update(input: UpdateConnectionInput): Promise<AccessRecord>;
};

export type ConnectionModelCatalogContract = {
  read(connectionId: string): Promise<ConnectionModelCatalogResult>;
};

export type ConnectionIdentityResolver = {
  resolve(authMode: AuthMode, credential: StoredCredential): string | null;
};

export type ConnectionRuntimeServices = {
  createCreator(input: {
    endpointRegistry: EndpointRegistry;
    accessRegistry: AccessRegistry;
  }): ConnectionCreatorContract;
  createUpdater(input: {
    database: SqliteDatabase;
    endpointRegistry: EndpointRegistry;
    accessRegistry: AccessRegistry;
    agentSelection: AgentSelection;
  }): ConnectionUpdaterContract;
  createModelCatalog(input: {
    endpointRegistry: Pick<EndpointRegistry, "get">;
    accessRegistry: Pick<AccessRegistry, "get" | "readCredential">;
    environment: EnvironmentSource;
    localModelCatalogSources: readonly LocalModelCatalogSource[];
  }): ConnectionModelCatalogContract;
  createGatewayProbe(): GatewayCapabilityProbe;
  createIdentityResolver(): ConnectionIdentityResolver;
};

export class ConnectionRuntimeRegistry {
  private services: ConnectionRuntimeServices | null = null;

  register(services: ConnectionRuntimeServices): void {
    this.services = services;
  }

  read(): ConnectionRuntimeServices {
    if (!this.services) {
      throw new Error("Connection runtime services have not been registered");
    }
    return this.services;
  }
}

export const CONNECTION_RUNTIME_REGISTRY = new ConnectionRuntimeRegistry();
