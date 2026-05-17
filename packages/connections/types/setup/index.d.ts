export type GatewayProbeResult = {
  openai: import("@nile/core/models/endpoint").EndpointOpenAiProtocol | null;
  anthropic: import("@nile/core/models/endpoint").EndpointAnthropicProtocol | null;
};

export type GatewayCapabilityProbe = {
  probe(baseUrl: string, apiKey: string): Promise<GatewayProbeResult>;
};

export type ConnectionEndpointBuildInput = {
  preset: import("@nile/core/models/connection/preset").ConnectionPresetFamily;
  authMode: import("@nile/core/models/access").AuthMode;
  credential: import("@nile/core/services/credential/Types").StoredCredential;
  endpointUrl?: string;
  enabledAgents?: import("@nile/core/models/agent/definitions").AgentId[];
  allowUndetectedGateway?: boolean;
};

export type ConnectionEndpointModule = {
  preset: import("@nile/core/models/connection/preset").ConnectionPresetFamily;
  build(context: {
    input: Omit<ConnectionEndpointBuildInput, "preset">;
  }): Promise<import("@nile/core/models/endpoint").EndpointRegistryInput>;
};

export declare class GatewayProbe implements GatewayCapabilityProbe {
  constructor(fetchFn?: typeof fetch);
  probe(baseUrl: string, apiKey: string): Promise<GatewayProbeResult>;
}

export declare class ConnectionEndpointBuilder {
  constructor(gatewayProbe?: GatewayCapabilityProbe);
  build(input: ConnectionEndpointBuildInput): Promise<import("@nile/core/models/endpoint").EndpointRegistryInput>;
}
