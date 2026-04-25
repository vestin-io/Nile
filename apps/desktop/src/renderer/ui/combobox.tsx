import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { Check, ChevronDown, Search } from "lucide-react";

import { cn } from "../lib/cn";
import { Button } from "./button";
import { Card } from "./card";
import { Input } from "./input";

export type ComboboxItem<TValue extends string> = {
  value: TValue;
  label: string;
  description?: string;
  icon?: ReactNode;
  keywords?: string[];
};

type ComboboxProps<TValue extends string> = {
  items: ComboboxItem<TValue>[];
  value: TValue | "";
  placeholder: string;
  searchPlaceholder: string;
  emptyLabel: string;
  onValueChange(value: TValue): void;
};

export function Combobox<TValue extends string>({
  items,
  value,
  placeholder,
  searchPlaceholder,
  emptyLabel,
  onValueChange,
}: ComboboxProps<TValue>) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");

  const selectedItem = items.find((item) => item.value === value) ?? null;
  const filteredItems = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    if (!normalizedQuery) {
      return items;
    }

    return items.filter((item) => {
      const haystacks = [
        item.label,
        item.description ?? "",
        ...(item.keywords ?? []),
      ];
      return haystacks.some((haystack) => haystack.toLowerCase().includes(normalizedQuery));
    });
  }, [items, query]);

  useEffect(() => {
    if (!open) {
      setQuery("");
      return;
    }

    const handlePointerDown = (event: PointerEvent) => {
      if (!containerRef.current?.contains(event.target as Node)) {
        setOpen(false);
      }
    };

    window.addEventListener("pointerdown", handlePointerDown);
    return () => window.removeEventListener("pointerdown", handlePointerDown);
  }, [open]);

  return (
    <div ref={containerRef} className="relative">
      <Button
        variant="outline"
        className="h-11 w-full justify-between rounded-xl px-4"
        onClick={() => setOpen((current) => !current)}
      >
        <span className="flex min-w-0 items-center gap-3">
          {selectedItem?.icon ? (
            <span className="flex h-5 w-5 shrink-0 items-center justify-center text-muted-foreground">
              {selectedItem.icon}
            </span>
          ) : null}
          <span className={cn("truncate", !selectedItem && "text-muted-foreground")}>
            {selectedItem?.label ?? placeholder}
          </span>
        </span>
        <ChevronDown className="h-4 w-4 shrink-0 opacity-60" />
      </Button>

      {open ? (
        <Card className="absolute inset-x-0 top-full z-20 mt-2 rounded-xl border bg-popover p-2 shadow-lg">
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              autoFocus
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder={searchPlaceholder}
              className="pl-9"
            />
          </div>

          <div className="mt-2 max-h-72 overflow-y-auto">
            {filteredItems.length === 0 ? (
              <div className="px-3 py-6 text-center text-sm text-muted-foreground">
                {emptyLabel}
              </div>
            ) : (
              <div className="space-y-1">
                {filteredItems.map((item) => {
                  const selected = item.value === value;
                  return (
                    <button
                      key={item.value}
                      type="button"
                      onClick={() => {
                        onValueChange(item.value);
                        setOpen(false);
                      }}
                      className={cn(
                        "flex w-full items-start gap-3 rounded-lg px-3 py-3 text-left transition-colors",
                        selected ? "bg-accent text-accent-foreground" : "hover:bg-accent/60",
                      )}
                    >
                      <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center text-muted-foreground">
                        {item.icon}
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block text-sm font-medium">{item.label}</span>
                        {item.description ? (
                          <span className="mt-0.5 block text-sm text-muted-foreground">
                            {item.description}
                          </span>
                        ) : null}
                      </span>
                      {selected ? <Check className="mt-0.5 h-4 w-4 shrink-0" /> : null}
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        </Card>
      ) : null}
    </div>
  );
}
