import { useEffect, useState } from "react";
import { Layers3, Workflow } from "lucide-react";

import type { AgentId } from "@nile/core/models/agent/types";

import type { DesktopAdvancedState, DesktopAgentState } from "../../state/Types";
import { CreateProfilePage } from "./Create";
import { ProfileDetailPage } from "./Detail";
import { Alert, AlertDescription, AlertTitle } from "../ui/alert";
import { Button } from "../ui/button";
import { Card } from "../ui/card";
import { cn } from "../ui/cn";
import { Empty, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "../ui/empty";
import { TextButton } from "../ui/text-button";
import { readCurrentProfileIds } from "../../profiles/CurrentProfile";
import type { Translator } from "../shared/I18n";
import type { WorkspaceProfile, WorkspaceProfileAssignment } from "./useProfiles";

type ProfilesPageProps = {
  agentHomes: DesktopAdvancedState["agentHomes"];
  agents: DesktopAgentState[];
  isAvailable: boolean;
  profileError: string | null;
  profiles: WorkspaceProfile[];
  selectedProfileId: string | null;
  t: Translator;
  onBackFromDetail(): void;
  onApplyProfile(profileId: string): Promise<void>;
  onCreateProfile(name: string, emoji: string, assignments: WorkspaceProfileAssignment[]): Promise<string>;
  onDeleteProfile(profileId: string): Promise<void>;
  onOpenProfile(profileId: string): void;
  onSaveProfile(
    profileId: string,
    name: string,
    emoji: string,
    assignments: WorkspaceProfile["assignments"],
  ): Promise<void>;
};

export function ProfilesPage({
  agentHomes,
  agents,
  isAvailable,
  profileError,
  profiles,
  selectedProfileId,
  t,
  onBackFromDetail,
  onApplyProfile,
  onCreateProfile,
  onDeleteProfile,
  onOpenProfile,
  onSaveProfile,
}: ProfilesPageProps) {
  const [isCreatePageOpen, setIsCreatePageOpen] = useState(false);
  const [applyingProfileId, setApplyingProfileId] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [pendingSelectedProfileId, setPendingSelectedProfileId] = useState<string | null>(null);
  const agentLabels = new Map(agents.map((agent) => [agent.agentId, agent.agentLabel]));
  const connectionsByAgent = new Map(
    agents.map((agent) => [agent.agentId, new Map(agent.connections.map((connection) => [connection.id, connection.label]))]),
  );
  const selectedProfile = profiles.find((profile) => profile.id === selectedProfileId) ?? null;
  const currentProfileIds = readCurrentProfileIds(profiles, agents, agentHomes);

  useEffect(() => {
    if (selectedProfile && pendingSelectedProfileId === selectedProfile.id) {
      setPendingSelectedProfileId(null);
    }
  }, [pendingSelectedProfileId, selectedProfile]);

  useEffect(() => {
    if (!selectedProfileId) {
      setPendingSelectedProfileId(null);
      return;
    }
    if (!selectedProfile && selectedProfileId !== pendingSelectedProfileId) {
      onBackFromDetail();
    }
  }, [onBackFromDetail, pendingSelectedProfileId, selectedProfile, selectedProfileId]);

  if (selectedProfile) {
    return (
      <ProfileDetailPage
        agentHomes={agentHomes}
        agents={agents}
        existingProfileNames={profiles.filter((entry) => entry.id !== selectedProfile.id).map((entry) => entry.name)}
        isApplying={applyingProfileId === selectedProfile.id}
        isCurrent={currentProfileIds.has(selectedProfile.id)}
        profile={selectedProfile}
        t={t}
        onApplyProfile={async (profileId) => {
          setActionError(null);
          setApplyingProfileId(profileId);
          try {
            await onApplyProfile(profileId);
          } catch (error) {
            setActionError(describeProfileActionError(error));
          } finally {
            setApplyingProfileId(null);
          }
        }}
        onBack={onBackFromDetail}
        onDeleteProfile={onDeleteProfile}
        onSaveProfile={onSaveProfile}
      />
    );
  }

  if (isCreatePageOpen) {
    return (
      <CreateProfilePage
        agentHomes={agentHomes}
        agents={agents}
        existingProfileNames={profiles.map((profile) => profile.name)}
        t={t}
        onBack={() => setIsCreatePageOpen(false)}
        onCreateProfile={onCreateProfile}
        onOpenProfile={(profileId) => {
          setPendingSelectedProfileId(profileId);
          setIsCreatePageOpen(false);
          onOpenProfile(profileId);
        }}
      />
    );
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex flex-col gap-2">
          <h1 className="text-3xl font-semibold tracking-tight">{t("profiles.title")}</h1>
          <p className="max-w-3xl text-sm text-muted-foreground">{t("profiles.description")}</p>
        </div>
        {isAvailable ? (
          <div className="flex items-start">
            <Button onClick={() => setIsCreatePageOpen(true)}>
              {t("profiles.createAction")}
            </Button>
          </div>
        ) : null}
      </div>

      {profileError ? (
        <Alert variant="destructive">
          <AlertTitle>{t("common.configurationError")}</AlertTitle>
          <AlertDescription>{profileError}</AlertDescription>
        </Alert>
      ) : null}
      {actionError ? (
        <Alert variant="destructive">
          <AlertTitle>{t("common.configurationError")}</AlertTitle>
          <AlertDescription>{actionError}</AlertDescription>
        </Alert>
      ) : null}

      {!isAvailable ? (
        <Empty className="rounded-xl border bg-card p-8">
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <Layers3 className="h-6 w-6 text-muted-foreground" />
            </EmptyMedia>
            <EmptyTitle>{t("profiles.unavailableTitle")}</EmptyTitle>
            <EmptyDescription>{t("profiles.unavailableDescription")}</EmptyDescription>
          </EmptyHeader>
        </Empty>
      ) : null}

      <div className="grid gap-4">
        {profiles.length === 0 ? (
          <Empty className="rounded-xl border bg-card p-8">
            <EmptyHeader>
              <EmptyTitle>{t("profiles.emptyTitle")}</EmptyTitle>
              <EmptyDescription>{t("profiles.emptyDescription")}</EmptyDescription>
            </EmptyHeader>
          </Empty>
        ) : profiles.map((profile) => (
          <ProfileCard
            key={profile.id}
            agentLabels={agentLabels}
            connectionsByAgent={connectionsByAgent}
            isApplying={applyingProfileId === profile.id}
            isCurrent={currentProfileIds.has(profile.id)}
            profile={profile}
            t={t}
            onApplyProfile={async (profileId) => {
              setActionError(null);
              setApplyingProfileId(profileId);
              try {
                await onApplyProfile(profileId);
              } catch (error) {
                setActionError(describeProfileActionError(error));
              } finally {
                setApplyingProfileId(null);
              }
            }}
            onOpenProfile={onOpenProfile}
          />
        ))}
      </div>
    </div>
  );
}

type ProfileCardProps = {
  agentLabels: Map<AgentId, string>;
  connectionsByAgent: Map<AgentId, Map<string, string>>;
  isApplying: boolean;
  isCurrent: boolean;
  profile: WorkspaceProfile;
  t: Translator;
  onApplyProfile(profileId: string): Promise<void>;
  onOpenProfile(profileId: string): void;
};

function ProfileCard({
  agentLabels,
  connectionsByAgent,
  isApplying,
  isCurrent,
  profile,
  t,
  onApplyProfile,
  onOpenProfile,
}: ProfileCardProps) {
  return (
    <Card
      className={cn(
        "rounded-2xl transition-colors",
        isCurrent && "border-foreground/20 bg-muted/30 shadow-md",
      )}
    >
      <div className="px-5 py-5 sm:px-6">
        <div className="flex items-stretch justify-between gap-6">
          <div className="min-w-0 flex-1 space-y-5">
            <div className="flex min-w-0 items-start gap-3">
              <div
                className={cn(
                  "flex h-12 w-12 items-center justify-center rounded-xl border bg-muted/40",
                  isCurrent && "border-foreground/15 bg-background shadow-sm",
                )}
              >
                {profile.emoji?.trim()
                  ? <span className="text-3xl leading-none">{profile.emoji.trim()}</span>
                  : <Workflow className="h-6 w-6 text-muted-foreground" />}
              </div>
              <div className="min-w-0 space-y-1 pt-1">
                <div className="flex min-w-0 items-center gap-2">
                  <div className="truncate text-lg font-semibold text-foreground">{profile.name}</div>
                  {isCurrent ? (
                    <span className="shrink-0 rounded-full border border-foreground/10 bg-background px-2.5 py-1 text-xs font-medium text-foreground shadow-sm">
                      {t("common.current")}
                    </span>
                  ) : null}
                </div>
              </div>
            </div>

            <div className="space-y-3">
              {profile.assignments.length === 0 ? (
                <p className="text-sm text-muted-foreground">{t("profiles.noAssignments")}</p>
              ) : (
                <div className="grid gap-2 text-sm">
                  {profile.assignments.map((assignment) => {
                    const connectionLabel = assignment.connectionId
                      ? connectionsByAgent.get(assignment.agentId)?.get(assignment.connectionId) ?? t("profiles.missingConnection")
                      : t("profiles.missingConnection");
                    const isMissingConnection = !assignment.connectionId;
                    return (
                      <div key={assignment.agentId} className="grid gap-3 sm:grid-cols-[8rem_minmax(0,1fr)]">
                        <span className="font-medium text-foreground">{agentLabels.get(assignment.agentId) ?? assignment.agentId}</span>
                        <span
                          className={`truncate ${isMissingConnection
                            ? "text-amber-600 dark:text-amber-300"
                            : "text-muted-foreground"}`}
                        >
                          {connectionLabel}
                        </span>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>

          <div className="flex min-w-[96px] flex-col items-end justify-between gap-4">
            <TextButton underline onClick={() => onOpenProfile(profile.id)}>
              {t("common.more")}
            </TextButton>
            {!isCurrent ? (
              <Button
                size="sm"
                variant="outline"
                disabled={isApplying}
                onClick={() => void onApplyProfile(profile.id)}
              >
                {isApplying ? t("profiles.applying") : t("profiles.applyAction")}
              </Button>
            ) : null}
          </div>
        </div>
      </div>
    </Card>
  );
}

function describeProfileActionError(error: unknown): string {
  if (error instanceof Error && error.message.trim()) {
    return error.message.replace(/^Error invoking remote method '[^']+':\s*/, "");
  }
  return String(error);
}
