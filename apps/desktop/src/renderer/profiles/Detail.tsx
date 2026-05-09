import { useEffect, useMemo, useState } from "react";

import type { AgentId } from "@nile/core/models/agent/types";

import type { DesktopAdvancedState, DesktopAgentState } from "../../state/Types";
import { ConfirmDialog } from "../shared/ConfirmDialog";
import type { Translator } from "../shared/I18n";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "../ui/breadcrumb";
import { Button } from "../ui/button";
import { DetailActionGroup } from "../shared/DetailActionGroup";
import { ProfileMetaEditor } from "./MetaEditor";
import type { WorkspaceProfile, WorkspaceProfileAssignment } from "./useProfiles";
import {
  areAssignmentsEqual,
  buildEditableAssignmentsFromProfile,
  normalizeAssignments,
  ProfileAssignmentsEditor,
} from "./Editor";

type ProfileDetailPageProps = {
  agentHomes: DesktopAdvancedState["agentHomes"];
  agents: DesktopAgentState[];
  existingProfileNames: string[];
  isApplying: boolean;
  isCurrent: boolean;
  profile: WorkspaceProfile;
  t: Translator;
  onApplyProfile(profileId: string): Promise<void>;
  onBack(): void;
  onDeleteProfile(profileId: string): Promise<void>;
  onSaveProfile(profileId: string, name: string, emoji: string, assignments: WorkspaceProfileAssignment[]): Promise<void>;
};

