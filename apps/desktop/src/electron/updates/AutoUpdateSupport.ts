import type { ILogger } from "update-electron-app";

import type { DesktopUpdateAvailability } from "../../state/Types";
import type { NileLogger } from "@nile/core/services/NileLogger";

type AutoUpdateLogger = Pick<NileLogger, "debug" | "warn">;

const supportedPlatforms = new Set<NodeJS.Platform>(["darwin", "win32"]);
const defaultUpdateHost = "https://update.electronjs.org";

export type ElectronUpdateFeedRelease = {
  version: string;
  name: string;
  url: string;
};

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

export function buildElectronUpdateFeedUrl(
  repo: string,
  currentVersion: string,
  platform: NodeJS.Platform = process.platform,
  arch: string = process.arch,
  host: string = defaultUpdateHost,
): string {
  const formatSegment = platform === "win32" ? "" : "";
  return `${host}/${repo}/${platform}-${arch}${formatSegment}/${currentVersion.trim()}`;
}

export async function fetchElectronUpdateFeedRelease(
  feedUrl: string,
  fetchImpl: typeof fetch = fetch,
): Promise<ElectronUpdateFeedRelease | null> {
  const response = await fetchImpl(feedUrl, {
    headers: {
      "User-Agent": "nile-desktop-update-check",
    },
  });

  if (response.status === 204) {
    return null;
  }

  if (!response.ok) {
    throw new Error(`Update feed request failed with status ${response.status}`);
  }

  const body = await response.text();
  if (!body.trim()) {
    return null;
  }

  const payload = JSON.parse(body) as { name?: string; url?: string };
  const version = extractAutoUpdateVersion(payload.name ?? "", payload.url ?? "");
  if (!version) {
    throw new Error("Update feed response did not include a recognizable version");
  }

  return {
    version,
    name: payload.name ?? `v${version}`,
    url: payload.url ?? "",
  };
}

export function compareReleaseVersions(left: string, right: string): number {
  const leftParts = normalizeReleaseVersion(left);
  const rightParts = normalizeReleaseVersion(right);
  const length = Math.max(leftParts.length, rightParts.length);

  for (let index = 0; index < length; index += 1) {
    const leftValue = leftParts[index] ?? 0;
    const rightValue = rightParts[index] ?? 0;
    if (leftValue > rightValue) {
      return 1;
    }
    if (leftValue < rightValue) {
      return -1;
    }
  }

  return 0;
}

export function isReleaseVersionNewer(candidate: string, current: string): boolean {
  return compareReleaseVersions(candidate, current) > 0;
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

function normalizeReleaseVersion(value: string): number[] {
  return value
    .trim()
    .replace(/^v/i, "")
    .split(/[.-]/)
    .map((part) => Number.parseInt(part, 10))
    .map((part) => (Number.isFinite(part) ? part : 0));
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
