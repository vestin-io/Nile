import type { GeminiCredentialBackendSnapshot } from "./types";

export const GEMINI_BACKEND_HISTORY_TARGET = "state://gemini/credential-backend";

export class GeminiHistoryTargets {
  static toTrackedEntry(snapshot: GeminiCredentialBackendSnapshot) {
    return {
      path: GEMINI_BACKEND_HISTORY_TARGET,
      content: JSON.stringify(snapshot),
      existedBefore: snapshot.keychain !== null || snapshot.file !== null,
      isSensitive: true,
    } as const;
  }

  static fromTrackedContent(content: string | null): GeminiCredentialBackendSnapshot {
    if (!content?.trim()) {
      return {
        keychain: null,
        file: null,
      };
    }

    const parsed = JSON.parse(content) as unknown;
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
      throw new Error("Gemini history snapshot must contain a JSON object");
    }

    const record = parsed as Record<string, unknown>;
    return {
      keychain: typeof record.keychain === "string" ? record.keychain : null,
      file: typeof record.file === "string" ? record.file : null,
    };
  }

  static isTrackedPath(path: string): boolean {
    return path === GEMINI_BACKEND_HISTORY_TARGET;
  }
}
