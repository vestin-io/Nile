import type { AccessRegistry } from "@nile/core/models/access";
import type { EndpointRegistry } from "@nile/core/models/endpoint";
import { EndpointShape } from "@nile/core/models/endpoint";
import { CursorUsageBindingRegistry, CursorUsageBindingValidationError } from "./BindingRegistry";
import type { BindCursorUsageResult } from "./Contracts";
import { CursorUsageIdentity } from "./Identity";

export type { BindCursorUsageResult };

export class CursorUsageBinder {
  constructor(
    private readonly endpointRegistry: EndpointRegistry,
    private readonly accessRegistry: AccessRegistry,
    private readonly bindingRegistry: CursorUsageBindingRegistry,
  ) {}

  bind(connectionId: string, sessionToken: string): BindCursorUsageResult {
    const access = this.accessRegistry.get(connectionId);
    if (!access) {
      throw new CursorUsageBindingValidationError(`Connection not found: ${connectionId}`);
    }

    const endpoint = this.endpointRegistry.get(access.endpointId);
    if (!endpoint || !endpoint.protocols.cursor || EndpointShape.readFamily(endpoint) !== "cursor") {
      throw new CursorUsageBindingValidationError(`Connection ${connectionId} is not a Cursor connection`);
    }
    if (access.authMode !== "cursor_session") {
      throw new CursorUsageBindingValidationError(
        `Connection ${connectionId} must use cursor_session auth for Cursor quota binding`,
      );
    }

    const credential = this.accessRegistry.readCredential(connectionId);
    if (credential.kind !== "cursor_session") {
      throw new CursorUsageBindingValidationError(`Expected cursor_session credential for ${connectionId}`);
    }

    const localFingerprint = CursorUsageIdentity.fromSavedConnection(access, credential);
    const usageFingerprint = CursorUsageIdentity.fromUsageSessionToken(sessionToken);
    if (!CursorUsageIdentity.matches(localFingerprint, usageFingerprint)) {
      throw new CursorUsageBindingValidationError(
        "Cursor quota session belongs to a different account than the saved connection",
      );
    }

    const binding = this.bindingRegistry.bind(
      {
        connectionId,
        accountFingerprint: localFingerprint,
      },
      CursorUsageIdentity.normalizeToken(sessionToken),
    );

    return {
      connectionId,
      connectionLabel: access.label,
      endpointLabel: endpoint.label,
      endpointFamily: "cursor",
      workosUserId: binding.accountFingerprint.workosUserId,
      boundAt: binding.lastVerifiedAt,
    };
  }
}
