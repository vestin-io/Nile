import type { AgentId } from "@nile/core/models/agent/definitions";
import type { DesktopOnboardingItem, DesktopOnboardingState } from "../../state/Types";
import { formatAgentLabel } from "./AgentSelection";
import type { Translator } from "./I18n";

type GuideTone = "empty" | "invalid" | "saved" | "unsaved";

export type LocalSetupGuideContent = {
  description: string;
  descriptionClassName: string;
  title: string;
  titleClassName: string;
};

export type LocalSetupSectionContent = {
  actionKind: "configure" | "disabled" | "save" | "saved";
  badgeLabel: string | null;
  hasLocalSetup: boolean;
  isSaved: boolean;
  primary: string;
  secondary?: string;
};

export class LocalSetupPresentation {
  readGuideContent(
    onboarding: DesktopOnboardingState,
    t: Translator,
  ): LocalSetupGuideContent {
    const tone = this.readGuideTone(onboarding);
    switch (tone) {
      case "unsaved":
        return {
          description: t("quickSetup.guide.unsavedDescription"),
          descriptionClassName: "text-slate-700 dark:text-slate-300",
          title: t("quickSetup.guide.unsavedTitle"),
          titleClassName: "text-amber-700 dark:text-amber-300",
        };
      case "invalid":
        return {
          description: t("quickSetup.guide.invalidDescription"),
          descriptionClassName: "text-slate-700 dark:text-slate-300",
          title: t("quickSetup.guide.invalidTitle"),
          titleClassName: "text-rose-700 dark:text-rose-300",
        };
      case "saved":
        return {
          description: t("quickSetup.guide.savedDescription"),
          descriptionClassName: "text-slate-700 dark:text-slate-300",
          title: t("quickSetup.guide.savedTitle"),
          titleClassName: "text-emerald-700 dark:text-emerald-300",
        };
      default:
        return {
          description: t("quickSetup.guide.emptyDescription"),
          descriptionClassName: "text-slate-700 dark:text-slate-300",
          title: t("quickSetup.guide.emptyTitle"),
          titleClassName: "text-sky-700 dark:text-sky-300",
        };
    }
  }

  readSectionContent(
    agentId: AgentId,
    detectedSetup: DesktopOnboardingItem | null,
    t: Translator,
  ): LocalSetupSectionContent {
    const reconciliationState = detectedSetup?.reconciliationState;
    if (!detectedSetup || reconciliationState === "unavailable") {
      return {
        actionKind: "disabled",
        badgeLabel: null,
        hasLocalSetup: false,
        isSaved: false,
        primary: t("quickSetup.noLocalSetupSecondary", { agent: formatAgentLabel(agentId) }),
      };
    }

    return {
      actionKind: this.readActionKind(detectedSetup),
      badgeLabel: this.readBadgeLabel(detectedSetup, t),
      hasLocalSetup: this.hasLocalSetup(detectedSetup),
      isSaved: this.isSaved(detectedSetup),
      primary: this.stripAgentPrefix(detectedSetup.title, formatAgentLabel(agentId)),
      secondary: this.formatDetectedSubtitle(detectedSetup.subtitle, t),
    };
  }

  shouldShowDetectedSetup(
    detectedSetup: DesktopOnboardingItem | null,
  ): boolean {
    return Boolean(detectedSetup && !this.isSaved(detectedSetup));
  }

  readActionKind(
    detectedSetup: Pick<DesktopOnboardingItem, "reconciliationState"> | null | undefined,
  ): LocalSetupSectionContent["actionKind"] {
    if (!detectedSetup || detectedSetup.reconciliationState === "unavailable") {
      return "disabled";
    }
    if (detectedSetup.reconciliationState === "already_saved") {
      return "saved";
    }
    if (detectedSetup.reconciliationState === "new") {
      return "save";
    }
    return "configure";
  }

  isSaved(
    detectedSetup: Pick<DesktopOnboardingItem, "reconciliationState"> | null | undefined,
  ): boolean {
    return detectedSetup?.reconciliationState === "already_saved";
  }

  private hasLocalSetup(
    detectedSetup: Pick<DesktopOnboardingItem, "reconciliationState">,
  ): boolean {
    return detectedSetup.reconciliationState === "new" || detectedSetup.reconciliationState === "already_saved";
  }

  private readGuideTone(
    onboarding: DesktopOnboardingState,
  ): GuideTone {
    if (onboarding.items.some((item) => item.reconciliationState === "new")) {
      return "unsaved";
    }
    if (onboarding.items.some((item) => item.reconciliationState === "invalid")) {
      return "invalid";
    }
    if (onboarding.items.some((item) => item.reconciliationState === "already_saved")) {
      return "saved";
    }
    return "empty";
  }

  private readBadgeLabel(
    detectedSetup: Pick<DesktopOnboardingItem, "reconciliationState">,
    t: Translator,
  ): string | null {
    return detectedSetup.reconciliationState === "new" ? t("quickSetup.newSetupBadge") : null;
  }

  private formatDetectedSubtitle(
    value: string,
    t: Translator,
  ): string {
    const parts = value.split(" • ");
    if (parts.length !== 2) {
      return value;
    }

    const [endpointLabel, authMode] = parts;
    return `${endpointLabel} • ${this.readAuthLabel(authMode, t)}`;
  }

  private readAuthLabel(
    authMode: string,
    t: Translator,
  ): string {
    const key = `auth.${authMode}`;
    const translated = t(key);
    if (translated !== key) {
      return translated;
    }

    return authMode
      .split("_")
      .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
      .join(" ");
  }

  private stripAgentPrefix(
    value: string,
    agentLabel: string,
  ): string {
    const prefix = `${agentLabel} · `;
    return value.startsWith(prefix) ? value.slice(prefix.length) : value;
  }
}

export const LOCAL_SETUP_PRESENTATION = new LocalSetupPresentation();
