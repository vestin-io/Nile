import { homedir } from "node:os";
import { dirname, join } from "node:path";

import type {
  StoredCredential,
} from "@nile/core/services/credential";
import { isDirectApiKeyCredential } from "@nile/core/services/credential";
import type { CredentialStore } from "@nile/core/services/credential";
import { FileSnapshotStore } from "@nile/core/services/history";
import { MutationHistory } from "@nile/core/services/history";
import { SecureSnapshotStore } from "@nile/core/services/history";
import { NileLogger } from "@nile/core/services/NileLogger";
import { ApplySelectionValidationError } from "@nile/core/agents/ApplySelectionValidationError";
import {
  AgentApplySupport,
  type PreparedAgentApplySelection,
} from "@nile/core/actions/apply";
import { ApplyMutation } from "@nile/core/agents/ApplyMutation";
import {
  AgentWorkspaceBinding,
} from "@nile/core/runtime-local/AgentWorkspaceBinding";
import type { AgentWorkspaceContext } from "@nile/core/runtime-local/AgentWorkspaceContext";
import { CURSOR_AGENT_ID } from "./types";
import { CURSOR_PROJECTION } from "./Projection";
import type { CursorProjection } from "./ProjectionTypes";
import { CursorHistoryTargets } from "./HistoryTargets";
import { CursorConfigStore } from "./stores/CursorConfigStore";
import { CursorCredentialStore } from "./stores/CursorCredentialStore";

export { ApplySelectionValidationError };

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
    const binding = AgentWorkspaceBinding.open(databasePath, credentialStore);

    return new ApplySelection(
      new ApplyMutation(
        binding.createMutationHistory(
          options?.secureSnapshotStore,
          logger.child({ scope: "mutation-history" }),
        ),
        binding.createApplySupport(
          CURSOR_AGENT_ID,
          credentialStore,
          logger,
          (message: string) => new ApplySelectionValidationError(message),
          CURSOR_PROJECTION.resolve,
        ),
        logger,
      ),
      new CursorConfigStore(cursorHome),
      new CursorCredentialStore(),
      binding,
    );
  }

  static fromContext(
    context: AgentWorkspaceContext,
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
    const binding = AgentWorkspaceBinding.fromContext(context);

    return new ApplySelection(
      new ApplyMutation(
        binding.createMutationHistory(
          options?.secureSnapshotStore,
          logger.child({ scope: "mutation-history" }),
        ),
        binding.createApplySupport(
          CURSOR_AGENT_ID,
          credentialStore,
          logger,
          (message: string) => new ApplySelectionValidationError(message),
          CURSOR_PROJECTION.resolve,
        ),
        logger,
      ),
      new CursorConfigStore(cursorHome),
      new CursorCredentialStore(),
    );
  }

  constructor(
    private readonly applyMutation: ApplyMutation,
    private readonly configStore: CursorConfigStore,
    private readonly cursorCredentialStore: CursorCredentialStore,
    private readonly ownedContext: { close(): void } | null = null,
  ) {}

  apply(connectionId: string) {
    const configSnapshot = this.configStore.snapshot();
    const credentialSnapshot = this.cursorCredentialStore.snapshot();
    return this.applyMutation.execute({
      agentId: CURSOR_AGENT_ID,
      connectionId,
      historyMarkFailedEvent: "cursor.apply.history_mark_failed",
      buildFiles: () => [
        {
          path: this.configStore.configPath,
          content: configSnapshot,
          existedBefore: configSnapshot !== null,
        },
        ...CursorHistoryTargets.toTrackedEntries(credentialSnapshot),
      ],
      apply: (prepared) => {
        const projection = this.requireCursorProjection(prepared.projection);
        if (prepared.access.authMode === "cursor_session") {
          this.applyCursorSession(prepared.credential, projection.backendUrl);
          return;
        }

        this.applyApiKey(prepared.credential, projection.backendUrl);
      },
      readAppliedFiles: () => [
        { path: this.configStore.configPath, content: this.configStore.snapshot() },
        ...CursorHistoryTargets.toTrackedEntries(this.cursorCredentialStore.snapshot()).map((entry) => ({
          path: entry.path,
          content: entry.content,
        })),
      ],
      restore: () => {
        this.cursorCredentialStore.restore(credentialSnapshot);
        this.configStore.restore(configSnapshot);
      },
    });
  }

  close(): void {
    this.applyMutation.close();
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
