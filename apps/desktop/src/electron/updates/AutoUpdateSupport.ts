import type { ILogger } from "update-electron-app";

import type {
  DesktopReleaseStatus,
  DesktopUpdateAvailability,
} from "../../state/Types";
import type { NileLogger } from "@nile/core/services/NileLogger";

type AutoUpdateLogger = Pick<NileLogger, "debug" | "warn">;

const supportedPlatforms = new Set<NodeJS.Platform>(["darwin", "win32"]);

export function readDesktopUpdateAvailability(
  isPackaged: boolean,
  _version: string,
  platform: NodeJS.Platform,
): DesktopUpdateAvailability {
  if (!isPackaged) {
    return "development";
  }

  return supportedPlatforms.has(platform)
    ? "available"
    : "unsupported_platform";
}

export function createAutoUpdaterLogger(logger: AutoUpdateLogger): ILogger {
  return {
    log: (message) => {
      logger.debug("desktop.auto_update.log", { message: toLogMessage(message) });
    },
    info: (message) => {
      logger.debug("desktop.auto_update.info", { message: toLogMessage(message) });
    },
    warn: (message) => {
      logger.warn("desktop.auto_update.warn", { message: toLogMessage(message) });
    },
    error: (message) => {
      logger.warn("desktop.auto_update.error", { message: toLogMessage(message) });
    },
  };
}

export function extractAutoUpdateVersion(releaseName: string, updateURL: string): string | null {
  const fromReleaseName = matchVersion(releaseName);
  if (fromReleaseName) {
    return fromReleaseName;
  }

  return matchVersion(updateURL);
}

export function readNextReleaseStatus(
  availableVersion: string | null,
  statusWhenUnavailable: DesktopReleaseStatus = "idle",
): DesktopReleaseStatus {
  return availableVersion ? "ready" : statusWhenUnavailable;
}

function matchVersion(value: string): string | null {
  const match = value.match(/v?(\d+\.\d+\.\d+(?:[-.][0-9A-Za-z.-]+)?)/);
  return match?.[1] ?? null;
}

function toLogMessage(message: unknown): string {
  if (message instanceof Error) {
    return message.message;
  }

  if (typeof message === "string") {
    return message;
  }

  const serialized = JSON.stringify(message);
  return serialized === undefined ? String(message) : serialized;
}
