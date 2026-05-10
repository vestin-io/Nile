import { Notification, type NotificationConstructorOptions } from "electron";

import type { DesktopNotificationIntent } from "./Types";

type NotificationHandle = {
  on(event: "click", listener: () => void): void;
  show(): void;
};

type MacNotificationCenterOptions = {
  createNotification(options: NotificationConstructorOptions): NotificationHandle;
  isSupported(): boolean;
  platform: NodeJS.Platform;
};

export class MacNotificationCenter {
  private readonly options: MacNotificationCenterOptions;

  constructor(options?: Partial<MacNotificationCenterOptions>) {
    this.options = {
      createNotification: (notificationOptions) => new Notification(notificationOptions),
      isSupported: () => Notification.isSupported(),
      platform: process.platform,
      ...options,
    };
  }

  canShow(): boolean {
    return this.options.platform === "darwin" && this.options.isSupported();
  }

  show(intent: DesktopNotificationIntent, onClick: (() => void) | null): boolean {
    if (!this.canShow()) {
      return false;
    }

    const notification = this.options.createNotification({
      title: intent.title,
      body: intent.body,
      silent: intent.silent ?? false,
    });
    if (onClick) {
      notification.on("click", onClick);
    }
    notification.show();
    return true;
  }
}
