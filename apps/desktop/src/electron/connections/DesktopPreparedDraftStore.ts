import { randomUUID } from "node:crypto";

import type { ConnectionOnboardingSuggestion } from "@nile/core/models/connection";
import type { StoredCredential } from "@nile/core/services/credential";

import type { DesktopAddConnectionInput } from "./contracts";

export type PreparedConnectionDraftRecord = {
  authMode: DesktopAddConnectionInput["authMode"];
  credential: StoredCredential;
  credentialStorageBackend?: DesktopAddConnectionInput["credentialStorageBackend"];
  encryptedLocalPassphrase?: string;
  endpointUrl?: string;
  expiresAt: number;
  onboarding: ConnectionOnboardingSuggestion;
  preset: DesktopAddConnectionInput["preset"];
  timeout: ReturnType<typeof setTimeout>;
};

type DesktopPreparedDraftStoreOptions = {
  maxPreparedDrafts: number;
  preparedDraftTtlMs: number;
};

export class DesktopPreparedDraftStore {
  private readonly drafts = new Map<string, PreparedConnectionDraftRecord>();

  constructor(private readonly options: DesktopPreparedDraftStoreOptions) {}

  save(input: Omit<PreparedConnectionDraftRecord, "expiresAt" | "timeout">): string {
    this.purgeExpired();
    this.evictForCapacity();

    const id = randomUUID();
    this.drafts.set(id, {
      ...input,
      expiresAt: Date.now() + this.options.preparedDraftTtlMs,
      timeout: this.scheduleExpiry(id),
    });
    return id;
  }

  read(draftId: string): PreparedConnectionDraftRecord | null {
    this.purgeExpired();
    return this.drafts.get(draftId) ?? null;
  }

  discard(draftId: string): void {
    const draft = this.drafts.get(draftId);
    if (!draft) {
      return;
    }
    clearTimeout(draft.timeout);
    this.drafts.delete(draftId);
  }

  clear(): void {
    for (const draftId of this.drafts.keys()) {
      this.discard(draftId);
    }
  }

  private purgeExpired(): void {
    const now = Date.now();
    for (const [draftId, draft] of this.drafts.entries()) {
      if (draft.expiresAt <= now) {
        this.discard(draftId);
      }
    }
  }

  private evictForCapacity(): void {
    while (this.drafts.size >= this.options.maxPreparedDrafts) {
      const oldestDraftId = this.drafts.keys().next().value;
      if (!oldestDraftId) {
        return;
      }
      this.discard(oldestDraftId);
    }
  }

  private scheduleExpiry(draftId: string): ReturnType<typeof setTimeout> {
    return setTimeout(() => {
      this.discard(draftId);
    }, this.options.preparedDraftTtlMs);
  }
}
