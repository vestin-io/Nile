export type ConnectionOnboardingSuggestion = {
  configurableAgents: import("@nile/core/models/agent").AgentId[];
  defaultEnabledAgents: import("@nile/core/models/agent").AgentId[];
};

export declare class ConnectionOnboardingPolicy {
  suggest(
    preset: import("@nile/core/models/connection/preset").ConnectionPresetFamily,
    endpointCandidate: import("@nile/core/models/endpoint").EndpointRegistryInput,
  ): ConnectionOnboardingSuggestion;
}

export declare class ConnectionIdentityKeyResolver {
  resolve(
    authMode: import("@nile/core/models/access").AuthMode,
    credential: import("@nile/core/services/credential/Types").StoredCredential,
  ): string | null;
}
