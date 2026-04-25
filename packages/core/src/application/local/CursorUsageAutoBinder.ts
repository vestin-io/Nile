import type { CursorSessionCredential } from "../../services/credential/Types";
import { AccessRegistry } from "../../models/access";
import { EndpointRegistry, EndpointShape } from "../../models/endpoint";
import {
  CursorUsageBinder,
  CursorUsageBindingRegistry,
  CursorUsageIdentity,
  type BindCursorUsageResult,
} from "../../actions/usage/cursor";
import {
  EmptyCursorUsageSessionProbe,
  type CursorUsageSessionCandidate,
  type CursorUsageSessionProbe,
} from "./CursorUsageSessionProbe";

export type CursorUsageAutoBindResult =
  | {
      connectionId: string;
      status: "bound";
      binding: BindCursorUsageResult;
      sourceLabel: string;
      locationLabel: string;
    }
  | {
      connectionId: string;
      status: "already_bound";
    }
  | {
      connectionId: string;
      status: "no_session_found";
    }
  | {
      connectionId: string;
      status: "not_cursor_connection";
    };

export class CursorUsageAutoBinder {
  private readonly binder: CursorUsageBinder;

  constructor(
    private readonly endpointRegistry: EndpointRegistry,
    private readonly accessRegistry: AccessRegistry,
    private readonly bindingRegistry: CursorUsageBindingRegistry,
    private readonly sessionProbe: CursorUsageSessionProbe = new EmptyCursorUsageSessionProbe(),
  ) {
    this.binder = new CursorUsageBinder(
      this.endpointRegistry,
      this.accessRegistry,
      this.bindingRegistry,
    );
  }

  autoBind(connectionId: string): CursorUsageAutoBindResult {
    const access = this.accessRegistry.get(connectionId);
    if (!access) {
      throw new Error(`Connection not found: ${connectionId}`);
    }

    const endpoint = this.endpointRegistry.get(access.endpointId);
    if (!endpoint || access.authMode !== "cursor_session" || EndpointShape.readFamily(endpoint) !== "cursor") {
      return {
        connectionId,
        status: "not_cursor_connection",
      };
    }

    if (this.bindingRegistry.get(connectionId)) {
      return {
        connectionId,
        status: "already_bound",
      };
    }

    const credential = this.accessRegistry.readCredential(connectionId);
    if (credential.kind !== "cursor_session") {
      return {
        connectionId,
        status: "not_cursor_connection",
      };
    }

    const localFingerprint = CursorUsageIdentity.fromSavedConnection(
      access,
      credential as CursorSessionCredential,
    );

    const candidate = this.findMatchingCandidate(localFingerprint.workosUserId);
    if (!candidate) {
      return {
        connectionId,
        status: "no_session_found",
      };
    }

    return {
      connectionId,
      status: "bound",
      binding: this.binder.bind(connectionId, candidate.sessionToken),
      sourceLabel: candidate.sourceLabel,
      locationLabel: candidate.locationLabel,
    };
  }

  autoBindAllMissing(): CursorUsageAutoBindResult[] {
    return this.accessRegistry
      .list()
      .filter((access) => access.authMode === "cursor_session")
      .map((access) => this.autoBind(access.id))
      .filter((result) => result.status !== "not_cursor_connection");
  }

  private findMatchingCandidate(workosUserId: string): CursorUsageSessionCandidate | null {
    return this.sessionProbe.probe().find((candidate) => candidate.workosUserId === workosUserId) ?? null;
  }
}
