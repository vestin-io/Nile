import { rmSync } from "node:fs";

import type { ResetStateResult, StateReset } from "@nile/core/application/local";

type DesktopStateResetOptions = {
  localStatePaths: string[];
  onResetLocalState?(): void;
  stateReset: Pick<StateReset, "reset">;
};

export class DesktopStateReset {
  constructor(private readonly options: DesktopStateResetOptions) {}

  reset(databasePath: string): ResetStateResult {
    const result = this.options.stateReset.reset(databasePath);
    for (const path of this.options.localStatePaths) {
      rmSync(path, { force: true, recursive: true });
    }
    this.options.onResetLocalState?.();
    return result;
  }
}
