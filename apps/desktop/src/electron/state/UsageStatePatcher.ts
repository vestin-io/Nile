import { isDeepStrictEqual } from "node:util";

import type {
  DesktopAgentState,
  DesktopConnection,
  DesktopStatusEntryAgentState,
  DesktopStatusEntryState,
  SettingsState,
} from "../../state/Types";
import type { DesktopUsageState } from "../../state/UsageSummary";

type UsageByConnectionId = Map<string, DesktopUsageState | null>;

export type UsageStatePatchResult<T> = {
  changed: boolean;
  value: T;
};

export class DesktopUsageStatePatcher {
  patchStatusEntryState(
    state: DesktopStatusEntryState,
    usageByConnectionId: UsageByConnectionId,
  ): UsageStatePatchResult<DesktopStatusEntryState> {
    let changed = false;
    const agents = state.agents.map((agent) => {
      const patched = this.patchStatusEntryAgentState(agent, usageByConnectionId);
      changed = changed || patched.changed;
      return patched.value;
    });

    return {
      changed,
      value: changed ? { ...state, agents } : state,
    };
  }

  patchSettingsState(
    state: SettingsState,
    usageByConnectionId: UsageByConnectionId,
  ): UsageStatePatchResult<SettingsState> {
    let changed = false;
    const currentConnection = this.patchConnection(state.currentConnection, usageByConnectionId);
    changed = changed || currentConnection.changed;

    const connections = this.patchConnections(state.connections, usageByConnectionId);
    changed = changed || connections.changed;

    const currentAgentConnections = this.patchConnections(state.currentAgentConnections, usageByConnectionId);
    changed = changed || currentAgentConnections.changed;

    const agents = state.agents.map((agent) => {
      const patched = this.patchAgentState(agent, usageByConnectionId);
      changed = changed || patched.changed;
      return patched.value;
    });

    return {
      changed,
      value: changed
        ? {
          ...state,
          currentConnection: currentConnection.value,
          connections: connections.value,
          currentAgentConnections: currentAgentConnections.value,
          agents,
        }
        : state,
    };
  }

  private patchStatusEntryAgentState(
    agent: DesktopStatusEntryAgentState,
    usageByConnectionId: UsageByConnectionId,
  ): UsageStatePatchResult<DesktopStatusEntryAgentState> {
    const currentConnection = this.patchConnection(agent.currentConnection, usageByConnectionId);
    const currentUsage = this.patchUsage(agent.currentConnection?.id ?? null, agent.currentUsage, usageByConnectionId);
    const connections = this.patchConnections(agent.connections, usageByConnectionId);
    const changed = currentConnection.changed || currentUsage.changed || connections.changed;

    return {
      changed,
      value: changed
        ? {
          ...agent,
          currentConnection: currentConnection.value,
          currentUsage: currentUsage.value,
          connections: connections.value,
        }
        : agent,
    };
  }

  private patchAgentState(
    agent: DesktopAgentState,
    usageByConnectionId: UsageByConnectionId,
  ): UsageStatePatchResult<DesktopAgentState> {
    const currentConnection = this.patchConnection(agent.currentConnection, usageByConnectionId);
    const currentUsage = this.patchUsage(agent.currentConnection?.id ?? null, agent.currentUsage, usageByConnectionId);
    const connections = this.patchConnections(agent.connections, usageByConnectionId);
    const changed = currentConnection.changed || currentUsage.changed || connections.changed;

    return {
      changed,
      value: changed
        ? {
          ...agent,
          currentConnection: currentConnection.value,
          currentUsage: currentUsage.value,
          connections: connections.value,
        }
        : agent,
    };
  }

  private patchConnections(
    connections: DesktopConnection[],
    usageByConnectionId: UsageByConnectionId,
  ): UsageStatePatchResult<DesktopConnection[]> {
    let changed = false;
    const value = connections.map((connection) => {
      const patched = this.patchNonNullConnection(connection, usageByConnectionId);
      changed = changed || patched.changed;
      return patched.value;
    });

    return {
      changed,
      value: changed ? value : connections,
    };
  }

  private patchConnection(
    connection: DesktopConnection | null,
    usageByConnectionId: UsageByConnectionId,
  ): UsageStatePatchResult<DesktopConnection | null> {
    if (!connection || !usageByConnectionId.has(connection.id)) {
      return {
        changed: false,
        value: connection,
      };
    }

    const nextUsage = usageByConnectionId.get(connection.id) ?? null;
    if (isDeepStrictEqual(connection.usage ?? null, nextUsage)) {
      return {
        changed: false,
        value: connection,
      };
    }

    return {
      changed: true,
      value: {
        ...connection,
        usage: nextUsage,
      },
    };
  }

  private patchNonNullConnection(
    connection: DesktopConnection,
    usageByConnectionId: UsageByConnectionId,
  ): UsageStatePatchResult<DesktopConnection> {
    const patched = this.patchConnection(connection, usageByConnectionId);
    if (!patched.value) {
      throw new Error("Desktop connection patch unexpectedly removed a connection.");
    }
    return patched as UsageStatePatchResult<DesktopConnection>;
  }

  private patchUsage(
    connectionId: string | null,
    usage: DesktopUsageState | null,
    usageByConnectionId: UsageByConnectionId,
  ): UsageStatePatchResult<DesktopUsageState | null> {
    if (!connectionId || !usageByConnectionId.has(connectionId)) {
      return {
        changed: false,
        value: usage,
      };
    }

    const nextUsage = usageByConnectionId.get(connectionId) ?? null;
    return {
      changed: !isDeepStrictEqual(usage, nextUsage),
      value: nextUsage,
    };
  }
}
