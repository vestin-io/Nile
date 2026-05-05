import type { AccessRecord } from "../../models/access";
import type { StoredCredential } from "../../services/credential/Types";
import { AgentProjectionError } from "../ProjectionError";
import type { CursorProjection, ProjectionInput } from "../Types";
import { joinEndpointUrl } from "../Url";

export class CursorProjectionStrategy {
  resolve(input: ProjectionInput): CursorProjection {
    const protocol = input.endpoint.protocols.cursor;
    if (!protocol) {
      throw new AgentProjectionError(`Endpoint ${input.endpoint.id} does not support the Cursor protocol required by cursor`);
    }

    this.validateAccess(input.access, input.credential);

    return {
      agentId: "cursor",
      protocol: "cursor",
      endpointId: input.endpoint.id,
      endpointLabel: input.endpoint.label,
      accessId: input.access.id,
      accessLabel: input.access.label,
      authMode: input.access.authMode as CursorProjection["authMode"],
      backendUrl: joinEndpointUrl(input.endpoint.rootUrl, protocol.backendPath),
    };
  }

  private validateAccess(access: AccessRecord, credential: StoredCredential): void {
    if (access.authMode !== "api_key" && access.authMode !== "cursor_session") {
      throw new AgentProjectionError(`Cursor does not support access auth mode ${access.authMode}`);
    }

    if (access.authMode === "api_key" && credential.kind !== "api_key") {
      throw new AgentProjectionError("Cursor api_key access requires an api_key credential");
    }

    if (access.authMode === "cursor_session" && credential.kind !== "cursor_session") {
      throw new AgentProjectionError("Cursor cursor_session access requires a cursor_session credential");
    }
  }
}
