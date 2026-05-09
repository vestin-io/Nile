import { useMemo, useState } from "react";

import type { DesktopAdvancedState, DesktopAgentState } from "../../state/Types";
import { DetailActionGroup } from "../shared/DetailActionGroup";
import type { Translator } from "../shared/I18n";
import { ProfileMetaEditor } from "./MetaEditor";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "../ui/breadcrumb";
import type { WorkspaceProfileAssignment } from "./useProfiles";
import {
  buildEditableAssignmentsFromCurrentState,
  normalizeAssignments,
  ProfileAssignmentsEditor,
} from "./Editor";

type CreateProfilePageProps = {
  agentHomes: DesktopAdvancedState["agentHomes"];
  agents: DesktopAgentState[];
  existingProfileNames: string[];
  t: Translator;
  onBack(): void;
  onCreateProfile(name: string, emoji: string, assignments: WorkspaceProfileAssignment[]): Promise<string>;
  onOpenProfile(profileId: string): void;
};

export function CreateProfilePage({
  agentHomes,
  agents,
  existingProfileNames,
  t,
  onBack,
  onCreateProfile,
  onOpenProfile,
}: CreateProfilePageProps) {
  const [profileName, setProfileName] = useState("");
  const [profileEmoji, setProfileEmoji] = useState("");
  const [editableAssignments, setEditableAssignments] = useState(() => buildEditableAssignmentsFromCurrentState(agents, agentHomes));
  const [createError, setCreateError] = useState<string | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const defaultHomesByAgent = useMemo(
    () => new Map(agentHomes.map((home) => [home.agentId, home.defaultPath])),
    [agentHomes],
  );
  const normalizedAssignments = useMemo(
    () => normalizeAssignments(editableAssignments, agents, defaultHomesByAgent),
    [editableAssignments, agents, defaultHomesByAgent],
  );
  const normalizedName = profileName.trim();
  const duplicateName = normalizedName
    ? existingProfileNames.some((name) => normalizeComparableName(name) === normalizeComparableName(normalizedName))
    : false;
  const duplicateError = duplicateName ? t("profiles.duplicateName") : null;
  const titleLabel = normalizedName || t("profiles.createTitle");
  const actionError = duplicateError ?? createError;

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
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div className="space-y-2">
            <h1 className="text-2xl font-semibold tracking-tight">{titleLabel}</h1>
            <p className="text-sm text-muted-foreground">{t("profiles.createDescription")}</p>
          </div>
          <DetailActionGroup
            items={[
              {
                disabled: isCreating || !normalizedName || duplicateName,
                label: isCreating ? t("profiles.creating") : t("common.save"),
                onClick: () => {
                  if (!normalizedName || isCreating || duplicateName) {
                    return;
                  }
                  setCreateError(null);
                  setIsCreating(true);
                  void onCreateProfile(normalizedName, profileEmoji, normalizedAssignments)
                    .then((profileId) => {
                      onOpenProfile(profileId);
                    })
                    .catch((error) => {
                      setCreateError(describeProfileActionError(error, t));
                    })
                    .finally(() => {
                      setIsCreating(false);
                    });
                },
              },
            ]}
          />
        </div>
      </div>

      <div className="px-1">
        <ProfileMetaEditor
          disabled={isCreating}
          emoji={profileEmoji}
          error={actionError}
          name={profileName}
          t={t}
          onEmojiChange={setProfileEmoji}
          onNameChange={(name) => {
            setProfileName(name);
            setCreateError(null);
          }}
        />
      </div>

      <ProfileAssignmentsEditor
        agentHomes={agentHomes}
        agents={agents}
        disabled={isCreating}
        editableAssignments={editableAssignments}
        t={t}
        onChange={(agentId, nextEditable) => {
          setEditableAssignments((current) => ({
            ...current,
            [agentId]: nextEditable,
          }));
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
