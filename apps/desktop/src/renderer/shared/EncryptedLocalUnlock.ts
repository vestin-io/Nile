import type { DesktopUnlockEncryptedLocalStorageResult } from "../../electron/connections/contracts";
import type { Translator } from "./I18n";

export function readEncryptedLocalUnlockErrorMessage(
  result: DesktopUnlockEncryptedLocalStorageResult,
  t: Translator,
): string | null {
  if (result.ok) {
    return null;
  }
  switch (result.code) {
    case "locked":
      return t("dialog.encryptedLocalUnlock.errorLocked");
    case "passphrase_or_corrupted":
      return t("dialog.encryptedLocalUnlock.errorPassphraseOrCorrupted");
    case "corrupted":
      return t("dialog.encryptedLocalUnlock.errorCorrupted");
    case "unavailable":
      return t("dialog.encryptedLocalUnlock.errorUnavailable");
    case "unknown":
    default:
      return t("dialog.encryptedLocalUnlock.errorUnknown");
  }
}
