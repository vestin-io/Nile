import { LoaderCircle } from "lucide-react";

import type { DesktopAgentState, DesktopConnection } from "../../../state/Types";
import type { Translator } from "../../shared/I18n";
import { ConnectionUsageCell } from "../../connections/UsageCell";
import { authModeLabel } from "../../shared/DisplayText";
import { UsageIndicator } from "../../shared/UsageIndicator";
import { Button } from "../../ui/button";
import { Card, CardContent } from "../../ui/card";
import { Field } from "../../ui/field";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "../../ui/table";
import { TextButton } from "../../ui/text-button";
import { useConnectionQuotaMetricPreferences } from "../../shared/useConnectionQuotaMetricPreferences";
import { resolveDesktopUsageSummary } from "../../../state/UsageSummary";

type AgentConnectionsListProps = {
  agent: DesktopAgentState;
  recentlyActivatedConnectionId: string | null;
  switchingConnectionId: string | null;
  t: Translator;
  onOpenConnection(connectionId: string): void;
  onOpenModelEditor(connection: DesktopConnection): void;
  onSwitch(connectionId: string): Promise<void>;
};

export function AgentConnectionsList({
  agent,
  recentlyActivatedConnectionId,
  switchingConnectionId,
  t,
  onOpenConnection,
  onOpenModelEditor,
  onSwitch,
}: AgentConnectionsListProps) {
  const actionButtonClassName = "min-w-[88px]";
  const quotaMetricPreferences = useConnectionQuotaMetricPreferences();

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
                      remainingPercent={readUsageRemainingPercent(
                        connection,
                        quotaMetricPreferences.readPreference(connection.id),
                      )}
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
                <Field label={t("common.usage")} value={<ConnectionUsageCell connection={connection} t={t} />} />
                <Field label={t("common.auth")} value={authModeLabel(connection.authMode, t)} />
                <Field
                  label={t("common.selectedModel")}
                  value={
                    <ModelEditButton
                      connection={connection}
                      t={t}
                      onClick={() => onOpenModelEditor(connection)}
                    />
                  }
                />
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
              <TableHead>{t("common.selectedModel")}</TableHead>
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
                        remainingPercent={readUsageRemainingPercent(
                          connection,
                          quotaMetricPreferences.readPreference(connection.id),
                        )}
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
                <TableCell>
                  <ModelEditButton
                    connection={connection}
                    t={t}
                    onClick={() => onOpenModelEditor(connection)}
                  />
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

function ModelEditButton({
  connection,
  t,
  onClick,
}: {
  connection: DesktopConnection;
  t: Translator;
  onClick(): void;
}) {
  return (
    <TextButton
      className="justify-start"
      tone={connection.agentModelId ? "default" : "muted"}
      underline
      onClick={(event) => {
        event.stopPropagation();
        onClick();
      }}
    >
      {readModelText(connection, t)}
    </TextButton>
  );
}

function readUsageRemainingPercent(
  connection: DesktopConnection,
  preferredMetricKey: string | null,
): number | null {
  if (connection.usage?.status !== "available") {
    return null;
  }

  return resolveDesktopUsageSummary(connection.usage, preferredMetricKey)?.remainingPercent ?? connection.usage.remainingPercent;
}

function readModelText(connection: DesktopConnection, t: Translator): string {
  return connection.agentModelId?.trim() || t("common.notSet");
}
