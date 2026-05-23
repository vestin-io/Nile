import { Check, Database, ShieldCheck } from "lucide-react";

import type { CredentialStorageBackend } from "@nile/core/services/credential";

import { cn } from "../ui/cn";
import { Button } from "../ui/button";
import type { Translator } from "../shared/I18n";

type StorageStepProps = {
  backend: CredentialStorageBackend;
  t: Translator;
  onBackendChange(value: CredentialStorageBackend): void;
  onContinue(): void;
};

const STORAGE_OPTIONS: Array<{
  backend: CredentialStorageBackend;
  icon: typeof ShieldCheck;
}> = [
  {
    backend: "system_secure_storage",
    icon: ShieldCheck,
  },
  {
    backend: "encrypted_local_storage",
    icon: Database,
  },
];

export function QuickSetupStorageStep({
  backend,
  t,
  onBackendChange,
  onContinue,
}: StorageStepProps) {
  return (
    <div className="space-y-6">
      <div className="mx-auto max-w-3xl space-y-3 text-center">
        <div className="text-sm uppercase tracking-[0.24em] text-muted-foreground/80">
          {t("quickSetup.storageStep.eyebrow")}
        </div>
        <h2 className="text-3xl font-semibold tracking-tight text-foreground">
          {t("quickSetup.storageStep.title")}
        </h2>
        <p className="text-base leading-7 text-muted-foreground">
          {t("quickSetup.storageStep.description")}
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        {STORAGE_OPTIONS.map((option, index) => {
          const Icon = option.icon;
          const selected = backend === option.backend;
          const title = option.backend === "system_secure_storage"
            ? t("addConnection.storage.system.title")
            : t("addConnection.storage.encrypted.title");
          const description = option.backend === "system_secure_storage"
            ? t("addConnection.storage.system.description")
            : t("addConnection.storage.encrypted.description");

          return (
            <button
              key={option.backend}
              type="button"
              className={cn(
                "group rounded-[28px] border bg-card p-6 text-left transition-all duration-200",
                "hover:-translate-y-0.5 hover:border-foreground/20 hover:shadow-[0_24px_60px_rgba(0,0,0,0.08)]",
                selected
                  ? "border-foreground/30 bg-accent/35 shadow-[0_28px_70px_rgba(0,0,0,0.14)]"
                  : "border-border/80",
              )}
              style={{ transitionDelay: `${index * 60}ms` }}
              onClick={() => onBackendChange(option.backend)}
            >
              <div className="flex items-start justify-between gap-4">
                <div className="flex h-12 w-12 items-center justify-center rounded-2xl border border-border/70 bg-background/70 text-foreground/85 transition-colors group-hover:border-foreground/15">
                  <Icon className="h-5 w-5" />
                </div>
                <div
                  className={cn(
                    "flex h-8 w-8 items-center justify-center rounded-full border transition-all duration-200",
                    selected
                      ? "border-foreground/20 bg-foreground text-background"
                      : "border-border/80 text-transparent",
                  )}
                >
                  <Check className="h-4 w-4" />
                </div>
              </div>

              <div className="mt-10 space-y-2">
                <div className="text-2xl font-semibold tracking-tight text-foreground">
                  {title}
                </div>
                <div className="text-base leading-7 text-muted-foreground">
                  {description}
                </div>
              </div>
            </button>
          );
        })}
      </div>

      <div className="flex justify-end">
        <Button size="lg" className="rounded-xl px-7" onClick={onContinue}>
          {t("dialog.credentialStorage.continue")}
        </Button>
      </div>
    </div>
  );
}
