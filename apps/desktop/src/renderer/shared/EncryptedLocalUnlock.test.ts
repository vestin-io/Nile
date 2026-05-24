import { describe, expect, it } from "vitest";

import { readEncryptedLocalUnlockErrorMessage } from "./EncryptedLocalUnlock";

const t = (key: string) => key;

describe("readEncryptedLocalUnlockErrorMessage", () => {
  it("maps corrupted vault failures to the corrupted message", () => {
    expect(readEncryptedLocalUnlockErrorMessage({ ok: false, code: "corrupted" }, t)).toBe(
      "dialog.encryptedLocalUnlock.errorCorrupted",
    );
  });

  it("maps generic authentication failures to the passphrase-or-corrupted message", () => {
    expect(readEncryptedLocalUnlockErrorMessage({ ok: false, code: "passphrase_or_corrupted" }, t)).toBe(
      "dialog.encryptedLocalUnlock.errorPassphraseOrCorrupted",
    );
  });

  it("maps unknown failures to a stable generic fallback", () => {
    expect(readEncryptedLocalUnlockErrorMessage({ ok: false, code: "unknown" }, t)).toBe(
      "dialog.encryptedLocalUnlock.errorUnknown",
    );
  });
});
