import type { Translator } from "../../shared/I18n";
import type { SettingsState } from "../../shared/DesktopData";
import { formatAgentsList } from "../../shared/AgentSelection";
import { AgentIconStack } from "../../agents/AgentIconStack";
import { ConnectionUsageCell } from "../UsageCell";
import { readProviderLabel } from "../ProviderDisplay";
import { Card, CardContent } from "../../ui/card";
import { Field } from "../../ui/field";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "../../ui/table";

type ConnectionTableProps = {
  connections: SettingsState["connections"];
  t: Translator;
  onOpenDetails(connectionId: string): void;
};

export function ConnectionTable({
  connections,
  t,
  onOpenDetails,
}: ConnectionTableProps) {
  return (
    <>
      <div className="space-y-3 lg:hidden">
        {connections.map((connection) => (
          <Card
            key={connection.id}
            className="cursor-pointer rounded-xl transition-colors hover:bg-accent/30"
            onClick={() => onOpenDetails(connection.id)}
          >
            <CardContent className="space-y-4 p-4">
              <div className="min-w-0 space-y-1">
                <div className="flex items-center gap-3">
                  <AgentIconStack agentIds={connection.selectedByAgents} t={t} />
                  <div className="font-medium">{connection.label}</div>
                </div>
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                <Field label={t("common.provider")} value={readProviderLabel(connection.endpointFamily, t)} />
                <Field label={t("common.usage")} value={<ConnectionUsageCell connection={connection} t={t} />} />
                <Field label={t("common.alerts")} value={readAlertCountValue(connection.activeAlertCount)} />
                <Field
                  label={t("common.capability")}
                  value={connection.configurableAgents.length === 0 ? t("common.none") : formatAgentsList(connection.configurableAgents, t)}
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
              <TableHead className="w-[84px]" />
              <TableHead>{t("common.name")}</TableHead>
              <TableHead>{t("common.provider")}</TableHead>
              <TableHead>{t("common.usage")}</TableHead>
              <TableHead>{t("common.capability")}</TableHead>
              <TableHead>{t("common.alerts")}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {connections.map((connection) => (
              <TableRow
                key={connection.id}
                className="cursor-pointer"
                onClick={() => onOpenDetails(connection.id)}
              >
                <TableCell>
                  <AgentIconStack agentIds={connection.selectedByAgents} t={t} />
                </TableCell>
                <TableCell className="font-medium">{connection.label}</TableCell>
                <TableCell>{readProviderLabel(connection.endpointFamily, t)}</TableCell>
                <TableCell><ConnectionUsageCell connection={connection} t={t} /></TableCell>
                <TableCell>{connection.configurableAgents.length === 0 ? t("common.none") : formatAgentsList(connection.configurableAgents, t)}</TableCell>
                <TableCell>{readAlertCountValue(connection.activeAlertCount)}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </>
  );
}

function readAlertCountValue(activeAlertCount: number): string {
  return activeAlertCount > 0 ? String(activeAlertCount) : "";
}
