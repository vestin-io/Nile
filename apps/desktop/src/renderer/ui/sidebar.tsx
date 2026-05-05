import * as React from "react";
import { PanelLeft } from "lucide-react";

import { cn } from "./cn";
import { Button } from "./button";

type SidebarContextValue = {
  open: boolean;
  setOpen(open: boolean): void;
  toggleSidebar(): void;
};

const SidebarContext = React.createContext<SidebarContextValue | null>(null);

export function useSidebar() {
  const context = React.useContext(SidebarContext);
  if (!context) {
    throw new Error("useSidebar must be used within a SidebarProvider");
  }

  return context;
}

type SidebarProviderProps = React.HTMLAttributes<HTMLDivElement> & {
  open: boolean;
  onOpenChange(open: boolean): void;
};

export function SidebarProvider({
  className,
  open,
  onOpenChange,
  style,
  ...props
}: SidebarProviderProps) {
  const value = React.useMemo<SidebarContextValue>(
    () => ({
      open,
      setOpen: onOpenChange,
      toggleSidebar: () => onOpenChange(!open),
    }),
    [open, onOpenChange],
  );

  return (
    <SidebarContext.Provider value={value}>
      <div
        className={cn("flex h-full w-full overflow-hidden bg-background", className)}
        style={
          {
            "--sidebar-width": "15rem",
            "--sidebar-width-icon": "4.5rem",
            ...style,
          } as React.CSSProperties
        }
        {...props}
      />
    </SidebarContext.Provider>
  );
}

type SidebarProps = React.HTMLAttributes<HTMLElement> & {
  collapsible?: "icon" | "none";
};

export function Sidebar({
  className,
  collapsible = "icon",
  ...props
}: SidebarProps) {
  const { open } = useSidebar();

  return (
    <aside
      data-state={open ? "expanded" : "collapsed"}
      data-collapsible={collapsible}
      className={cn(
        "group/sidebar flex h-full shrink-0 flex-col overflow-hidden border-r border-sidebar-border bg-sidebar text-sidebar-foreground transition-[width] duration-200 ease-linear",
        collapsible === "icon"
          ? "w-[--sidebar-width] data-[state=collapsed]:w-[--sidebar-width-icon]"
          : "w-[--sidebar-width]",
        className,
      )}
      {...props}
    />
  );
}

export function SidebarTrigger({
  className,
  ...props
}: React.ComponentProps<typeof Button>) {
  const { toggleSidebar } = useSidebar();

  return (
    <Button
      variant="ghost"
      size="sm"
      className={cn("h-8 w-8 px-0", className)}
      onClick={toggleSidebar}
      {...props}
    >
      <PanelLeft className="h-4 w-4" />
    </Button>
  );
}

export function SidebarContent({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        "min-h-0 flex flex-1 flex-col gap-4 overflow-auto px-3 py-3 group-data-[state=collapsed]/sidebar:px-2",
        className,
      )}
      {...props}
    />
  );
}

export function SidebarGroup({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <section className={cn("space-y-1", className)} {...props} />;
}

export function SidebarGroupContent({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("space-y-1", className)} {...props} />;
}

export function SidebarMenu({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("space-y-1", className)} {...props} />;
}

export function SidebarMenuItem({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={className} {...props} />;
}

type SidebarMenuButtonProps = React.ButtonHTMLAttributes<HTMLButtonElement> & {
  isActive?: boolean;
};

export function SidebarMenuButton({
  className,
  isActive,
  children,
  ...props
}: SidebarMenuButtonProps) {
  return (
    <button
      className={cn(
        "flex h-11 w-full items-center gap-3 rounded-lg px-3 text-sm transition-colors hover:bg-sidebar-accent hover:text-sidebar-accent-foreground group-data-[state=collapsed]/sidebar:justify-center group-data-[state=collapsed]/sidebar:px-0",
        isActive && "bg-sidebar-accent font-medium text-sidebar-accent-foreground",
        className,
      )}
      {...props}
    >
      {children}
    </button>
  );
}

export function SidebarInset({ className, ...props }: React.HTMLAttributes<HTMLElement>) {
  return <main className={cn("flex h-full min-w-0 flex-1 flex-col overflow-hidden bg-muted/30", className)} {...props} />;
}
