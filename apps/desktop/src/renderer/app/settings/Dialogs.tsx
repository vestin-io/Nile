import {
  applyAddConnectionCompletionTarget,
  type AddConnectionReturnTarget,
  type PageId,
  type ReusedConnectionDialogState,
} from "./useNavigation";
import { CursorUsageRepairDialog } from "../../connections/dialogs/RepairUsage";
import { ResetStateDialog } from "../../settings/dialogs/ResetState";
import { ReusedConnectionDialog } from "../../connections/dialogs/Reused";
import { NileDialog } from "../../settings/dialogs/Nile";
import type { DesktopConnection } from "../../../state/Types";
import type { Translator } from "../../shared/I18n";

type SettingsDialogsProps = {
  isResetting: boolean;
  isSupportOpen: boolean;
  isResetDialogOpen: boolean;
  repairUsageConnection: DesktopConnection | null;
  reusedConnectionDialog: ReusedConnectionDialogState;
  t: Translator;
  onBindCursorUsage(connectionId: string, sessionToken: string): Promise<void>;
  onCloseRepairUsage(): void;
  onOpenGitHubIssues(): Promise<void>;
  onOpenSupport(): Promise<void>;
  onRefresh(): Promise<void>;
  onResetConfirm(): Promise<void>;
  onSetCurrentPage(page: PageId): void;
  onSetNileDialogOpen(open: boolean): void;
  onSetResetDialogOpen(open: boolean): void;
  onSetSelectedConnectionId(connectionId: string | null): void;
  onSetReusedConnectionDialog(value: ReusedConnectionDialogState): void;
};

export function SettingsDialogs({
  isResetting,
  isSupportOpen,
  isResetDialogOpen,
  repairUsageConnection,
  reusedConnectionDialog,
  t,
  onBindCursorUsage,
  onCloseRepairUsage,
  onOpenGitHubIssues,
  onOpenSupport,
  onRefresh,
  onResetConfirm,
  onSetCurrentPage,
  onSetNileDialogOpen,
  onSetResetDialogOpen,
  onSetSelectedConnectionId,
  onSetReusedConnectionDialog,
}: SettingsDialogsProps) {
  return (
    <>
      <CursorUsageRepairDialog
        connection={repairUsageConnection}
        open={repairUsageConnection !== null}
        t={t}
        onOpenChange={(open) => {
          if (!open) {
            onCloseRepairUsage();
          }
        }}
        onSubmit={async (connectionId, sessionToken) => {
          await onBindCursorUsage(connectionId, sessionToken);
          await onRefresh();
        }}
      />

      <ResetStateDialog
        isResetting={isResetting}
        open={isResetDialogOpen}
        t={t}
        onOpenChange={onSetResetDialogOpen}
        onConfirm={onResetConfirm}
      />

      <ReusedConnectionDialog
        open={reusedConnectionDialog !== null}
        t={t}
        onContinue={() => {
          if (!reusedConnectionDialog) {
            return;
          }
          const { connectionId, target } = reusedConnectionDialog;
          onSetReusedConnectionDialog(null);
          applyAddConnectionCompletionTarget(
            target as AddConnectionReturnTarget,
            connectionId,
            onSetCurrentPage,
            onSetSelectedConnectionId,
          );
        }}
      />

      <NileDialog
        open={isSupportOpen}
        t={t}
        onOpenChange={onSetNileDialogOpen}
        onOpenGitHubIssues={onOpenGitHubIssues}
        onOpenSupport={onOpenSupport}
      />
    </>
  );
}
