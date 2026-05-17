import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";

import { GeminiAccountsStore } from "./AccountsStore";

const tempDirs: string[] = [];

describe("GeminiAccountsStore", () => {
  afterEach(() => {
    while (tempDirs.length > 0) {
      rmSync(tempDirs.pop()!, { recursive: true, force: true });
    }
  });

  it("reads active and old accounts", () => {
    const store = new GeminiAccountsStore(createGeminiHome());

    store.writeState({
      active: "jay@example.com",
      old: ["q@example.com"],
    });

    expect(store.readState()).toEqual({
      active: "jay@example.com",
      old: ["q@example.com"],
    });
  });

  it("moves the previous active account into old when switching", () => {
    const store = new GeminiAccountsStore(createGeminiHome());

    store.writeState({
      active: "q@example.com",
      old: ["older@example.com"],
    });

    store.applyActive("jay@example.com");

    expect(store.readState()).toEqual({
      active: "jay@example.com",
      old: ["q@example.com", "older@example.com"],
    });
  });

  it("deduplicates the old list when promoting a previous account", () => {
    const store = new GeminiAccountsStore(createGeminiHome());

    store.writeState({
      active: "q@example.com",
      old: ["jay@example.com", "older@example.com"],
    });

    store.applyActive("jay@example.com");

    expect(store.readState()).toEqual({
      active: "jay@example.com",
      old: ["q@example.com", "older@example.com"],
    });
  });
});

function createGeminiHome(): string {
  const dir = mkdtempSync(join(tmpdir(), "nile-gemini-accounts-store-"));
  tempDirs.push(dir);
  return join(dir, ".gemini");
}
