import { Alert, AlertDescription, AlertTitle } from "../../ui/alert";
import { Button } from "../../ui/button";

export function LoadingShell({ label }: { label: string }) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="rounded-lg border bg-card px-6 py-5 text-sm text-muted-foreground shadow-sm">
        {label}
      </div>
    </div>
  );
}

export function ErrorShell({
  description,
  isResetting,
  resetLabel,
  retryLabel,
  title,
  onReset,
  onRetry,
}: {
  description: string;
  isResetting: boolean;
  resetLabel: string;
  retryLabel: string;
  title: string;
  onReset(): void;
  onRetry(): void;
}) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="w-full max-w-lg rounded-xl border bg-card p-5 shadow-sm">
        <Alert variant="destructive">
          <AlertTitle>{title}</AlertTitle>
          <AlertDescription>{description}</AlertDescription>
        </Alert>
        <div className="mt-4 flex justify-end gap-3">
          <Button variant="outline" disabled={isResetting} onClick={onReset}>
            {isResetting ? `${resetLabel}...` : resetLabel}
          </Button>
          <Button onClick={onRetry}>{retryLabel}</Button>
        </div>
      </div>
    </div>
  );
}
