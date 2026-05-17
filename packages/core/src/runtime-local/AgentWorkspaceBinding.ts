import { dirname, join } from "node:path";

import type { AgentId } from "../models/agent/Definitions";
import type { AgentConnectionSettings } from "../models/agent-settings";
import type { AgentSelection } from "../models/selection/Selection";
import type { CredentialStore } from "../services/credential/Store";
import { FileSnapshotStore, MutationHistory, SecureSnapshotStore } from "../services/history";
import type { NileLogger } from "../services/NileLogger";
import type { AgentProjection, ProjectionInput } from "../projection/Types";
import { AgentApplySupport } from "../actions/apply";
import { LiveSetupImportSupport, LiveSetupMatcher } from "../actions/live-setup";
import type { AgentWorkspaceContext } from "./AgentWorkspaceContext";
import { AgentWorkspaceSession } from "./AgentWorkspaceSession";

type BuildValidationError = (message: string) => Error;
type ResolveProjection = (input: ProjectionInput) => AgentProjection;

export class AgentWorkspaceBinding {
  static open(databasePath: string, credentialStore: CredentialStore): AgentWorkspaceBinding {
    const session = AgentWorkspaceSession.open(databasePath, credentialStore);
    return new AgentWorkspaceBinding(session.sharedContext, session);
  }

  static fromContext(context: AgentWorkspaceContext): AgentWorkspaceBinding {
    return new AgentWorkspaceBinding(context);
  }

  private constructor(
    readonly context: AgentWorkspaceContext,
    private readonly ownedSession: AgentWorkspaceSession | null = null,
  ) {}

  createMutationHistory(
    secureSnapshotStore: SecureSnapshotStore | undefined,
    logger: NileLogger,
  ): MutationHistory {
    return new MutationHistory(
      this.context.database,
      new FileSnapshotStore(join(dirname(this.context.databasePath), "history")),
      secureSnapshotStore ?? new SecureSnapshotStore(),
      logger,
    );
  }

  createApplySupport(
    agentId: AgentId,
    credentialStore: CredentialStore,
    logger: NileLogger,
    buildValidationError: BuildValidationError,
    resolveProjection: ResolveProjection,
  ): AgentApplySupport {
    return new AgentApplySupport(
      agentId,
      this.context.endpointRegistry,
      this.context.accessRegistry,
      this.context.agentSelection,
      this.context.agentConnectionSettings,
      credentialStore,
      logger,
      buildValidationError,
      resolveProjection,
    );
  }

  createLiveSetupMatcher(agentId: AgentId): LiveSetupMatcher {
    return new LiveSetupMatcher(
      this.context.endpointRegistry,
      this.context.accessRegistry,
      this.context.agentSelection,
      agentId,
      this.context.agentConnectionSettings,
    );
  }

  createLiveSetupImportSupport(
    agentId: AgentId,
    agentLabel: string,
    logger: NileLogger,
  ): LiveSetupImportSupport {
    return new LiveSetupImportSupport(
      agentId,
      agentLabel,
      this.context.endpointRegistry,
      this.context.accessRegistry,
      this.context.agentSelection,
      this.context.agentConnectionSettings,
      logger,
    );
  }

  close(): void {
    this.ownedSession?.close();
  }
}
