import { useEffect, useMemo, useState } from "react";
import type { AgentId } from "@nile/core/models/agent";
import type { CredentialStorageBackend } from "@nile/core/services/credential";
import { ArrowLeft, ArrowRight } from "lucide-react";

import {
  hasCompatibleConnections,
  readCompatibleConnections,
  type SettingsState,
} from "../shared/DesktopData";
import type { Translator } from "../shared/I18n";
import { readEncryptedLocalUnlockErrorMessage } from "../shared/EncryptedLocalUnlock";
import { useEncryptedLocalAccessRecovery } from "../shared/EncryptedLocalAccess";
import { readSystemSecureStorageName } from "../shared/Platform";
import { nileMarkSvg } from "../shared/NileMark";
import { QuickSetupAgentCard } from "./AgentCard";
import { QuickSetupConnectionDialog } from "./ConnectionDialog";
import { QuickSetupGuide } from "./Guide";
import { QuickSetupStorageStep } from "./StorageStep";
import { CredentialStorageDialog } from "../connections/dialogs/CredentialStorage";
import { Button } from "../ui/button";
import { Empty, EmptyDescription, EmptyHeader, EmptyTitle } from "../ui/empty";
import { Card, CardContent } from "../ui/card";

type QuickSetupPageProps = {
  canConfigureAgent(agentId: AgentId): boolean;
  credentialStorageMode: CredentialStorageBackend | null;
  credentialStorageState: Awaited<ReturnType<typeof window.nileDesktop.connections.getCredentialStorageState>>;
  isCredentialPortabilityBusy: boolean;
  isCredentialStorageModeLocked: boolean;
  isCredentialStorageModeMixed: boolean;
  state: SettingsState;
  t: Translator;
  onConfigureAgent(agentId: AgentId): void;
  onImportCredentials(): Promise<void>;
  onRefreshCredentialStorageState(): Promise<Awaited<ReturnType<typeof window.nileDesktop.connections.getCredentialStorageState>>>;
  onRememberCredentialStorageMode(backend: CredentialStorageBackend): void;
  onSaveAgent(
    agentId: AgentId,
    input: {
      credentialStorageBackend: CredentialStorageBackend;
      encryptedLocalPassphrase?: string;
    },
  ): Promise<void>;
  onDone(): void;
  onOpenModelSetup(agentId: AgentId): void;
  onUpdateAgentConnectionModel(agentId: AgentId, connectionId: string, modelId: string | null): Promise<void>;
  onUseExistingConnection(agentId: AgentId, connectionId: string): Promise<void>;
};

type Step = "storage" | "agents";

