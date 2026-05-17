export type ConnectionLabelerInput = {
  endpointUrl?: string;
};

export declare class ConnectionLabeler {
  suggestEndpointLabel(
    preset: import("@nile/core/models/connection/preset").ConnectionPresetFamily,
    input?: ConnectionLabelerInput,
  ): string;
  suggestAccessLabel(
    preset: import("@nile/core/models/connection/preset").ConnectionPresetFamily,
    authMode: import("@nile/core/models/access").AuthMode,
    credential: import("@nile/core/services/credential/Types").StoredCredential,
    input?: ConnectionLabelerInput,
  ): string;
  resolveSuggestedAccessLabel(
    preset: import("@nile/core/models/connection/preset").ConnectionPresetFamily,
    authMode: import("@nile/core/models/access").AuthMode,
    credential: import("@nile/core/services/credential/Types").StoredCredential,
    input?: ConnectionLabelerInput,
  ): string | null;
}
