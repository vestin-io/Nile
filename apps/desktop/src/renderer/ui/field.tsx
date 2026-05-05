import type { HTMLAttributes, ReactNode } from "react";

import { cn } from "./cn";

type FieldProps = HTMLAttributes<HTMLDivElement> & {
  label: string;
  value?: ReactNode;
};

export function Field({
  className,
  label,
  value,
  children,
  ...props
}: FieldProps) {
  return (
    <div className={cn("space-y-1", className)} {...props}>
      <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{label}</div>
      {children ?? <div className="text-sm">{value}</div>}
    </div>
  );
}

export function FieldCard({
  className,
  ...props
}: FieldProps) {
  return <Field className={cn("rounded-xl border bg-background p-4", className)} {...props} />;
}
