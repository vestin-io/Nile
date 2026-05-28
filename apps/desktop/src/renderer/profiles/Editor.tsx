import type { AgentId } from "@nile/core/models/agent";

import type { DesktopAdvancedState, DesktopAgentState } from "../../state/Types";
import type { Translator } from "../shared/I18n";
import { Button } from "../ui/button";
import { Input } from "../ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "../ui/table";
import type { WorkspaceProfile, WorkspaceProfileAssignment } from "./useProfiles";

export type EditableAssignment = {
  connectionId: string | null;
  homeInput: string;
};

type ProfileAssignmentsEditorProps = {
  agentHomes: DesktopAdvancedState["agentHomes"];
  agents: DesktopAgentState[];
  disabled: boolean;
  editableAssignments: Record<AgentId, EditableAssignment>;
  t: Translator;
  onChange(agentId: AgentId, nextEditable: EditableAssignment): void;
};

export function ProfileAssignmentsEditor({
  agentHomes,
  agents,
  disabled,
  editableAssignments,
  t,
  onChange,
}: ProfileAssignmentsEditorProps) {
  return (
    <div className="overflow-hidden rounded-2xl border bg-background">
      <div className="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow className="hover:bg-transparent">
              <TableHead className="w-[180px]">{t("profiles.agentColumn")}</TableHead>
              <TableHead className="min-w-[280px]">{t("profiles.connectionBadge")}</TableHead>
              <TableHead className="min-w-[320px]">{t("profiles.homeBadge")}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {agents.map((agent) => {
              const agentHome = agentHomes.find((entry) => entry.agentId === agent.agentId);
              if (!agentHome) {
                return null;
              }

              const editable = editableAssignments[agent.agentId];
              if (!editable) {
                return null;
              }

              return (
                <ProfileAssignmentRow
                  key={agent.agentId}
                  agent={agent}
                  defaultHomePath={agentHome.defaultPath}
                  disabled={disabled}
                  editable={editable}
                  t={t}
                  onChange={(nextEditable) => onChange(agent.agentId, nextEditable)}
                />
              );
            })}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}

type ProfileAssignmentRowProps = {
  agent: DesktopAgentState;
  defaultHomePath: string;
  disabled: boolean;
  editable: EditableAssignment;
  t: Translator;
  onChange(nextEditable: EditableAssignment): void;
};

function ProfileAssignmentRow({
  agent,
  defaultHomePath,
  disabled,
  editable,
  t,
  onChange,
}: ProfileAssignmentRowProps) {
  const showMissingSetupState = shouldShowMissingSetupState(agent);

  return (
    <TableRow className="hover:bg-transparent">
      <TableCell className="font-medium">{agent.agentLabel}</TableCell>
      <TableCell>
        {showMissingSetupState ? (
          <div className="text-sm text-muted-foreground">
            {t("profiles.noLocalSetup")}
          </div>
        ) : (
          <Select
            disabled={disabled}
            value={readAvailableConnectionId(agent, editable.connectionId) ?? ""}
            onValueChange={(value) => {
              onChange({
                ...editable,
                connectionId: value,
              });
            }}
          >
            <SelectTrigger className="h-11 rounded-xl">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {agent.connections.map((connection) => (
                <SelectItem key={connection.id} value={connection.id}>
                  {connection.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
      </TableCell>
      <TableCell>
        <div className="flex items-stretch">
          <Input
            className="h-11 rounded-r-none border-r-0"
            value={editable.homeInput}
            disabled={disabled}
            placeholder={defaultHomePath}
            onChange={(event) =>
              onChange({
                ...editable,
                homeInput: event.target.value,
              })
            }
          />
          <Button
            className="h-11 rounded-l-none border-l-0 px-4"
            variant="outline"
            disabled={disabled}
            onClick={() => {
              onChange({
                ...editable,
                homeInput: defaultHomePath,
              });
            }}
          >
            {t("profiles.resetDefault")}
          </Button>
        </div>
      </TableCell>
    </TableRow>
  );
}

function shouldShowMissingSetupState(agent: DesktopAgentState): boolean {
  return agent.connections.length === 0
    && agent.reconciliationState === "unavailable";
}

function readAvailableConnectionId(
  agent: DesktopAgentState,
  preferredConnectionId: string | null | undefined,
): string | null {
  if (preferredConnectionId && agent.connections.some((connection) => connection.id === preferredConnectionId)) {
    return preferredConnectionId;
  }
  if (agent.currentConnection?.id && agent.connections.some((connection) => connection.id === agent.currentConnection?.id)) {
    return agent.currentConnection.id;
  }
  return agent.connections[0]?.id ?? null;
}

export function buildEditableAssignmentsFromProfile(
  profile: WorkspaceProfile,
  agents: DesktopAgentState[],
  agentHomes: DesktopAdvancedState["agentHomes"],
): Record<AgentId, EditableAssignment> {
  const byAgent = new Map(profile.assignments.map((assignment) => [assignment.agentId, assignment]));
  const homesByAgent = new Map(agentHomes.map((home) => [home.agentId, home.defaultPath]));

  return Object.fromEntries(agents.map((agent) => {
    const assignment = byAgent.get(agent.agentId);
    const defaultHomePath = homesByAgent.get(agent.agentId) ?? "";
    const editable: EditableAssignment = {
      connectionId: readAvailableConnectionId(agent, assignment?.connectionId),
      homeInput: assignment?.homePath === null
        ? defaultHomePath
        : assignment?.homePath ?? "",
    };
    return [agent.agentId, editable];
  })) as Record<AgentId, EditableAssignment>;
}

export function buildEditableAssignmentsFromCurrentState(
  agents: DesktopAgentState[],
  agentHomes: DesktopAdvancedState["agentHomes"],
): Record<AgentId, EditableAssignment> {
  const homesByAgent = new Map(agentHomes.map((home) => [home.agentId, home.path]));

  return Object.fromEntries(agents.map((agent) => {
    const editable: EditableAssignment = {
      connectionId: readAvailableConnectionId(agent, agent.currentConnection?.id),
      homeInput: homesByAgent.get(agent.agentId) ?? "",
    };
    return [agent.agentId, editable];
  })) as Record<AgentId, EditableAssignment>;
}

export function buildCurrentAssignments(
  agents: DesktopAgentState[],
  agentHomes: DesktopAdvancedState["agentHomes"],
  defaultHomesByAgent: Map<AgentId, string>,
): WorkspaceProfileAssignment[] {
  const homesByAgent = new Map(agentHomes.map((home) => [home.agentId, home.path]));

  return agents.flatMap((agent) => {
    const assignment: WorkspaceProfileAssignment = { agentId: agent.agentId };
    if (agent.currentConnection?.id) {
      assignment.connectionId = agent.currentConnection.id;
    }

    const normalizedHome = normalizeHomeInput(homesByAgent.get(agent.agentId) ?? "", defaultHomesByAgent.get(agent.agentId) ?? "");
    if (normalizedHome !== undefined) {
      assignment.homePath = normalizedHome;
    }

    if (!assignment.connectionId && assignment.homePath === undefined) {
      return [];
    }

    return [assignment];
  });
}

export function normalizeAssignments(
  editableAssignments: Record<AgentId, EditableAssignment>,
  agents: DesktopAgentState[],
  defaultHomesByAgent: Map<AgentId, string>,
): WorkspaceProfileAssignment[] {
  return agents.flatMap((agent) => {
    const editable = editableAssignments[agent.agentId];
    if (!editable) {
      return [];
    }

    const assignment: WorkspaceProfileAssignment = { agentId: agent.agentId };
    const connectionId = readAvailableConnectionId(agent, editable.connectionId);
    if (connectionId) {
      assignment.connectionId = connectionId;
    }

    const normalizedHome = normalizeHomeInput(editable.homeInput, defaultHomesByAgent.get(agent.agentId) ?? "");
    if (normalizedHome !== undefined) {
      assignment.homePath = normalizedHome;
    }

    if (!assignment.connectionId && assignment.homePath === undefined) {
      return [];
    }

    return [assignment];
  });
}

export function normalizeSavedAssignments(
  assignments: WorkspaceProfileAssignment[],
  agents: DesktopAgentState[],
  defaultHomesByAgent: Map<AgentId, string>,
): WorkspaceProfileAssignment[] {
  const assignmentsByAgent = new Map(assignments.map((assignment) => [assignment.agentId, assignment]));

  return agents.flatMap((agent) => {
    const assignment = assignmentsByAgent.get(agent.agentId);
    if (!assignment) {
      return [];
    }

    const normalized: WorkspaceProfileAssignment = { agentId: agent.agentId };
    if (assignment.connectionId?.trim()) {
      normalized.connectionId = assignment.connectionId.trim();
    }

    const homeInput = assignment.homePath === null ? defaultHomesByAgent.get(agent.agentId) ?? "" : assignment.homePath ?? "";
    const normalizedHome = normalizeHomeInput(homeInput, defaultHomesByAgent.get(agent.agentId) ?? "");
    if (normalizedHome !== undefined) {
      normalized.homePath = normalizedHome;
    }

    if (!normalized.connectionId && normalized.homePath === undefined) {
      return [];
    }

    return [normalized];
  });
}

export function areAssignmentsEqual(left: WorkspaceProfileAssignment[], right: WorkspaceProfileAssignment[]): boolean {
  if (left.length !== right.length) {
    return false;
  }

  return left.every((assignment, index) => {
    const other = right[index];
    return (
      assignment.agentId === other?.agentId &&
      assignment.connectionId === other.connectionId &&
      assignment.homePath === other.homePath
    );
  });
}

function normalizeHomeInput(input: string, defaultHomePath: string): string | null | undefined {
  const trimmed = input.trim();
  if (!trimmed) {
    return undefined;
  }
  if (trimmed === defaultHomePath.trim()) {
    return null;
  }
  return trimmed;
}
