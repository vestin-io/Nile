import { useMemo, useState } from "react";
import { RefreshCw } from "lucide-react";

import type { Translator } from "../../shared/I18n";
import {
  prioritizeDetectedModels,
  readCatalogModels,
  useConnectionModelCatalog,
} from "../../shared/ConnectionModels";
import { Button } from "../../ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "../../ui/dialog";
import { Skeleton } from "../../ui/skeleton";
import { TextButton } from "../../ui/text-button";

type ConnectionModelCatalogSectionProps = {
  connectionId: string;
  t: Translator;
};

const PREVIEW_MODEL_COUNT = 5;

export function ConnectionModelCatalogSection({
  connectionId,
  t,
}: ConnectionModelCatalogSectionProps) {
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const {
    catalog,
    isLoading,
    isRefreshing,
    loadCatalog,
  } = useConnectionModelCatalog({
    connectionId,
    enabled: true,
  });
  const models = useMemo(
    () => readCatalogModels(catalog),
    [catalog],
  );
  const orderedModels = useMemo(
    () => prioritizeDetectedModels(models, ""),
    [models],
  );
  const previewModels = useMemo(
    () => orderedModels.slice(0, PREVIEW_MODEL_COUNT),
    [orderedModels],
  );
  const hasOverflow = orderedModels.length > previewModels.length;

  return (
    <>
      <section className="flex h-full flex-col rounded-xl border bg-background p-4">
        <div className="flex items-center justify-between gap-3">
          <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            {t("connections.models.title")}
          </div>
          <Button
            aria-label={t("common.refresh")}
            className="h-8 w-8 px-0"
            disabled={isLoading || isRefreshing}
            size="sm"
            variant="outline"
            onClick={() => {
              void loadCatalog(true);
            }}
          >
            <RefreshCw
              className={[
                "h-4 w-4 transition-transform",
                isLoading || isRefreshing ? "animate-spin" : "",
              ].filter(Boolean).join(" ")}
            />
          </Button>
        </div>

        <div className="mt-4 flex-1">
          {isLoading && !catalog ? (
            <div className="space-y-2">
              <Skeleton className="h-4 w-5/6" />
              <Skeleton className="h-4 w-4/6" />
              <Skeleton className="h-4 w-3/6" />
            </div>
          ) : catalog?.status === "available" && models.length > 0 ? (
            <div className="text-sm leading-7 text-foreground/90">
              {previewModels.map((model, index) => (
                <span key={model}>
                  {index > 0 ? ", " : ""}
                  {model}
                </span>
              ))}
              {hasOverflow ? (
                <>
                  {", "}
                  <TextButton
                    className="inline h-auto px-0 py-0 align-baseline"
                    underline
                    onClick={() => {
                      setIsDialogOpen(true);
                    }}
                  >
                    ...{t("common.more")}
                  </TextButton>
                </>
              ) : null}
            </div>
          ) : (
            <div className="text-sm text-muted-foreground">
              {catalog?.message?.trim() || t("common.unknown")}
            </div>
          )}
        </div>
      </section>

      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="max-w-2xl rounded-2xl p-7">
          <DialogHeader className="space-y-2">
            <DialogTitle>{t("connections.models.dialogTitle")}</DialogTitle>
            <DialogDescription>{t("connections.models.dialogDescription")}</DialogDescription>
          </DialogHeader>
          <div className="max-h-[60vh] overflow-y-auto">
            <div className="flex flex-wrap gap-2">
              {orderedModels.map((model) => (
                <span
                  key={model}
                  className="rounded-md border bg-secondary/40 px-3 py-2 text-sm text-foreground/90"
                >
                  {model}
                </span>
              ))}
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
