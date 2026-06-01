import type { Translator } from "../../shared/I18n";
import type { SettingsState } from "../../shared/DesktopData";
import { formatAgentsList } from "../../shared/AgentSelection";
import { AgentIconStack } from "../../agents/AgentIconStack";
import { ConnectionUsageCell } from "../UsageCell";
import { readProviderLabel } from "../ProviderDisplay";
import { Card, CardContent } from "../../ui/card";
import { Checkbox } from "../../ui/checkbox";
import { Field } from "../../ui/field";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "../../ui/table";

type ConnectionTableProps = {
  connections: SettingsState["connections"];
  selectedConnectionIds: string[];
  t: Translator;
  onOpenDetails(connectionId: string): void;
  onSelectedConnectionIdsChange(connectionIds: string[]): void;
};

export function ConnectionTable({
  connections,
  selectedConnectionIds,
  t,
  onOpenDetails,
  onSelectedConnectionIdsChange,
}: ConnectionTableProps) {
  const selectedIds = new Set(selectedConnectionIds);
  const allSelected = connections.length > 0 && connections.every((connection) => selectedIds.has(connection.id));

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
              <div className="flex items-start justify-between gap-3">
                <div className="flex min-w-0 items-center gap-3">
                  <Checkbox
                    checked={selectedIds.has(connection.id)}
                    onCheckedChange={(checked) => {
                      onSelectedConnectionIdsChange(toggleConnectionSelection(
                        selectedConnectionIds,
                        connection.id,
                        checked === true,
                      ));
                    }}
                    onClick={(event) => event.stopPropagation()}
                  />
                  <div className="min-w-0 font-medium">{connection.label}</div>
                </div>
                <AgentIconStack agentIds={connection.selectedByAgents} t={t} />
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
              <TableHead className="w-[52px]">
                <Checkbox
                  checked={allSelected}
                  onCheckedChange={(checked) => {
                    onSelectedConnectionIdsChange(checked === true ? connections.map((connection) => connection.id) : []);
                  }}
                  aria-label="Select all connections"
                />
              </TableHead>
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
                  <Checkbox
                    checked={selectedIds.has(connection.id)}
                    onCheckedChange={(checked) => {
                      onSelectedConnectionIdsChange(toggleConnectionSelection(
                        selectedConnectionIds,
                        connection.id,
                        checked === true,
                      ));
                    }}
                    onClick={(event) => event.stopPropagation()}
                    aria-label={connection.label}
                  />
                </TableCell>
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

function toggleConnectionSelection(
  selectedConnectionIds: string[],
  connectionId: string,
  selected: boolean,
): string[] {
  const selectedIds = new Set(selectedConnectionIds);
  if (selected) {
    selectedIds.add(connectionId);
  } else {
    selectedIds.delete(connectionId);
  }
  return [...selectedIds];
}
