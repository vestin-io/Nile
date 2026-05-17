export type CreateConnectionInput = {
  preset: import("@nile/core/models/connection/preset").ConnectionPresetFamily;
  authMode: import("@nile/core/models/access").AuthMode;
  credential: import("@nile/core/services/credential/Types").StoredCredential;
  probeCredential?: import("@nile/core/services/credential/Types").StoredCredential;
  endpointUrl?: string;
  id?: string;
  label?: string;
  enabledAgents?: import("@nile/core/models/agent").AgentId[];
  allowUndetectedGateway?: boolean;
};

export type CreateConnectionResult = {
  id: string;
  label: string;
  endpointId: string;
  endpointLabel: string;
  endpointFamily: import("@nile/core/models/endpoint").EndpointFamily;
  authMode: import("@nile/core/models/access").AuthMode;
  reused?: true;
};

export declare class ConnectionCreator {
  constructor(
    endpointRegistry: unknown,
    accessRegistry: unknown,
    gatewayProbe?: import("@nile/connections/setup").GatewayCapabilityProbe,
  );
  create(input: CreateConnectionInput): Promise<CreateConnectionResult>;
  describeOnboarding(
    input: CreateConnectionInput,
  ): Promise<import("@nile/connections/support").ConnectionOnboardingSuggestion>;
}

export type UpdateConnectionInput = {
  connectionId: string;
  label?: string;
  enabledAgents?: import("@nile/core/models/agent").AgentId[];
  endpointUrl?: string;
  credential?: import("@nile/core/services/credential/Types").StoredCredential;
  probeCredential?: import("@nile/core/services/credential/Types").StoredCredential;
};

export declare class ConnectionUpdaterValidationError extends Error {
  constructor(message: string);
}

export declare class ConnectionUpdater {
  constructor(
    database: import("@nile/core/services/database/SqliteDatabase").SqliteDatabase,
    endpointRegistry: unknown,
    accessRegistry: unknown,
    agentSelection: import("@nile/core/models/selection/Selection").AgentSelection,
    gatewayProbe?: import("@nile/connections/setup").GatewayCapabilityProbe,
  );
  update(input: UpdateConnectionInput): Promise<import("@nile/core/models/access").AccessRecord>;
}