export function ProfileDetailPage({
  agentHomes,
  agents,
  existingProfileNames,
  isApplying,
  isCurrent,
  profile,
  t,
  onApplyProfile,
  onBack,
  onDeleteProfile,
  onSaveProfile,
}: ProfileDetailPageProps) {
  const [profileName, setProfileName] = useState(profile.name);
  const [profileEmoji, setProfileEmoji] = useState(profile.emoji ?? "");
  const [editableAssignments, setEditableAssignments] = useState<Record<AgentId, import("./Editor").EditableAssignment>>(
    () => buildEditableAssignmentsFromProfile(profile, agents, agentHomes),
  );
  const [isSaving, setIsSaving] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isRemoveDialogOpen, setIsRemoveDialogOpen] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const defaultHomesByAgent = useMemo(
    () => new Map(agentHomes.map((home) => [home.agentId, home.defaultPath])),
    [agentHomes],
  );
  const savedEditableAssignments = useMemo(
    () => buildEditableAssignmentsFromProfile(profile, agents, agentHomes),
    [agentHomes, agents, profile],
  );

  useEffect(() => {
    setProfileName(profile.name);
    setProfileEmoji(profile.emoji ?? "");
    setEditableAssignments(savedEditableAssignments);
    setIsRemoveDialogOpen(false);
    setSaveError(null);
  }, [profile.id]);

  const normalizedAssignments = useMemo(
    () => normalizeAssignments(editableAssignments, agents, defaultHomesByAgent),
    [agents, defaultHomesByAgent, editableAssignments],
  );
  const savedAssignments = useMemo(
    () => normalizeAssignments(savedEditableAssignments, agents, defaultHomesByAgent),
    [agents, defaultHomesByAgent, savedEditableAssignments],
  );
  const normalizedName = profileName.trim();
  const duplicateName = normalizedName
    ? existingProfileNames.some((name) => normalizeComparableName(name) === normalizeComparableName(normalizedName))
    : false;
  const duplicateError = duplicateName ? t("profiles.duplicateName") : null;
  const titleLabel = normalizedName || profile.name;
  const actionError = duplicateError ?? saveError;
  const isDirty = normalizedName !== profile.name
    || profileEmoji.trim() !== (profile.emoji ?? "")
    || !areAssignmentsEqual(normalizedAssignments, savedAssignments);

  const saveProfile = async (input: {
    assignments: WorkspaceProfileAssignment[];
    emoji: string;
    name: string;
  }): Promise<void> => {
    setSaveError(null);
    setIsSaving(true);
    try {
      await onSaveProfile(profile.id, input.name, input.emoji, input.assignments);
    } catch (error) {
      setSaveError(describeProfileActionError(error, t));
      throw error;
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="space-y-5">
      <div className="space-y-3">
        <Breadcrumb>
          <BreadcrumbList>
            <BreadcrumbItem>
              <BreadcrumbLink
                href="#"
                onClick={(event) => {
                  event.preventDefault();
                  onBack();
                }}
              >
                {t("page.profiles")}
              </BreadcrumbLink>
            </BreadcrumbItem>
            <BreadcrumbSeparator />
            <BreadcrumbItem>
              <BreadcrumbPage>{titleLabel}</BreadcrumbPage>
            </BreadcrumbItem>
          </BreadcrumbList>
        </Breadcrumb>
        <div className="flex items-center justify-end gap-3">
          {isCurrent ? (
            <div className="text-sm text-muted-foreground">{t("common.current")}</div>
          ) : (
            <Button
              disabled={isApplying || isSaving || isDeleting}
              variant="outline"
              onClick={() => {
                if (isApplying || isSaving || isDeleting) {
                  return;
                }
                void onApplyProfile(profile.id);
              }}
            >
              {isApplying ? t("profiles.applying") : t("profiles.applyAction")}
            </Button>
          )}
          <DetailActionGroup
            items={[
              {
                disabled: !isDirty || isSaving || isDeleting || duplicateName || !normalizedName,
                label: isSaving ? t("profiles.saving") : t("common.save"),
                onClick: () => {
                  if (!isDirty || isSaving || isDeleting || duplicateName || !normalizedName) {
                    return;
                  }
                  void saveProfile({
                    name: normalizedName,
                    emoji: profileEmoji,
                    assignments: normalizedAssignments,
                  }).catch(() => {});
                },
              },
              {
                danger: true,
                disabled: isSaving || isDeleting,
                label: t("common.remove"),
                onClick: () => {
                  if (isSaving || isDeleting) {
                    return;
                  }
                  setIsRemoveDialogOpen(true);
                },
              },
            ]}
          />
        </div>
      </div>

      <div className="px-1">
        <ProfileMetaEditor
          disabled={isSaving || isDeleting}
          emoji={profileEmoji}
          error={actionError}
          name={profileName}
          t={t}
          onEmojiChange={(emoji) => {
            setProfileEmoji(emoji);
            void saveProfile({
              name: profile.name,
              emoji,
              assignments: buildConnectionAutosaveAssignments(editableAssignments, savedEditableAssignments, agents, defaultHomesByAgent),
            }).catch(() => {});
          }}
          onNameChange={(name) => {
            setProfileName(name);
            setSaveError(null);
          }}
        />
      </div>

      <ProfileAssignmentsEditor
        agentHomes={agentHomes}
        agents={agents}
        disabled={isSaving || isDeleting}
        editableAssignments={editableAssignments}
        t={t}
        onChange={(agentId, nextEditable) => {
          const nextAssignments = {
            ...editableAssignments,
            [agentId]: nextEditable,
          };
          const previousEditable = editableAssignments[agentId];
          const connectionChanged = previousEditable?.connectionId !== nextEditable.connectionId;
          setEditableAssignments(nextAssignments);
          if (!connectionChanged) {
            return;
          }
          void saveProfile({
            name: profile.name,
            emoji: profileEmoji,
            assignments: buildConnectionAutosaveAssignments(nextAssignments, savedEditableAssignments, agents, defaultHomesByAgent),
          }).catch(() => {});
        }}
      />

      <ConfirmDialog
        confirmLabel={t("common.remove")}
        description={t("profiles.removeDialogDescription", { name: profileName.trim() || profile.name })}
        isConfirming={isDeleting}
        open={isRemoveDialogOpen}
        title={t("profiles.removeDialogTitle")}
        t={t}
        onConfirm={async () => {
          if (isDeleting) {
            return;
          }
          setIsDeleting(true);
          try {
            await onDeleteProfile(profile.id);
            onBack();
          } finally {
            setIsDeleting(false);
          }
        }}
        onOpenChange={(open) => {
          if (isDeleting) {
            return;
          }
          setIsRemoveDialogOpen(open);
        }}
      />
    </div>
  );
}

function normalizeComparableName(name: string): string {
  return name.trim().toLocaleLowerCase();
}

function describeProfileActionError(error: unknown, t: Translator): string {
  const message = error instanceof Error && error.message.trim()
    ? error.message.replace(/^Error invoking remote method '[^']+':\s*/, "")
    : String(error);
  if (message.includes("Workspace profile name already exists")) {
    return t("profiles.duplicateName");
  }
  return message;
}

function buildConnectionAutosaveAssignments(
  editableAssignments: Record<AgentId, import("./Editor").EditableAssignment>,
  savedEditableAssignments: Record<AgentId, import("./Editor").EditableAssignment>,
  agents: DesktopAgentState[],
  defaultHomesByAgent: Map<AgentId, string>,
): WorkspaceProfileAssignment[] {
  const connectionOnlyEditableAssignments = Object.fromEntries(agents.map((agent) => [
    agent.agentId,
    {
      connectionId: editableAssignments[agent.agentId]?.connectionId ?? null,
      homeInput: savedEditableAssignments[agent.agentId]?.homeInput ?? "",
    },
  ])) as Record<AgentId, import("./Editor").EditableAssignment>;
  return normalizeAssignments(connectionOnlyEditableAssignments, agents, defaultHomesByAgent);
}
