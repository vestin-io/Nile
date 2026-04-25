import { homedir } from "node:os";
import { dirname, join } from "node:path";

import type {
  StoredCredential,
} from "../../services/credential/Types";
import { isDirectApiKeyCredential } from "../../services/credential/Types";
import type { CredentialStore } from "../../services/credential/Store";
import { FileSnapshotStore } from "../../services/history/FileSnapshotStore";
import { MutationHistory } from "../../services/history/MutationHistory";
import { SecureSnapshotStore } from "../../services/history/SecureSnapshotStore";
import { NileLogger } from "../../services/NileLogger";
import {
  AgentApplySupport,
  type PreparedAgentApplySelection,
} from "../../actions/use/ApplySupport";
import type { CursorProjection } from "../../projection";
import {
  AgentAdapterContextSession,
  type SharedAgentAdapterContext,
} from "../../runtime-local/AgentAdapterContext";
import { CURSOR_AGENT_ID } from "./types";
import { CursorHistoryTargets } from "./HistoryTargets";
import { CursorConfigStore } from "./stores/CursorConfigStore";
import { CursorCredentialStore } from "./stores/CursorCredentialStore";

export class ApplySelectionValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ApplySelectionValidationError";
  }
}

export class ApplySelection {
  static open(
    databasePath: string,
    options: {
      cursorHome?: string;
      credentialStore: CredentialStore;
      secureSnapshotStore?: SecureSnapshotStore;
      logger?: NileLogger;
    },
  ): ApplySelection {
    const cursorHome = options?.cursorHome ?? join(homedir(), ".cursor");
    const credentialStore = options.credentialStore;
    const logger = options?.logger ?? NileLogger.silent().child({ module: "cursor-apply-selection" });
    const context = AgentAdapterContextSession.open(databasePath, credentialStore);

    return new ApplySelection(
      new MutationHistory(
        context.database,
        new FileSnapshotStore(join(dirname(databasePath), "history")),
        options?.secureSnapshotStore ?? new SecureSnapshotStore(),
        logger.child({ scope: "mutation-history" }),
      ),
      new CursorConfigStore(cursorHome),
      new CursorCredentialStore(),
      new AgentApplySupport(
        CURSOR_AGENT_ID,
        context.endpointRegistry,
        context.accessRegistry,
        context.agentSelection,
        credentialStore,
        logger,
        (message) => new ApplySelectionValidationError(message),
      ),
      context,
    );
  }

  static fromContext(
    context: SharedAgentAdapterContext,
    options: {
      cursorHome?: string;
      credentialStore: CredentialStore;
      secureSnapshotStore?: SecureSnapshotStore;
      logger?: NileLogger;
    },
  ): ApplySelection {
    const cursorHome = options?.cursorHome ?? join(homedir(), ".cursor");
    const credentialStore = options.credentialStore;
    const logger = options?.logger ?? NileLogger.silent().child({ module: "cursor-apply-selection" });

    return new ApplySelection(
      new MutationHistory(
        context.database,
        new FileSnapshotStore(join(dirname(context.databasePath), "history")),
        options?.secureSnapshotStore ?? new SecureSnapshotStore(),
        logger.child({ scope: "mutation-history" }),
      ),
      new CursorConfigStore(cursorHome),
      new CursorCredentialStore(),
      new AgentApplySupport(
        CURSOR_AGENT_ID,
        context.endpointRegistry,
        context.accessRegistry,
        context.agentSelection,
        credentialStore,
        logger,
        (message) => new ApplySelectionValidationError(message),
      ),
    );
  }

  constructor(
    private readonly mutationHistory: MutationHistory,
    private readonly configStore: CursorConfigStore,
    private readonly cursorCredentialStore: CursorCredentialStore,
    private readonly applySupport: AgentApplySupport,
    private readonly ownedContext: AgentAdapterContextSession | null = null,
  ) {}

  apply(connectionId: string) {
    const prepared = this.applySupport.prepare(connectionId);
    const projection = this.requireCursorProjection(prepared.projection);
    const configSnapshot = this.configStore.snapshot();
    const credentialSnapshot = this.cursorCredentialStore.snapshot();
    const mutation = this.mutationHistory.start({
      agentId: CURSOR_AGENT_ID,
      type: "apply_selection",
      connectionId: prepared.connectionId,
      connectionLabel: prepared.connection.label,
      endpointLabel: prepared.endpoint.label,
      accessLabel: prepared.access.label,
      files: [
        {
          path: this.configStore.configPath,
          content: configSnapshot,
          existedBefore: configSnapshot !== null,
        },
        ...CursorHistoryTargets.toTrackedEntries(credentialSnapshot),
      ],
    });

    try {
      if (prepared.access.authMode === "cursor_session") {
        this.applyCursorSession(prepared.credential, projection.backendUrl);
      } else {
        this.applyApiKey(prepared.credential, projection.backendUrl);
      }
      this.mutationHistory.markApplied(mutation.id, [
        { path: this.configStore.configPath, content: this.configStore.snapshot() },
        ...CursorHistoryTargets.toTrackedEntries(this.cursorCredentialStore.snapshot()).map((entry) => ({
          path: entry.path,
          content: entry.content,
        })),
      ]);
    } catch (error) {
      this.cursorCredentialStore.restore(credentialSnapshot);
      this.configStore.restore(configSnapshot);
      this.mutationHistory.markFailed(mutation.id, error instanceof Error ? error.message : String(error));
      this.applySupport.logRollback(error, prepared);
      throw error;
    }

    return this.applySupport.complete(prepared);
  }

  close(): void {
    this.mutationHistory.close();
    this.ownedContext?.close();
  }

  private requireCursorProjection(
    projection: PreparedAgentApplySelection["projection"],
  ): CursorProjection {
    if (projection.agentId !== CURSOR_AGENT_ID) {
      throw new ApplySelectionValidationError(
        `Expected a cursor projection but received ${projection.agentId}`,
      );
    }
    return projection as CursorProjection;
  }

  private applyCursorSession(credential: StoredCredential, backendUrl: string): void {
    if (credential.kind !== "cursor_session") {
      throw new ApplySelectionValidationError("Cursor session connections require a cursor_session credential");
    }

    const authId = credential.authId?.trim() || "";
    const authCacheKey = credential.authCacheKey?.trim() || (authId ? `auth:${authId}` : "");
    if (!authCacheKey) {
      throw new ApplySelectionValidationError("Cursor session credentials require auth identity metadata");
    }

    this.cursorCredentialStore.applySession(credential.accessToken, credential.refreshToken);
    this.configStore.applySession(
      {
        ...(credential.email ? { email: credential.email } : {}),
        ...(credential.displayName ? { displayName: credential.displayName } : {}),
        ...(typeof credential.userId === "number" ? { userId: credential.userId } : {}),
        ...(authId ? { authId } : {}),
      },
      authCacheKey,
      backendUrl,
    );
  }

  private applyApiKey(credential: StoredCredential, backendUrl: string): void {
    if (!isDirectApiKeyCredential(credential)) {
      throw new ApplySelectionValidationError("Cursor API key connections require an api_key credential");
    }

    this.cursorCredentialStore.applyApiKey(credential.apiKey);
    this.configStore.applyApiKey(backendUrl);
  }
}
