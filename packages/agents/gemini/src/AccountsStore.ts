import { existsSync, rmSync } from "node:fs";
import { join } from "node:path";

import { readOptionalTextFile } from "@nile/core/services/OptionalTextFile";
import { writePrivateTextFile } from "@nile/core/services/PrivateTextFile";
import type { GeminiGoogleAccountsState } from "./types";

type AccountsDocument = {
  active?: unknown;
  old?: unknown;
};

export class GeminiAccountsStore {
  readonly accountsPath: string;

  constructor(geminiHome: string) {
    this.accountsPath = join(geminiHome, "google_accounts.json");
  }

  snapshot(): string | null {
    if (!existsSync(this.accountsPath)) {
      return null;
    }
    return readOptionalTextFile(this.accountsPath, "Gemini google_accounts.json");
  }

  readState(): GeminiGoogleAccountsState {
    const raw = this.snapshot();
    if (!raw?.trim()) {
      return { active: null, old: [] };
    }

    const parsed = this.parse(raw);
    return {
      active: typeof parsed.active === "string" && parsed.active.trim() ? parsed.active : null,
      old: Array.isArray(parsed.old)
        ? parsed.old.filter((value): value is string => typeof value === "string" && value.trim().length > 0)
        : [],
    };
  }

  applyActive(email: string): void {
    const current = this.readState();
    const old = current.old.filter((value) => value !== email);
    if (current.active && current.active !== email) {
      old.unshift(current.active);
    }

    this.writeState({
      active: email,
      old: [...new Set(old)],
    });
  }

  writeState(state: GeminiGoogleAccountsState): void {
    writePrivateTextFile(
      this.accountsPath,
      `${JSON.stringify({
        active: state.active,
        old: state.old,
      }, null, 2)}\n`,
    );
  }

  restore(snapshot: string | null): void {
    if (snapshot === null) {
      rmSync(this.accountsPath, { force: true });
      return;
    }

    writePrivateTextFile(this.accountsPath, snapshot);
  }

  private parse(raw: string): AccountsDocument {
    const parsed = JSON.parse(raw) as unknown;
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
      throw new Error("Gemini google_accounts.json must contain a JSON object");
    }
    return parsed as AccountsDocument;
  }
}
