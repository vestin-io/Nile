import { Bot, Building2, Link2, Settings2, type LucideIcon } from "lucide-react";
import nileMarkSvg from "../../../../../assets/icons/nile-mark.svg";

import type { Translator } from "../shared/I18n";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "../ui/sidebar";

type PageId = "quick-setup" | "agents" | "connections" | "providers" | "settings" | "add-connection";

type NavItem = {
  id: PageId;
  labelKey: string;
} & (
  | { icon: LucideIcon }
  | { iconSvg: string }
);

const AGENTS_NAV_ITEM: NavItem = { icon: Bot, id: "agents", labelKey: "nav.agents" };
const CONNECTIONS_NAV_ITEM: NavItem = { icon: Link2, id: "connections", labelKey: "nav.connections" };
const PROVIDERS_NAV_ITEM: NavItem = { icon: Building2, id: "providers", labelKey: "nav.providers" };
const SETTINGS_NAV_ITEM: NavItem = { icon: Settings2, id: "settings", labelKey: "nav.settings" };

type SettingsSidebarNavProps = {
  currentPage: PageId;
  showAgents: boolean;
  showConnections: boolean;
  showQuickSetup: boolean;
  t: Translator;
  onPageChange(pageId: PageId): void;
};

export function SettingsSidebarNav({
  currentPage,
  showAgents,
  showConnections,
  showQuickSetup,
  t,
  onPageChange,
}: SettingsSidebarNavProps) {
  const navItems: NavItem[] = [];
  if (showQuickSetup) {
    navItems.push({ iconSvg: nileMarkSvg, id: "quick-setup", labelKey: "nav.quickSetup" });
  }
  if (showAgents) {
    navItems.push(AGENTS_NAV_ITEM);
  }
  if (showConnections) {
    navItems.push(CONNECTIONS_NAV_ITEM);
  }
  navItems.push(PROVIDERS_NAV_ITEM);
  navItems.push(SETTINGS_NAV_ITEM);

  return (
    <Sidebar>
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupContent>
            <SidebarMenu>
              {navItems.map((item) => {
                const label = t(item.labelKey);
                return (
                  <SidebarMenuItem key={item.id}>
                    <SidebarMenuButton
                      isActive={currentPage === item.id}
                      onClick={() => onPageChange(item.id)}
                      aria-label={label}
                      title={label}
                    >
                      {"iconSvg" in item ? (
                        <div
                          aria-hidden="true"
                          className="flex h-4 w-4 shrink-0 items-center justify-center overflow-visible [&_svg]:h-6 [&_svg]:w-6"
                          dangerouslySetInnerHTML={{ __html: item.iconSvg }}
                        />
                      ) : (
                        <item.icon className="h-4 w-4 shrink-0" />
                      )}
                      <span className="group-data-[state=collapsed]/sidebar:hidden">{label}</span>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                );
              })}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
    </Sidebar>
  );
}
