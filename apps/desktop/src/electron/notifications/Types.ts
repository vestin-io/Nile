import type { DesktopNotificationTarget } from "./contracts";

export type DesktopNotificationScope = "connection" | "agent" | "profile";
export type DesktopNotificationKind =
  | "action-required"
  | "profile-rule-suggestion"
  | "usage-threshold"
  | "usage-renewed";

export type DesktopNotificationSubject = {
  id?: string;
  label?: string;
};

export type DesktopNotificationIntent = {
  id: string;
  title: string;
  body: string;
  kind: DesktopNotificationKind;
  scope: DesktopNotificationScope;
  resetAt?: string | null;
  subject?: DesktopNotificationSubject;
  target?: DesktopNotificationTarget;
  dedupeKey?: string;
  cooldownMs?: number;
  silent?: boolean;
};
