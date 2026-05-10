import type { DesktopNotificationHistoryFilterInput } from "../notifications/contracts";
import { DesktopNotificationHistory } from "../notifications/History";

export class NotificationHistoryState {
  constructor(private readonly history: DesktopNotificationHistory | null) {}

  list(filter?: DesktopNotificationHistoryFilterInput) {
    return this.history ? this.history.list(filter) : [];
  }

  listConnections(filter?: DesktopNotificationHistoryFilterInput) {
    return this.history ? this.history.listConnections(filter) : [];
  }

  hasUnread(): boolean {
    return this.history ? this.history.hasUnread() : false;
  }

  markRead(entryIds: string[]): void {
    this.history?.markRead(entryIds);
  }

  markReadByFilter(filter?: DesktopNotificationHistoryFilterInput): void {
    this.history?.markReadByFilter(filter);
  }
}
