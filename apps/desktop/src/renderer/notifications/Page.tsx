import { useMemo } from "react";
import { ArrowUpRight, Bell, BellRing, CheckCheck, RefreshCw } from "lucide-react";

import type { DesktopConnection, DesktopNotificationHistoryConnection, DesktopNotificationHistoryEntry } from "../../state/Types";
import type { DesktopNotificationTarget } from "../../electron/notifications/contracts";
import type { Translator } from "../shared/I18n";
import type { NotificationHistoryFilter } from "../app/settings/useNavigation";
import { Button } from "../ui/button";
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "../ui/empty";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "../ui/table";
import { Tabs, TabsList, TabsTrigger } from "../ui/tabs";
import { DetailActionGroup } from "../shared/DetailActionGroup";

type NotificationsPageProps = {
  connections: DesktopConnection[];
  entries: DesktopNotificationHistoryEntry[];
  filter: NotificationHistoryFilter;
  historyConnections: DesktopNotificationHistoryConnection[];
  isLoading: boolean;
  isMarkingAllRead: boolean;
  t: Translator;
  onFilterChange(filter: NotificationHistoryFilter): void;
  onMarkRead(entryIds: string[]): Promise<void>;
  onMarkAllRead(filter: NotificationHistoryFilter): Promise<void>;
  onOpenEntry(target: DesktopNotificationTarget): void;
  onRefresh(): Promise<void>;
};

