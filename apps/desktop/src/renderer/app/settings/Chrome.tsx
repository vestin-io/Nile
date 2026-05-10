import type { Translator } from "../../shared/I18n";
import { nileMarkSvg } from "../../shared/NileMark";
import { Bell } from "lucide-react";
import { Breadcrumb, BreadcrumbItem, BreadcrumbList, BreadcrumbPage } from "../../ui/breadcrumb";
import { Button } from "../../ui/button";
import { Separator } from "../../ui/separator";
import { Alert, AlertDescription, AlertTitle } from "../../ui/alert";
import { SidebarInset, SidebarProvider, SidebarTrigger } from "../../ui/sidebar";
import { SettingsSidebarNav } from "./SidebarNav";
import type { PageId } from "./useNavigation";

const PAGE_TITLE_KEYS: Record<PageId, string> = {
  "quick-setup": "page.quickSetup",
  agents: "page.agents",
  connections: "page.connections",
  profiles: "page.profiles",
  providers: "page.providers",
  settings: "page.settings",
  notifications: "page.notifications",
  "add-connection": "page.addConnection",
};

type SettingsChromeProps = {
  children: React.ReactNode;
  currentPage: PageId;
  currentProfileEmoji: string;
  currentProfileName: string | null;
  error: string | null;
  hasUnreadNotifications: boolean;
  isSidebarOpen: boolean;
  showAgents: boolean;
  showConnections: boolean;
  showProfiles: boolean;
  showQuickSetup: boolean;
  t: Translator;
  onOpenAbout(): void;
  onOpenNotifications(): void;
  onPageChange(page: PageId): void;
  onRefresh(): Promise<void>;
  onSidebarOpenChange(open: boolean): void;
};

export function SettingsChrome({
  children,
  currentPage,
  currentProfileEmoji,
  currentProfileName,
  error,
  hasUnreadNotifications,
  isSidebarOpen,
  showAgents,
  showConnections,
  showProfiles,
  showQuickSetup,
  t,
  onOpenAbout,
  onOpenNotifications,
  onPageChange,
  onRefresh,
  onSidebarOpenChange,
}: SettingsChromeProps) {
  return (
    <SidebarProvider open={isSidebarOpen} onOpenChange={onSidebarOpenChange} className="flex h-screen flex-col overflow-hidden bg-muted/30 text-foreground">
      <header
        className="flex h-12 shrink-0 items-center border-b bg-background px-3"
        style={{ WebkitAppRegion: "drag" } as React.CSSProperties}
      >
        <div className="flex w-full items-center gap-3">
          <div className="w-[var(--desktop-titlebar-offset)] shrink-0" aria-hidden />
          <SidebarTrigger
            aria-label={isSidebarOpen ? t("common.collapseSidebar") : t("common.expandSidebar")}
            style={{ WebkitAppRegion: "no-drag" } as React.CSSProperties}
          />
          <Separator orientation="vertical" className="h-4" />
          <Breadcrumb style={{ WebkitAppRegion: "no-drag" } as React.CSSProperties}>
            <BreadcrumbList>
              <BreadcrumbItem>
                <BreadcrumbPage>{t(PAGE_TITLE_KEYS[currentPage])}</BreadcrumbPage>
              </BreadcrumbItem>
            </BreadcrumbList>
          </Breadcrumb>
          <div className="ml-auto" style={{ WebkitAppRegion: "no-drag" } as React.CSSProperties}>
            <div className="flex items-center gap-1">
              <Button
                aria-label={t("page.notifications")}
                className="relative h-9 w-9 rounded-xl p-0"
                title={t("page.notifications")}
                variant={currentPage === "notifications" ? "secondary" : "ghost"}
                onClick={onOpenNotifications}
              >
                <Bell className="h-[18px] w-[18px]" />
                {hasUnreadNotifications ? (
                  <span
                    aria-hidden="true"
                    className="absolute right-2 top-2 h-2.5 w-2.5 rounded-full bg-amber-500 ring-2 ring-background"
                  />
                ) : null}
              </Button>
              <Button
                aria-label={t("nile.dialog.title")}
                className="h-9 w-9 rounded-xl p-0 [&_svg]:h-[18px] [&_svg]:w-[18px]"
                title={t("nile.dialog.title")}
                variant="ghost"
                onClick={onOpenAbout}
              >
                <span
                  aria-hidden="true"
                  className="flex h-[18px] w-[18px] items-center justify-center [&_svg]:h-full [&_svg]:w-full"
                  dangerouslySetInnerHTML={{ __html: nileMarkSvg }}
                />
              </Button>
            </div>
          </div>
        </div>
      </header>

      <div className="flex min-h-0 flex-1 overflow-hidden">
        <SettingsSidebarNav
          currentPage={currentPage}
          currentProfileEmoji={currentProfileEmoji}
          currentProfileName={currentProfileName}
          showAgents={showAgents}
          showConnections={showConnections}
          showProfiles={showProfiles}
          showQuickSetup={showQuickSetup}
          t={t}
          onPageChange={onPageChange}
        />

        <SidebarInset>
          <div className="flex min-h-0 flex-1 flex-col overflow-hidden p-2 md:p-3">
            <div className="min-h-0 flex-1 overflow-auto p-4 sm:p-5">
              {error ? (
                <Alert variant="destructive" className="mb-4 flex items-start justify-between gap-3">
                  <div>
                    <AlertTitle>{t("common.configurationError")}</AlertTitle>
                    <AlertDescription>{error}</AlertDescription>
                  </div>
                  <Button
                    className="shrink-0"
                    size="sm"
                    variant="outline"
                    onClick={() => {
                      void onRefresh();
                    }}
                  >
                    {t("common.refresh")}
                  </Button>
                </Alert>
              ) : null}
              {children}
            </div>
          </div>
        </SidebarInset>
      </div>
    </SidebarProvider>
  );
}
