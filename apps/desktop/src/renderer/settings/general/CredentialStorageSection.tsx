import type { Translator } from "../../shared/I18n";
import { SettingsSection } from "./Section";
import type { CredentialStorageBackend } from "@nile/core/services/credential";
import { Alert, AlertDescription } from "../../ui/alert";

type CredentialStorageSectionProps = {
  credentialStorageMode: CredentialStorageBackend | null;
  isLocked: boolean;
  isMixed: boolean;
  t: Translator;
};

export function CredentialStorageSection({
  credentialStorageMode,
  isLocked,
  isMixed,
  t,
}: CredentialStorageSectionProps) {
  return (
    <SettingsSection
      title={t("settings.credentialStorage.title")}
      description={t("settings.credentialStorage.description")}
    >
      {isMixed ? (
        <Alert variant="destructive">
          <AlertDescription>{t("settings.credentialStorage.mixedDescription")}</AlertDescription>
        </Alert>
      ) : null}
      <div className="rounded-xl border px-4 py-3 text-sm text-foreground">
        {isMixed
          ? t("settings.credentialStorage.mixedTitle")
          : credentialStorageMode === null && !isLocked
          ? t("settings.credentialStorage.placeholder")
          : credentialStorageMode === "encrypted_local_storage"
            ? t("addConnection.storage.encrypted.title")
            : t("addConnection.storage.system.title")}
      </div>
    </SettingsSection>
  );
}
