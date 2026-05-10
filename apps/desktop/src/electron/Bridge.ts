import type { DesktopAppBridge } from "./app/contracts";
import type { DesktopConnectionBridge } from "./connections/contracts";
import type { DesktopProfileBridge } from "./profiles/contracts";
import type { DesktopStateBridge } from "./state/contracts";
import type { DesktopUpdateBridge } from "./updates/contracts";

export type DesktopBridge = {
  app: DesktopAppBridge;
  connections: DesktopConnectionBridge;
  profiles: DesktopProfileBridge;
  state: DesktopStateBridge;
  updates: DesktopUpdateBridge;
};
