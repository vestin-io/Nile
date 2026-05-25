import type { DesktopAppBridge } from "./app/contracts";
import type { DesktopConnectionBridge } from "./connections/contracts";
import type { DesktopProfileBridge } from "./profiles/contracts";
import type {
  DesktopNotificationBridge,
  DesktopPreferencesBridge,
  DesktopProfileFeatureBridge,
  DesktopSettingsDataBridge,
  DesktopStatusEntryBridge,
} from "./state/contracts";
import type { DesktopUpdateBridge } from "./updates/contracts";

export type DesktopBridge = {
  app: DesktopAppBridge;
  connections: DesktopConnectionBridge;
  notifications: DesktopNotificationBridge;
  preferences: DesktopPreferencesBridge;
  profiles: DesktopProfileBridge;
  profileFeatures: DesktopProfileFeatureBridge;
  settingsData: DesktopSettingsDataBridge;
  statusEntry: DesktopStatusEntryBridge;
  updates: DesktopUpdateBridge;
};
