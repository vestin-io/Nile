import { readFileSync } from "node:fs";

export function readOptionalTextFile(path: string, label: string): string | null {
  try {
    return readFileSync(path, "utf8");
  } catch (error) {
    if (isMissingPathError(error)) {
      return null;
    }

    throw new Error(`Cannot read ${label} at ${path}: ${readErrorMessage(error)}`);
  }
}

function isMissingPathError(error: unknown): boolean {
  return hasErrorCode(error, "ENOENT") || hasErrorCode(error, "ENOTDIR");
}

function hasErrorCode(error: unknown, code: string): boolean {
  return typeof error === "object"
    && error !== null
    && "code" in error
    && (error as { code?: unknown }).code === code;
}

function readErrorMessage(error: unknown): string {
  if (error instanceof Error && error.message.trim()) {
    return error.message;
  }

  return String(error);
}
