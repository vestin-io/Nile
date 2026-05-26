import { applyAddConnectionCompletionTarget } from "./useNavigation";
import type {
  AddConnectionReturnTarget,
  PageId,
  ReusedConnectionDialogState,
} from "./useNavigation";

type SettingsConnectionMutationCoordinatorOptions = {
  addConnectionReturnTarget: AddConnectionReturnTarget;
  setCurrentPage(page: PageId): void;
  setReusedConnectionDialog(dialog: ReusedConnectionDialogState): void;
  setSelectedConnectionId(connectionId: string | null): void;
};

export class SettingsConnectionMutationCoordinator {
  constructor(private readonly options: SettingsConnectionMutationCoordinatorOptions) {}

  complete(connectionId: string, reused: boolean): void {
    if (reused) {
      this.options.setReusedConnectionDialog({
        connectionId,
        target: this.options.addConnectionReturnTarget,
      });
      return;
    }

    applyAddConnectionCompletionTarget(
      this.options.addConnectionReturnTarget,
      connectionId,
      this.options.setCurrentPage,
      this.options.setSelectedConnectionId,
    );
  }

  continue(dialog: ReusedConnectionDialogState): void {
    if (!dialog) {
      return;
    }

    this.options.setReusedConnectionDialog(null);
    applyAddConnectionCompletionTarget(
      dialog.target,
      dialog.connectionId,
      this.options.setCurrentPage,
      this.options.setSelectedConnectionId,
    );
  }
}
