import { useEffect, useState } from "react";
import { LoaderCircle } from "lucide-react";

import type { DesktopAgentState, DesktopConnection } from "../../../state/Types";
import type { Translator } from "../../shared/I18n";
import { ConnectionQuotaSection } from "../../connections/ConnectionQuotaSection";
import { ConnectionsToolbar } from "../../connections/ConnectionsToolbar";
import { authModeLabel, formatUsageText } from "../../shared/DisplayText";
import { UsageIndicator } from "../../shared/UsageIndicator";
import { Alert, AlertDescription } from "../../ui/alert";
import { Button } from "../../ui/button";
import { Card, CardContent } from "../../ui/card";
import { Field } from "../../ui/field";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "../../ui/table";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "../../ui/tooltip";

type AgentConnectionsSectionProps = {
  agent: DesktopAgentState;
  t: Translator;
  onOpenAddPage(agentId: DesktopAgentState["agentId"]): void;
  onOpenConnection(connectionId: string): void;
  onRefresh(): Promise<void>;
  onSwitch(agentId: DesktopAgentState["agentId"], connectionId: string): Promise<void>;
};

export function AgentConnectionsSection({
  agent,
  t,
  onOpenAddPage,
  onOpenConnection,
  onRefresh,
  onSwitch,
}: AgentConnectionsSectionProps) {
  const [switchingConnectionId, setSwitchingConnectionId] = useState<string | null>(null);
  const [recentlyActivatedConnectionId, setRecentlyActivatedConnectionId] = useState<string | null>(null);

  useEffect(() => {
    if (!recentlyActivatedConnectionId) {
      return;
    }

    const timeoutId = window.setTimeout(() => {
      setRecentlyActivatedConnectionId(null);
    }, 1600);
    return () => window.clearTimeout(timeoutId);
  }, [recentlyActivatedConnectionId]);

  const handleSwitch = async (connectionId: string) => {
    if (switchingConnectionId) {
      return;
    }

    setSwitchingConnectionId(connectionId);
    try {
      await onSwitch(agent.agentId, connectionId);
      setRecentlyActivatedConnectionId(connectionId);
    } finally {
      setSwitchingConnectionId(null);
    }
  };

  return (
    <div className="space-y-4">
      <ConnectionsToolbar
        t={t}
        showSearchAndFilter={false}
        onOpenAddPage={() => onOpenAddPage(agent.agentId)}
        onRefresh={onRefresh}
      />
      {agent.connections.length === 0 ? (
        <Alert>
          <AlertDescription>{t("agents.emptyConnections", { agent: agent.agentLabel })}</AlertDescription>
        </Alert>
      ) : (
        <AgentConnectionsList
          agent={agent}
          recentlyActivatedConnectionId={recentlyActivatedConnectionId}
          switchingConnectionId={switchingConnectionId}
          t={t}
          onOpenConnection={onOpenConnection}
          onSwitch={handleSwitch}
        />
      )}
    </div>
  );
}