export function QuickSetupPage({
  canConfigureAgent,
  credentialStorageMode,
  credentialStorageState,
  isCredentialPortabilityBusy,
  isCredentialStorageModeLocked,
  isCredentialStorageModeMixed,
  state,
  t,
  onConfigureAgent,
  onImportCredentials,
  onRefreshCredentialStorageState,
  onRememberCredentialStorageMode,
  onSaveAgent,
  onDone,
  onOpenModelSetup,
  onUpdateAgentConnectionModel,
  onUseExistingConnection,
}: QuickSetupPageProps) {
  const systemSecureStorageName = readSystemSecureStorageName(t);
  const [configureAgentId, setConfigureAgentId] = useState<AgentId | null>(null);
  const [credentialStorageBackend, setCredentialStorageBackend] = useState<CredentialStorageBackend>(
    credentialStorageMode ?? "system_secure_storage",
  );
  const [encryptedLocalPassphrase, setEncryptedLocalPassphrase] = useState("");
  const [encryptedLocalPassphraseConfirmation, setEncryptedLocalPassphraseConfirmation] = useState("");
  const [credentialStorageError, setCredentialStorageError] = useState<string | null>(null);
  const [isCredentialStorageDialogOpen, setIsCredentialStorageDialogOpen] = useState(false);
  const [pendingSaveAgentId, setPendingSaveAgentId] = useState<AgentId | null>(null);
  const [optimisticallySavedAgentIds, setOptimisticallySavedAgentIds] = useState<AgentId[]>([]);
  const [step, setStep] = useState<Step>(credentialStorageMode === null ? "storage" : "agents");
  const { requestUnlock } = useEncryptedLocalAccessRecovery();
  const activeCredentialStorageMode = credentialStorageMode ?? credentialStorageBackend;
  const detectedSetupsByAgent = new Map(
    state.detectedSetups.items.map((item) => [item.agentId, item]),
  );
  const existingCompatibleConnections = useMemo(
    () => {
      if (!configureAgentId) {
        return [];
      }
      return readCompatibleConnections(state, configureAgentId);
    },
    [configureAgentId, state],
  );

  useEffect(() => {
    if (isCredentialStorageModeMixed) {
      setStep("agents");
      return;
    }
    if (credentialStorageMode === null) {
      setCredentialStorageBackend("system_secure_storage");
      setStep("storage");
      return;
    }
    setCredentialStorageBackend(credentialStorageMode);
    setStep("agents");
  }, [credentialStorageMode, isCredentialStorageModeMixed]);

  if (isCredentialStorageModeMixed) {
    return (
      <div className="mx-auto flex w-full max-w-3xl flex-col gap-6 py-14">
        <Empty>
          <EmptyHeader>
            <EmptyTitle>{t("settings.credentialStorage.mixedTitle")}</EmptyTitle>
            <EmptyDescription>{t("settings.credentialStorage.mixedDescription")}</EmptyDescription>
          </EmptyHeader>
        </Empty>
      </div>
    );
  }

  const persistSelectedMode = () => {
    onRememberCredentialStorageMode(credentialStorageBackend);
  };

  const markAgentSaved = (agentId: AgentId) => {
    setOptimisticallySavedAgentIds((current) => (
      current.includes(agentId) ? current : [...current, agentId]
    ));
  };

  const requiresEncryptedLocalUnlock = activeCredentialStorageMode === "encrypted_local_storage"
    && credentialStorageState.encryptedLocalVaultExists
    && !credentialStorageState.encryptedLocalUnlocked;

  const continueFromStorageStep = async () => {
    if (requiresEncryptedLocalUnlock) {
      await requestUnlock(t("dialog.encryptedLocalUnlock.reasonContinueQuickSetup"));
      setStep("agents");
      return;
    }
    if (
      activeCredentialStorageMode === "encrypted_local_storage"
      && !credentialStorageState.encryptedLocalVaultExists
    ) {
      setCredentialStorageError(null);
      setIsCredentialStorageDialogOpen(true);
      return;
    }
    setStep("agents");
  };

  const saveAgent = async (agentId: AgentId): Promise<"requirements" | "saved"> => {
    if (requiresEncryptedLocalUnlock) {
      await requestUnlock(t("dialog.encryptedLocalUnlock.reasonSaveLocalSetup"));
    }
    if (
      activeCredentialStorageMode === "encrypted_local_storage"
      && !credentialStorageState.encryptedLocalVaultExists
      && !credentialStorageState.encryptedLocalUnlocked
    ) {
      setPendingSaveAgentId(agentId);
      setCredentialStorageError(null);
      setIsCredentialStorageDialogOpen(true);
      return "requirements";
    }
    await onSaveAgent(agentId, {
      credentialStorageBackend: activeCredentialStorageMode,
      encryptedLocalPassphrase: activeCredentialStorageMode === "encrypted_local_storage"
        ? encryptedLocalPassphrase.trim() || undefined
        : undefined,
    });
    if (!isCredentialStorageModeLocked && credentialStorageMode === null) {
      persistSelectedMode();
    }
    markAgentSaved(agentId);
    return "saved";
  };

  if (step === "storage") {
    return (
      <div className="space-y-8">
        <Empty className="gap-5">
          <EmptyHeader>
            <div
              aria-hidden="true"
              className="flex h-12 w-12 items-center justify-center text-foreground/85 [&_svg]:h-12 [&_svg]:w-12"
              dangerouslySetInnerHTML={{ __html: nileMarkSvg }}
            />
            <EmptyTitle>{t("quickSetup.title")}</EmptyTitle>
            <EmptyDescription>{t("quickSetup.description")}</EmptyDescription>
          </EmptyHeader>
        </Empty>

        <QuickSetupStorageStep
          backend={credentialStorageBackend}
          t={t}
          onBackendChange={setCredentialStorageBackend}
          onContinue={() => {
            void continueFromStorageStep();
          }}
        />

        <CredentialStorageDialog
          backend={credentialStorageBackend}
          errorMessage={credentialStorageError}
          encryptedLocalPassphrase={encryptedLocalPassphrase}
          encryptedLocalPassphraseConfirmation={encryptedLocalPassphraseConfirmation}
          encryptedLocalUnlocked={credentialStorageState.encryptedLocalUnlocked}
          encryptedLocalVaultExists={credentialStorageState.encryptedLocalVaultExists}
          open={isCredentialStorageDialogOpen}
          t={t}
          onConfirm={() => {
            void (async () => {
              try {
                const result = await window.nileDesktop.connections.unlockEncryptedLocalStorage(encryptedLocalPassphrase);
                if (!result.ok) {
                  setCredentialStorageError(readEncryptedLocalUnlockErrorMessage(result, t));
                  return;
                }
              } catch {
                setCredentialStorageError(t("dialog.encryptedLocalUnlock.errorUnknown"));
                return;
              }

              setCredentialStorageError(null);
              setIsCredentialStorageDialogOpen(false);
              await onRefreshCredentialStorageState();
              const nextPendingSaveAgentId = pendingSaveAgentId;
              setPendingSaveAgentId(null);
              if (nextPendingSaveAgentId) {
                try {
                  await onSaveAgent(nextPendingSaveAgentId, {
                    credentialStorageBackend: activeCredentialStorageMode,
                    encryptedLocalPassphrase: encryptedLocalPassphrase.trim() || undefined,
                  });
                  if (!isCredentialStorageModeLocked && credentialStorageMode === null) {
                    persistSelectedMode();
                  }
                  markAgentSaved(nextPendingSaveAgentId);
                } catch {
                  return;
                }
                return;
              }
              setStep("agents");
            })();
          }}
          onEncryptedLocalPassphraseChange={(value) => {
            setCredentialStorageError(null);
            setEncryptedLocalPassphrase(value);
          }}
          onEncryptedLocalPassphraseConfirmationChange={(value) => {
            setCredentialStorageError(null);
            setEncryptedLocalPassphraseConfirmation(value);
          }}
          onOpenChange={(open) => {
            setIsCredentialStorageDialogOpen(open);
            if (!open) {
              setCredentialStorageError(null);
              setPendingSaveAgentId(null);
            }
          }}
        />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <Empty className="gap-5">
        <EmptyHeader>
          <div
            aria-hidden="true"
            className="flex h-12 w-12 items-center justify-center text-foreground/85 [&_svg]:h-12 [&_svg]:w-12"
            dangerouslySetInnerHTML={{ __html: nileMarkSvg }}
          />
          <EmptyTitle>{t("quickSetup.title")}</EmptyTitle>
          <EmptyDescription>{t("quickSetup.description")}</EmptyDescription>
        </EmptyHeader>
      </Empty>

      <div className="space-y-5">
        <Card className="rounded-2xl border-border/80 bg-muted/20">
          <CardContent className="flex items-center justify-between gap-4 pt-6">
            <div className="space-y-1">
              <div className="text-sm uppercase tracking-[0.2em] text-muted-foreground/80">
                {t("quickSetup.storageSummary.eyebrow")}
              </div>
              <div className="text-lg font-medium text-foreground">
                {activeCredentialStorageMode === "system_secure_storage"
                  ? t("addConnection.storage.system.title")
                  : t("addConnection.storage.encrypted.title")}
              </div>
              <div className="text-sm text-muted-foreground">
                {activeCredentialStorageMode === "system_secure_storage"
                  ? t("addConnection.storage.system.description", { systemSecureStorageName })
                  : t("addConnection.storage.encrypted.description")}
              </div>
            </div>
            {!isCredentialStorageModeLocked ? (
              <Button variant="outline" className="rounded-xl" onClick={() => setStep("storage")}>
                <ArrowLeft className="h-4 w-4" />
                {t("quickSetup.storageSummary.change")}
              </Button>
            ) : null}
          </CardContent>
        </Card>

        <QuickSetupGuide
          isImporting={isCredentialPortabilityBusy}
          onboarding={state.detectedSetups}
          t={t}
          onImport={() => {
            void onImportCredentials();
          }}
        />

        <div className="space-y-4">
          {state.agents.map((agent) => (
            <QuickSetupAgentCard
              key={agent.agentId}
              agent={agent}
              canConfigure={canConfigureAgent(agent.agentId)}
              detectedSetup={detectedSetupsByAgent.get(agent.agentId) ?? null}
              optimisticallySaved={optimisticallySavedAgentIds.includes(agent.agentId)}
              t={t}
              onConfirm={saveAgent}
              onConfigure={(agentId) => {
                if (!hasCompatibleConnections(state, agentId)) {
                  onConfigureAgent(agentId);
                  return;
                }
                setConfigureAgentId(agentId);
              }}
            />
          ))}
        </div>

        <div className="flex justify-end pt-1">
          <Button size="sm" onClick={onDone}>
            {t("quickSetup.goToAgents")}
            <ArrowRight className="h-4 w-4" />
          </Button>
        </div>
      </div>

      <QuickSetupConnectionDialog
        agentId={configureAgentId}
        connections={existingCompatibleConnections}
        open={configureAgentId !== null}
        t={t}
        onAddNew={(agentId) => {
          onConfigureAgent(agentId);
        }}
        onOpenModelSetup={onOpenModelSetup}
        onUpdateAgentConnectionModel={onUpdateAgentConnectionModel}
        onOpenChange={(open) => {
          if (!open) {
            setConfigureAgentId(null);
          }
        }}
        onUseExistingConnection={onUseExistingConnection}
      />
    </div>
  );
}
