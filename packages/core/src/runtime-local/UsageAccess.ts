import type { ConnectionUsageResult } from "../actions/usage/Result";
import type { BindCursorUsageResult } from "../actions/usage/cursor/Binder";
import type { CursorUsageAutoBindResult } from "../application/local/CursorUsageAutoBinder";
import type { CursorUsageSessionProbe } from "../application/local/CursorUsageSessionProbe";
import type { LocalWorkspaceState } from "../application/local/WorkspaceState";
import type { Usage } from "../actions/usage/Usage";

export class SessionUsageAccess {
  constructor(
    private readonly workspaceState: LocalWorkspaceState,
    private readonly usage: Usage,
    private readonly cursorUsageSessionProbe?: CursorUsageSessionProbe,
  ) {}

  getConnectionUsage(connectionId: string): Promise<ConnectionUsageResult> {
    return this.usage.get(connectionId);
  }

  bindCursorUsage(connectionId: string, sessionToken: string): BindCursorUsageResult {
    return this.workspaceState.createCursorUsageBinder().bind(connectionId, sessionToken);
  }

  autoBindCursorUsage(connectionId: string): CursorUsageAutoBindResult {
    return this.workspaceState.createCursorUsageAutoBinder(this.cursorUsageSessionProbe).autoBind(connectionId);
  }

  autoBindAllCursorUsage(): CursorUsageAutoBindResult[] {
    return this.workspaceState.createCursorUsageAutoBinder(this.cursorUsageSessionProbe).autoBindAllMissing();
  }

  clearConnectionArtifacts(connectionId: string): void {
    this.workspaceState.clearCursorUsageArtifacts(connectionId);
  }
}
