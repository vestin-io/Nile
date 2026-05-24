import { describe, expect, it, vi } from "vitest";

import {
  isEncryptedLocalLockedErrorMessage,
  runWithEncryptedLocalUnlockRetry,
} from "./EncryptedLocalAccess";

describe("runWithEncryptedLocalUnlockRetry", () => {
  it("requests unlock once and retries a locked operation", async () => {
    const requestUnlock = vi.fn(async () => {});
    const operation = vi.fn<() => Promise<string>>()
      .mockRejectedValueOnce(new Error("Error invoking remote method 'x': Encrypted local storage is locked."))
      .mockResolvedValueOnce("ok");

    await expect(runWithEncryptedLocalUnlockRetry(operation, requestUnlock)).resolves.toBe("ok");
    expect(requestUnlock).toHaveBeenCalledTimes(1);
    expect(operation).toHaveBeenCalledTimes(2);
  });

  it("does not request unlock for non-locked errors", async () => {
    const requestUnlock = vi.fn(async () => {});
    const operation = vi.fn(async () => {
      throw new Error("Something else failed");
    });

    await expect(runWithEncryptedLocalUnlockRetry(operation, requestUnlock)).rejects.toThrow("Something else failed");
    expect(requestUnlock).not.toHaveBeenCalled();
    expect(operation).toHaveBeenCalledTimes(1);
  });

  it("normalizes locked-message detection", () => {
    expect(isEncryptedLocalLockedErrorMessage("Encrypted local storage is locked. Try again.")).toBe(true);
    expect(isEncryptedLocalLockedErrorMessage("Other error")).toBe(false);
  });
});
