import { describe, expect, it, vi } from "vitest";

import { DesktopNotificationService } from "./Service";
import type { DesktopNotificationIntent } from "./Types";

describe("DesktopNotificationService", () => {
  it("opens the related target when the notification is clicked", () => {
    let clickListener: (() => void) | undefined;
    const openTarget = vi.fn();
    const notifyHistoryChanged = vi.fn();
    const history = {
      recordClicked: vi.fn(),
      recordShown: vi.fn(() => "event-1"),
    };
    const service = new DesktopNotificationService({
      center: {
        show: (_intent: DesktopNotificationIntent, onClick: (() => void) | null) => {
          clickListener = onClick ?? undefined;
          return true;
        },
      } as { show(intent: DesktopNotificationIntent, onClick: (() => void) | null): boolean } as never,
      history,
      isMuted: () => false,
      logger: { warn: vi.fn() } as never,
      notifyHistoryChanged,
      openTarget,
    });

    const target = { page: "profiles" as const, profileId: "profile-work" };
    service.notify(createIntent({ target }));
    clickListener?.();

    expect(openTarget).toHaveBeenCalledWith(target);
    expect(history.recordShown).toHaveBeenCalled();
    expect(history.recordClicked).toHaveBeenCalledWith("event-1");
    expect(notifyHistoryChanged).toHaveBeenCalledTimes(2);
  });

  it("suppresses notifications with the same dedupe key until cooldown expires", () => {
    const show = vi.fn<(intent: DesktopNotificationIntent, onClick: (() => void) | null) => boolean>(() => true);
    let now = 1000;
    const service = new DesktopNotificationService({
      center: { show } as never,
      isMuted: () => false,
      logger: { warn: vi.fn() } as never,
      now: () => now,
      openTarget: () => {},
    });

    expect(service.notify(createIntent({ cooldownMs: 60_000, dedupeKey: "profile:work" }))).toBe(true);
    expect(service.notify(createIntent({ cooldownMs: 60_000, dedupeKey: "profile:work" }))).toBe(false);

    now += 60_000;

    expect(service.notify(createIntent({ cooldownMs: 60_000, dedupeKey: "profile:work" }))).toBe(true);
    expect(show).toHaveBeenCalledTimes(2);
  });

  it("warns when macOS notifications are unavailable", () => {
    const warn = vi.fn();
    const service = new DesktopNotificationService({
      center: { show: () => false } as never,
      isMuted: () => false,
      logger: { warn } as never,
      openTarget: () => {},
    });

    expect(service.notify(createIntent())).toBe(false);
    expect(warn).toHaveBeenCalledWith("desktop.notification.unsupported", {
      id: "profile-work",
      kind: "profile-rule-suggestion",
      scope: "profile",
    });
  });

  it("suppresses notifications entirely when muted", () => {
    const show = vi.fn();
    const service = new DesktopNotificationService({
      center: { show } as never,
      isMuted: () => true,
      logger: { warn: vi.fn() } as never,
      openTarget: () => {},
    });

    expect(service.notify(createIntent())).toBe(false);
    expect(show).not.toHaveBeenCalled();
  });

  it("falls back to unmuted behavior when reading the mute state fails", () => {
    const show = vi.fn<(intent: DesktopNotificationIntent, onClick: (() => void) | null) => boolean>(() => true);
    const warn = vi.fn();
    const service = new DesktopNotificationService({
      center: { show } as never,
      isMuted: () => {
        throw new Error("bad mute file");
      },
      logger: { warn } as never,
      openTarget: () => {},
    });

    expect(service.notify(createIntent())).toBe(true);
    expect(show).toHaveBeenCalledTimes(1);
    expect(warn).toHaveBeenCalledWith("desktop.notification.mute_read_failed", {
      error: "bad mute file",
    });
  });

  it("does not write history when macOS notifications are unavailable", () => {
    const history = {
      recordClicked: vi.fn(),
      recordShown: vi.fn(),
    };
    const service = new DesktopNotificationService({
      center: { show: () => false } as never,
      history,
      isMuted: () => false,
      logger: { warn: vi.fn() } as never,
      openTarget: () => {},
    });

    expect(service.notify(createIntent())).toBe(false);
    expect(history.recordShown).not.toHaveBeenCalled();
  });
});

function createIntent(overrides?: Partial<DesktopNotificationIntent>): DesktopNotificationIntent {
  return {
    id: "profile-work",
    title: "Switch to Work profile",
    body: "Open profiles to review this suggestion.",
    kind: "profile-rule-suggestion",
    scope: "profile",
    ...overrides,
  };
}
