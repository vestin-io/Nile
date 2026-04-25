import type { CursorLiveCredentialSnapshot } from "./types";

export const CURSOR_ACCESS_TOKEN_HISTORY_TARGET = "keychain://cursor/access-token";
export const CURSOR_REFRESH_TOKEN_HISTORY_TARGET = "keychain://cursor/refresh-token";
export const CURSOR_API_KEY_HISTORY_TARGET = "keychain://cursor/api-key";

export class CursorHistoryTargets {
  static toTrackedEntries(snapshot: CursorLiveCredentialSnapshot) {
    return [
      {
        path: CURSOR_ACCESS_TOKEN_HISTORY_TARGET,
        content: snapshot.accessToken,
        existedBefore: snapshot.accessToken !== null,
        isSensitive: true,
      },
      {
        path: CURSOR_REFRESH_TOKEN_HISTORY_TARGET,
        content: snapshot.refreshToken,
        existedBefore: snapshot.refreshToken !== null,
        isSensitive: true,
      },
      {
        path: CURSOR_API_KEY_HISTORY_TARGET,
        content: snapshot.apiKey,
        existedBefore: snapshot.apiKey !== null,
        isSensitive: true,
      },
    ] as const;
  }

  static fromTrackedValues(
    values: Array<{ path: string; content: string | null }>,
  ): CursorLiveCredentialSnapshot {
    const snapshot: CursorLiveCredentialSnapshot = {
      accessToken: null,
      refreshToken: null,
      apiKey: null,
    };

    for (const value of values) {
      if (value.path === CURSOR_ACCESS_TOKEN_HISTORY_TARGET) {
        snapshot.accessToken = value.content;
        continue;
      }
      if (value.path === CURSOR_REFRESH_TOKEN_HISTORY_TARGET) {
        snapshot.refreshToken = value.content;
        continue;
      }
      if (value.path === CURSOR_API_KEY_HISTORY_TARGET) {
        snapshot.apiKey = value.content;
      }
    }

    return snapshot;
  }

  static isTrackedCredentialPath(path: string): boolean {
    return path === CURSOR_ACCESS_TOKEN_HISTORY_TARGET ||
      path === CURSOR_REFRESH_TOKEN_HISTORY_TARGET ||
      path === CURSOR_API_KEY_HISTORY_TARGET;
  }
}