export function NotificationsPage({
  connections,
  entries,
  filter,
  historyConnections,
  isLoading,
  isMarkingAllRead,
  t,
  onFilterChange,
  onMarkRead,
  onMarkAllRead,
  onOpenEntry,
  onRefresh,
}: NotificationsPageProps) {
  const connectionOptions = useMemo(() => {
    const labels = new Map(connections.map((connection) => [connection.id, connection.label]));
    for (const item of historyConnections) {
      if (!labels.has(item.connectionId)) {
        labels.set(item.connectionId, item.label);
      }
    }
    if (filter.connectionId && !labels.has(filter.connectionId)) {
      labels.set(filter.connectionId, filter.connectionId);
    }
    return [...labels.entries()]
      .map(([id, label]) => ({ id, label }))
      .sort((left, right) => left.label.localeCompare(right.label));
  }, [connections, filter.connectionId, historyConnections]);

  const hasFilters = filter.kind !== "all" || filter.connectionId !== null;

  return (
    <div className="space-y-4">
      <div className="space-y-1">
        <h1 className="text-3xl font-semibold tracking-tight">{t("notifications.title")}</h1>
        <p className="text-sm text-muted-foreground">{t("notifications.description")}</p>
      </div>

      <div className="overflow-hidden rounded-2xl border bg-background">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b px-4 py-4">
          <div className="flex flex-wrap items-center gap-2">
            <Tabs
              value={filter.kind}
              onValueChange={(value) => {
                onFilterChange({
                  ...filter,
                  kind: value === "alerts" ? "alerts" : "all",
                });
              }}
            >
              <TabsList>
                <TabsTrigger value="all">{t("notifications.filter.all")}</TabsTrigger>
                <TabsTrigger value="alerts">{t("notifications.filter.alerts")}</TabsTrigger>
              </TabsList>
            </Tabs>
            <Select
              value={filter.connectionId ?? "all"}
              onValueChange={(value) => {
                onFilterChange({
                  ...filter,
                  connectionId: value === "all" ? null : value,
                });
              }}
            >
              <SelectTrigger className="w-[180px] sm:w-[220px]">
                <SelectValue placeholder={t("notifications.filter.connection")} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{t("notifications.filter.allConnections")}</SelectItem>
                {connectionOptions.map((option) => (
                  <SelectItem key={option.id} value={option.id}>{option.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            {hasFilters ? (
              <Button
                variant="ghost"
                onClick={() => {
                  onFilterChange({ connectionId: null, kind: "all" });
                }}
              >
                {t("notifications.clearFilters")}
              </Button>
            ) : null}
          </div>
          <div className="flex items-center gap-2">
            <DetailActionGroup
              items={[
                {
                  disabled:
                    entries.length === 0
                    || isMarkingAllRead,
                  icon: <CheckCheck className="h-4 w-4" />,
                  label: t("notifications.markAllRead"),
                  onClick: () => {
                    void onMarkAllRead(filter);
                  },
                },
                {
                  icon: <RefreshCw className="h-4 w-4" />,
                  label: t("common.refresh"),
                  onClick: () => {
                    void onRefresh();
                  },
                },
              ]}
            />
          </div>
        </div>

        {isLoading && entries.length === 0 ? (
          <div className="px-6 py-10">
            <Empty className="items-center">
              <EmptyHeader>
                <EmptyMedia variant="icon">
                  <Bell className="h-6 w-6 text-muted-foreground" />
                </EmptyMedia>
                <EmptyTitle>{t("common.loading")}</EmptyTitle>
              </EmptyHeader>
            </Empty>
          </div>
        ) : entries.length === 0 ? (
          <div className="px-6 py-10">
            <Empty className="items-center">
              <EmptyHeader>
                <EmptyMedia variant="icon">
                  <BellRing className="h-6 w-6 text-muted-foreground" />
                </EmptyMedia>
                <EmptyTitle>{t("notifications.emptyTitle")}</EmptyTitle>
                <EmptyDescription>{t("notifications.emptyDescription")}</EmptyDescription>
              </EmptyHeader>
              {hasFilters ? (
                <EmptyContent className="items-center">
                  <Button
                    variant="secondary"
                    onClick={() => {
                      onFilterChange({ connectionId: null, kind: "all" });
                    }}
                  >
                    {t("notifications.clearFilters")}
                  </Button>
                </EmptyContent>
              ) : null}
            </Empty>
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t("notifications.notificationColumn")}</TableHead>
                <TableHead>{t("notifications.timeColumn")}</TableHead>
                <TableHead>{t("notifications.typeColumn")}</TableHead>
                <TableHead className="w-[1%] whitespace-nowrap text-right">{t("common.actions")}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {entries.map((entry) => {
                const target = readNotificationTarget(entry);
                const isUnread = entry.readAt === null;
                return (
                  <TableRow
                    key={entry.id}
                    className="cursor-pointer"
                    onClick={() => {
                      void onMarkRead([entry.id]);
                    }}
                  >
                    <TableCell>
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <span
                            aria-hidden="true"
                            className={isUnread
                              ? "h-2 w-2 shrink-0 rounded-full bg-foreground"
                              : "h-2 w-2 shrink-0 rounded-full bg-transparent"}
                          />
                          <span className="font-medium">{entry.title}</span>
                        </div>
                        <div className="pl-4 text-sm text-muted-foreground">{entry.body}</div>
                      </div>
                    </TableCell>
                    <TableCell className="whitespace-nowrap text-sm text-muted-foreground">
                      {formatTimestamp(entry.shownAt)}
                    </TableCell>
                    <TableCell>
                      <span className="text-sm text-muted-foreground">{readTypeLabel(entry, t)}</span>
                    </TableCell>
                    <TableCell className="w-[1%] whitespace-nowrap text-right">
                      {target ? (
                        <Button
                          aria-label={t("notifications.open")}
                          className="h-9 w-9 px-0"
                          size="sm"
                          variant="ghost"
                          onClick={(event) => {
                            event.stopPropagation();
                            void handleEntryOpen(entry.id, target, onMarkRead, onOpenEntry);
                          }}
                        >
                          <ArrowUpRight className="h-4 w-4" />
                        </Button>
                      ) : null}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        )}
      </div>
    </div>
  );
}

function readTypeLabel(entry: DesktopNotificationHistoryEntry, t: Translator): string {
  switch (entry.kind) {
    case "usage-threshold":
    case "usage-renewed":
      return t("common.alerts");
    case "profile-rule-suggestion":
      return t("page.profiles");
    case "action-required":
      switch (entry.scope) {
        case "agent":
          return t("page.agents");
        case "profile":
          return t("page.profiles");
        case "connection":
          return t("page.connections");
      }
  }
}

async function handleEntryOpen(
  entryId: string,
  target: DesktopNotificationTarget | null,
  onMarkRead: (entryIds: string[]) => Promise<void>,
  onOpenEntry: (target: DesktopNotificationTarget) => void,
): Promise<void> {
  await onMarkRead([entryId]);
  if (target) {
    onOpenEntry(target);
  }
}

function readNotificationTarget(entry: DesktopNotificationHistoryEntry): DesktopNotificationTarget | null {
  switch (entry.targetPage) {
    case "settings":
      return { page: "settings" };
    case "profiles":
      return { page: "profiles", profileId: entry.targetProfileId ?? undefined };
    case "connections":
      return {
        page: "connections",
        connectionId: entry.targetConnectionId ?? undefined,
        agentId: entry.targetAgentId ?? undefined,
      };
    case "agents":
      return { page: "agents", agentId: entry.targetAgentId ?? undefined };
    case "notifications":
      return { page: "notifications", connectionId: entry.targetConnectionId ?? undefined, kind: "all" };
    default:
      return null;
  }
}

function formatTimestamp(value: string): string {
  const date = new Date(value);
  return new Intl.DateTimeFormat(undefined, {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(date);
}
