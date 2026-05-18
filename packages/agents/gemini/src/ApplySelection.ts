import { homedir } from "node:os";
import { dirname, join } from "node:path";

import type { CredentialStore } from "@nile/core/services/credential";
import type { GeminiCliSessionCredential } from "@nile/core/services/credential";
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
import { AgentWorkspaceBinding } from "@nile/core/runtime-local/AgentWorkspaceBinding";
import type { AgentWorkspaceContext } from "@nile/core/runtime-local/AgentWorkspaceContext";
import { GeminiAccountsStore } from "./AccountsStore";
import { GeminiCredentialBackend } from "./Backend";
import { GEMINI_AGENT_ID } from "./types";
import { GEMINI_PROJECTION } from "./Projection";
import { GeminiHistoryTargets } from "./HistoryTargets";
import { GeminiSessionIdentityReader } from "./Identity";
import { GeminiSettingsStore } from "./SettingsStore";
import { GeminiSessionStores } from "./Stores";
import type { GeminiProjection } from "./ProjectionTypes";

export { ApplySelectionValidationError };

export class ApplySelection {
  static open(
    databasePath: string,
    options: {
      geminiHome?: string;
      credentialStore: CredentialStore;
      secureSnapshotStore?: SecureSnapshotStore;
      logger?: NileLogger;
    },
  ): ApplySelection {
    const geminiHome = options.geminiHome ?? join(homedir(), ".gemini");
    const stores = GeminiSessionStores.open(geminiHome);
    const logger = options.logger ?? NileLogger.silent().child({ module: "gemini-apply-selection" });
    const binding = AgentWorkspaceBinding.open(databasePath, options.credentialStore);

    return new ApplySelection(
      new ApplyMutation(
        binding.createMutationHistory(
          options.secureSnapshotStore,
          logger.child({ scope: "mutation-history" }),
        ),
        binding.createApplySupport(
          GEMINI_AGENT_ID,
          options.credentialStore,
          logger,
          (message: string) => new ApplySelectionValidationError(message),
          GEMINI_PROJECTION.resolve,
        ),
        logger,
      ),
      stores.backend,
      stores.accounts,
      stores.settings,
      new GeminiSessionIdentityReader(),
      binding,
    );
  }

  static fromContext(
    context: AgentWorkspaceContext,
    options: {
      geminiHome?: string;
      credentialStore: CredentialStore;
      secureSnapshotStore?: SecureSnapshotStore;
      logger?: NileLogger;
    },
  ): ApplySelection {
    const geminiHome = options.geminiHome ?? join(homedir(), ".gemini");
    const stores = GeminiSessionStores.open(geminiHome);
    const logger = options.logger ?? NileLogger.silent().child({ module: "gemini-apply-selection" });
    const binding = AgentWorkspaceBinding.fromContext(context);

    return new ApplySelection(
      new ApplyMutation(
        binding.createMutationHistory(
          options.secureSnapshotStore,
          logger.child({ scope: "mutation-history" }),
        ),
        binding.createApplySupport(
          GEMINI_AGENT_ID,
          options.credentialStore,
          logger,
          (message: string) => new ApplySelectionValidationError(message),
          GEMINI_PROJECTION.resolve,
        ),
        logger,
      ),
      stores.backend,
      stores.accounts,
      stores.settings,
      new GeminiSessionIdentityReader(),
    );
  }

  constructor(
    private readonly applyMutation: ApplyMutation,
    private readonly backend: GeminiCredentialBackend,
    private readonly accountsStore: GeminiAccountsStore,
    private readonly settingsStore: GeminiSettingsStore,
    private readonly identityReader: GeminiSessionIdentityReader,
    private readonly ownedContext: { close(): void } | null = null,
  ) {}

  apply(connectionId: string) {
    const backendSnapshot = this.backend.snapshot();
    const accountsSnapshot = this.accountsStore.snapshot();
    const settingsSnapshot = this.settingsStore.snapshot();

    return this.applyMutation.execute({
      agentId: GEMINI_AGENT_ID,
      connectionId,
      historyMarkFailedEvent: "gemini.apply.history_mark_failed",
      buildFiles: () => [
        GeminiHistoryTargets.toTrackedEntry(backendSnapshot),
        {
          path: this.accountsStore.accountsPath,
          content: accountsSnapshot,
          existedBefore: accountsSnapshot !== null,
        },
        {
          path: this.settingsStore.settingsPath,
          content: settingsSnapshot,
          existedBefore: settingsSnapshot !== null,
        },
      ],
      apply: (prepared) => {
        const projection = this.requireGeminiProjection(prepared.projection);
        const credential = this.requireGeminiSessionCredential(prepared.credential);
        const email = this.identityReader.readEmail(credential);
        if (!email?.trim()) {
          throw new ApplySelectionValidationError("Gemini session credentials require an email in idToken");
        }

        this.backend.apply(credential);
        this.accountsStore.applyActive(email.trim());
        this.settingsStore.applySelectedAuthType(projection.selectedAuthType);
        if (projection.modelId?.trim()) {
          this.settingsStore.applyModelName(projection.modelId);
        }
      },
      readAppliedFiles: () => [
        {
          path: GeminiHistoryTargets.toTrackedEntry(this.backend.snapshot()).path,
          content: GeminiHistoryTargets.toTrackedEntry(this.backend.snapshot()).content,
        },
        { path: this.accountsStore.accountsPath, content: this.accountsStore.snapshot() },
        { path: this.settingsStore.settingsPath, content: this.settingsStore.snapshot() },
      ],
      restore: () => {
        this.backend.restoreSnapshot(backendSnapshot);
        this.accountsStore.restore(accountsSnapshot);
        this.settingsStore.restore(settingsSnapshot);
      },
    });
  }

  close(): void {
    this.applyMutation.close();
    this.ownedContext?.close();
  }

  private requireGeminiProjection(
    projection: PreparedAgentApplySelection["projection"],
  ): GeminiProjection {
    if (projection.agentId !== GEMINI_AGENT_ID) {
      throw new ApplySelectionValidationError(
        `Expected a gemini projection but received ${projection.agentId}`,
      );
    }
    return projection as GeminiProjection;
  }

  private requireGeminiSessionCredential(
    credential: PreparedAgentApplySelection["credential"],
  ): GeminiCliSessionCredential {
    if (credential.kind !== "gemini_cli_session") {
      throw new ApplySelectionValidationError("Gemini connections require a gemini_cli_session credential");
    }
    return credential;
  }
}
