import { NileLogger } from "@nile/core/services/NileLogger";

import type { DesktopNotificationTarget } from "./contracts";
import { MacNotificationCenter } from "./Center";
import { DesktopNotificationHistory } from "./History";
import type { DesktopNotificationIntent } from "./Types";

type DesktopNotificationCenter = Pick<MacNotificationCenter, "show">;

type DesktopNotificationServiceOptions = {
  center: DesktopNotificationCenter;
  history?: Pick<DesktopNotificationHistory, "recordClicked" | "recordShown">;
  isMuted(): boolean;
  logger: NileLogger;
  now?: () => number;
  notifyHistoryChanged?(): void;
  openTarget(target: DesktopNotificationTarget): void;
};

export class DesktopNotificationService {
  private readonly lastShownAtByKey = new Map<string, number>();
  private readonly now: () => number;

  constructor(private readonly options: DesktopNotificationServiceOptions) {
    this.now = options.now ?? (() => Date.now());
  }

  notify(intent: DesktopNotificationIntent): boolean {
    if (this.isMuted()) {
      return false;
    }

    if (this.isCoolingDown(intent)) {
      return false;
    }

    const target = intent.target;
    let historyEventId: string | null = null;
    const shown = this.options.center.show(intent, target ? () => {
      if (historyEventId) {
        this.recordClick(historyEventId);
      }
      this.options.openTarget(target);
    } : null);
    if (!shown) {
      this.options.logger.warn("desktop.notification.unsupported", {
        id: intent.id,
        kind: intent.kind,
        scope: intent.scope,
      });
      return false;
    }

    historyEventId = this.recordShownHistory(intent);
    this.recordShown(intent);
    this.notifyHistoryChanged();
    return true;
  }

  private isMuted(): boolean {
    try {
      return this.options.isMuted();
    } catch (error) {
      this.options.logger.warn("desktop.notification.mute_read_failed", {
        error: error instanceof Error ? error.message : String(error),
      });
      return false;
    }
  }

  private isCoolingDown(intent: DesktopNotificationIntent): boolean {
    const cooldownMs = intent.cooldownMs ?? 0;
    if (cooldownMs <= 0) {
      return false;
    }

    const lastShownAt = this.lastShownAtByKey.get(this.readDedupeKey(intent));
    if (lastShownAt === undefined) {
      return false;
    }

    return (this.now() - lastShownAt) < cooldownMs;
  }

  private recordShown(intent: DesktopNotificationIntent): void {
    this.lastShownAtByKey.set(this.readDedupeKey(intent), this.now());
  }

  private recordShownHistory(intent: DesktopNotificationIntent): string | null {
    try {
      return this.options.history?.recordShown(intent) ?? null;
    } catch (error) {
      this.options.logger.warn("desktop.notification.history_record_failed", {
        id: intent.id,
        error: error instanceof Error ? error.message : String(error),
      });
      return null;
    }
  }

  private recordClick(eventId: string): void {
    try {
      this.options.history?.recordClicked(eventId);
      this.notifyHistoryChanged();
    } catch (error) {
      this.options.logger.warn("desktop.notification.history_click_record_failed", {
        eventId,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  private readDedupeKey(intent: DesktopNotificationIntent): string {
    return intent.dedupeKey ?? intent.id;
  }

  private notifyHistoryChanged(): void {
    this.options.notifyHistoryChanged?.();
  }
}
