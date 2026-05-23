import { useState } from "react";

import type { CredentialStorageBackend } from "@nile/core/services/credential";

import type { Translator } from "../../shared/I18n";
import { SettingsSection } from "./Section";
import { CredentialStorageDialog } from "../../connections/dialogs/CredentialStorage";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../../ui/select";

type CredentialStorageSectionProps = {
  credentialStorageState: Awaited<ReturnType<typeof window.nileDesktop.connections.getCredentialStorageState>>;
  defaultBackend: CredentialStorageBackend | null;
  t: Translator;
  onDefaultBackendChange(backend: CredentialStorageBackend): void;
  onRefreshCredentialStorageState(): Promise<Awaited<ReturnType<typeof window.nileDesktop.connections.getCredentialStorageState>>>;
};

export function CredentialStorageSection({
  credentialStorageState,
  defaultBackend,
  t,
  onDefaultBackendChange,
  onRefreshCredentialStorageState,
}: CredentialStorageSectionProps) {
  const [pendingBackend, setPendingBackend] = useState<CredentialStorageBackend | null>(null);
  const [credentialStorageError, setCredentialStorageError] = useState<string | null>(null);
  const [encryptedLocalPassphrase, setEncryptedLocalPassphrase] = useState("");
  const [encryptedLocalPassphraseConfirmation, setEncryptedLocalPassphraseConfirmation] = useState("");

  const dialogBackend = pendingBackend ?? "system_secure_storage";

  return (
    <>
      <SettingsSection
        title={t("settings.credentialStorage.title")}
        description={t("settings.credentialStorage.description")}
      >
        <Select
          value={defaultBackend ?? undefined}
          onValueChange={(value) => {
            const backend = value as CredentialStorageBackend;
            if (backend === defaultBackend) {
              return;
            }
            if (
              backend === "encrypted_local_storage"
              && !credentialStorageState.encryptedLocalVaultExists
            ) {
              setCredentialStorageError(null);
              setPendingBackend(backend);
              return;
            }
            onDefaultBackendChange(backend);
          }}
        >
          <SelectTrigger>
            <SelectValue placeholder={t("settings.credentialStorage.placeholder")} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="system_secure_storage">
              {t("addConnection.storage.system.title")}
            </SelectItem>
            <SelectItem value="encrypted_local_storage">
              {t("addConnection.storage.encrypted.title")}
            </SelectItem>
          </SelectContent>
        </Select>
      </SettingsSection>

      <CredentialStorageDialog
        backend={dialogBackend}
        errorMessage={credentialStorageError}
        encryptedLocalPassphrase={encryptedLocalPassphrase}
        encryptedLocalPassphraseConfirmation={encryptedLocalPassphraseConfirmation}
        encryptedLocalUnlocked={credentialStorageState.encryptedLocalUnlocked}
        encryptedLocalVaultExists={credentialStorageState.encryptedLocalVaultExists}
        open={pendingBackend !== null}
        t={t}
        onConfirm={() => {
          if (!pendingBackend) {
            return;
          }
          void window.nileDesktop.connections.unlockEncryptedLocalStorage(encryptedLocalPassphrase).then(async () => {
            setCredentialStorageError(null);
            await onRefreshCredentialStorageState();
            onDefaultBackendChange(pendingBackend);
            setPendingBackend(null);
          }).catch((error) => {
            setCredentialStorageError(error instanceof Error ? error.message : String(error));
          });
        }}
        onEncryptedLocalPassphraseChange={(value) => {
          setCredentialStorageError(null);
          setEncryptedLocalPassphrase(value);
        }}
        onEncryptedLocalPassphraseConfirmationChange={(value) => {
          setCredentialStorageError(null);
          setEncryptedLocalPassphraseConfirmation(value);
        }}
        onOpenChange={(open) => {
          if (!open) {
            setCredentialStorageError(null);
            setPendingBackend(null);
          }
        }}
      />
    </>
  );
}