function AgentConnectionsList({
  agent,
  recentlyActivatedConnectionId,
  switchingConnectionId,
  t,
  onOpenConnection,
  onSwitch,
}: {
  agent: DesktopAgentState;
  recentlyActivatedConnectionId: string | null;
  switchingConnectionId: string | null;
  t: Translator;
  onOpenConnection(connectionId: string): void;
  onSwitch(connectionId: string): Promise<void>;
}) {
  const actionButtonClassName = "min-w-[88px]";

  return (
    <>
      <div className="space-y-3 lg:hidden">
        {agent.connections.map((connection) => (
          <Card
            key={connection.id}
            className={[
              "cursor-pointer rounded-xl transition-colors hover:bg-accent/30",
              recentlyActivatedConnectionId === connection.id
                ? "border-emerald-400/60 bg-emerald-500/10 shadow-[0_0_0_1px_rgba(74,222,128,0.22)] animate-pulse"
                : "",
            ].filter(Boolean).join(" ")}
            onClick={() => onOpenConnection(connection.id)}
          >
            <CardContent className="space-y-4 p-4">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0 space-y-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <UsageIndicator
                      remainingPercent={readUsageRemainingPercent(connection)}
                      showPercent={false}
                    />
                    <div className="font-medium">{connection.label}</div>
                  </div>
                </div>
                <ConnectionSwitchButton
                  actionButtonClassName={actionButtonClassName}
                  connection={connection}
                  switchingConnectionId={switchingConnectionId}
                  t={t}
                  onClick={(event) => {
                    event.stopPropagation();
                    void onSwitch(connection.id);
                  }}
                />
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                <Field label={t("common.usage")} value={formatUsageText(connection, t)} />
                <Field label={t("common.auth")} value={authModeLabel(connection.authMode, t)} />
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="hidden overflow-hidden rounded-2xl border bg-background lg:block">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{t("common.name")}</TableHead>
              <TableHead>{t("common.auth")}</TableHead>
              <TableHead>{t("common.usage")}</TableHead>
              <TableHead className="w-[88px] text-right" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {agent.connections.map((connection) => (
              <TableRow
                key={connection.id}
                className={[
                  "cursor-pointer align-top transition-colors hover:bg-accent/30",
                  recentlyActivatedConnectionId === connection.id
                    ? "bg-emerald-500/10 shadow-[inset_0_0_0_1px_rgba(74,222,128,0.22)] animate-pulse"
                    : "",
                ].filter(Boolean).join(" ")}
                onClick={() => onOpenConnection(connection.id)}
              >
                <TableCell>
                  <div className="space-y-2">
                    <div className="flex flex-wrap items-center gap-2">
                      <UsageIndicator
                        remainingPercent={readUsageRemainingPercent(connection)}
                        showPercent={false}
                      />
                      <span className="font-medium">{connection.label}</span>
                    </div>
                  </div>
                </TableCell>
                <TableCell>{authModeLabel(connection.authMode, t)}</TableCell>
                <TableCell>
                  <ConnectionUsageCell connection={connection} t={t} />
                </TableCell>
                <TableCell className="text-right">
                  <ConnectionSwitchButton
                    actionButtonClassName={actionButtonClassName}
                    connection={connection}
                    switchingConnectionId={switchingConnectionId}
                    t={t}
                    onClick={(event) => {
                      event.stopPropagation();
                      void onSwitch(connection.id);
                    }}
                  />
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </>
  );
}

function ConnectionSwitchButton({
  actionButtonClassName,
  connection,
  switchingConnectionId,
  t,
  onClick,
}: {
  actionButtonClassName: string;
  connection: DesktopConnection;
  switchingConnectionId: string | null;
  t: Translator;
  onClick(event: React.MouseEvent<HTMLButtonElement>): void;
}) {
  if (connection.isCurrent) {
    return (
      <Button
        size="sm"
        variant="outline"
        className={actionButtonClassName}
        disabled
        onClick={(event) => event.stopPropagation()}
      >
        {t("common.inUse")}
      </Button>
    );
  }

  return (
    <Button
      size="sm"
      className={actionButtonClassName}
      disabled={switchingConnectionId !== null}
      onClick={onClick}
    >
      {switchingConnectionId === connection.id ? (
        <>
          <LoaderCircle className="h-4 w-4 animate-spin" />
          {t("common.switching")}
        </>
      ) : (
        t("common.switch")
      )}
    </Button>
  );
}

function readUsageRemainingPercent(connection: DesktopConnection): number | null {
  if (connection.usage?.status !== "available") {
    return null;
  }

  return connection.usage.remainingPercent;
}

function ConnectionUsageCell({
  connection,
  t,
}: {
  connection: DesktopConnection;
  t: Translator;
}) {
  const summary = formatUsageText(connection, t);
  const hasQuotaDetail = connection.usage?.status === "available" && connection.usage.windows.length > 0;

  if (!hasQuotaDetail) {
    return summary;
  }

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <button
            type="button"
            className="text-left text-sm text-foreground/90 underline decoration-dotted underline-offset-4 transition-colors hover:text-foreground"
          >
            {summary}
          </button>
        </TooltipTrigger>
        <TooltipContent align="start" className="max-w-80 border-0 bg-transparent p-0 shadow-none">
          <ConnectionQuotaSection
            className="w-80 shadow-md"
            connection={connection}
            framed
            maxWindows={3}
            showPlanLabel
            t={t}
            title={t("common.usage")}
          />
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
