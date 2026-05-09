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

  useEffect(() => {
    setProfileName(profile.name);
    setProfileEmoji(profile.emoji ?? "");
    setEditableAssignments(buildEditableAssignmentsFromProfile(profile, agents, agentHomes));
    setIsRemoveDialogOpen(false);
    setSaveError(null);
  }, [profile.id]);

  const normalizedAssignments = useMemo(
    () => normalizeAssignments(editableAssignments, agents, defaultHomesByAgent),
    [agents, defaultHomesByAgent, editableAssignments],
  );
  const savedAssignments = useMemo(
    () => normalizeAssignments(buildEditableAssignmentsFromProfile(profile, agents, agentHomes), agents, defaultHomesByAgent),
    [agentHomes, agents, defaultHomesByAgent, profile],
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
        <div className="flex justify-end">
          <DetailActionGroup
            items={[
              {
                disabled: isApplying || isSaving || isDeleting || isCurrent,
                label: isApplying ? t("profiles.applying") : (isCurrent ? t("common.current") : t("profiles.applyAction")),
                onClick: () => {
                  if (isApplying || isSaving || isDeleting || isCurrent) {
                    return;
                  }
                  void onApplyProfile(profile.id);
                },
              },
              {
                disabled: !isDirty || isSaving || isDeleting || duplicateName || !normalizedName,
                label: isSaving ? t("profiles.saving") : t("common.save"),
                onClick: () => {
                  if (!isDirty || isSaving || isDeleting || duplicateName || !normalizedName) {
                    return;
                  }
                  setSaveError(null);
                  setIsSaving(true);
                  void onSaveProfile(profile.id, normalizedName, profileEmoji, normalizedAssignments)
                    .catch((error) => {
                      setSaveError(describeProfileActionError(error, t));
                    })
                    .finally(() => {
                      setIsSaving(false);
                    });
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
          onEmojiChange={setProfileEmoji}
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
          setEditableAssignments((current) => ({
            ...current,
            [agentId]: nextEditable,
          }));
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
