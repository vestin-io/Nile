import { Bot, Building2, Link2, Settings2, Workflow, type LucideIcon } from "lucide-react";

import type { Translator } from "../../shared/I18n";
import { nileMarkSvg } from "../../shared/NileMark";
import type { PageId } from "./useNavigation";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "../../ui/sidebar";

type NavItem = {
  id: PageId;
} & (
  | { labelKey: string }
  | { label: string }
) & (
  | { icon: LucideIcon }
  | { iconSvg: string }
  | { iconEmoji: string }
);

const AGENTS_NAV_ITEM: NavItem = { icon: Bot, id: "agents", labelKey: "nav.agents" };
const CONNECTIONS_NAV_ITEM: NavItem = { icon: Link2, id: "connections", labelKey: "nav.connections" };
const PROFILES_NAV_ITEM: NavItem = { icon: Workflow, id: "profiles", labelKey: "nav.profiles" };
const PROVIDERS_NAV_ITEM: NavItem = { icon: Building2, id: "providers", labelKey: "nav.providers" };
const SETTINGS_NAV_ITEM: NavItem = { icon: Settings2, id: "settings", labelKey: "nav.settings" };

type SettingsSidebarNavProps = {
  currentPage: PageId;
  currentProfileEmoji: string;
  currentProfileName: string | null;
  showAgents: boolean;
  showConnections: boolean;
  showProfiles: boolean;
  showQuickSetup: boolean;
  t: Translator;
  onPageChange(pageId: PageId): void;
};

export function SettingsSidebarNav({
  currentPage,
  currentProfileEmoji,
  currentProfileName,
  showAgents,
  showConnections,
  showProfiles,
  showQuickSetup,
  t,
  onPageChange,
}: SettingsSidebarNavProps) {
  const navItems: NavItem[] = [];
  if (showQuickSetup) {
    navItems.push({ iconSvg: nileMarkSvg, id: "quick-setup", labelKey: "nav.quickSetup" });
  }
  if (showProfiles) {
    navItems.push(currentProfileName
      ? {
          ...(currentProfileEmoji.trim()
            ? { iconEmoji: currentProfileEmoji.trim() }
            : { icon: Workflow }),
          id: "profiles",
          label: currentProfileName,
        }
      : PROFILES_NAV_ITEM);
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
                const label = "label" in item ? item.label : t(item.labelKey);
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
                      ) : "iconEmoji" in item ? (
                        <span aria-hidden="true" className="flex h-4 w-4 shrink-0 items-center justify-center text-base leading-none">
                          {item.iconEmoji}
                        </span>
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
