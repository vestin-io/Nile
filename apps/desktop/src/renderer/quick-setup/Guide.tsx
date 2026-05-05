import mascotImage from "../../../../../assets/mascot/image.png";

import type { DesktopOnboardingState } from "../../state/Types";
import type { Translator } from "../shared/I18n";
import { cn } from "../ui/cn";

type QuickSetupGuideProps = {
  onboarding: DesktopOnboardingState;
  t: Translator;
};

export function QuickSetupGuide({ onboarding, t }: QuickSetupGuideProps) {
  const content = readGuideContent(onboarding, t);

  return (
    <div className="max-w-[54rem] rounded-2xl bg-white/96 px-5 py-4 shadow-[0_18px_36px_rgba(15,23,42,0.08)] ring-1 ring-black/5 dark:bg-slate-950/96 dark:ring-white/10">
      <div className="grid gap-4 md:grid-cols-[88px_minmax(0,1fr)] md:items-center">
        <div className="flex justify-center md:justify-start">
          <div className="flex h-20 w-20 items-center justify-center overflow-hidden rounded-full bg-white/95 p-1.5 shadow-sm ring-1 ring-black/5 dark:bg-slate-900/85">
            <img
              alt=""
              src={mascotImage}
              className="h-full w-full object-contain"
            />
          </div>
        </div>
        <div className="space-y-2">
          <div className="text-[11px] font-medium uppercase tracking-[0.14em] text-slate-400 dark:text-slate-500">
            Nile guide
          </div>
          <div className={cn("font-medium leading-none tracking-tight", content.titleClassName)}>
            {content.title}
          </div>
          <div className={cn("text-sm leading-relaxed", content.descriptionClassName)}>
            {content.description}
          </div>
        </div>
      </div>
    </div>
  );
}

function readGuideContent(onboarding: DesktopOnboardingState, t: Translator): {
  description: string;
  descriptionClassName: string;
  title: string;
  titleClassName: string;
} {
  const hasNewSetup = onboarding.items.some((item) => item.state === "new");
  if (hasNewSetup) {
    return {
      description: t("quickSetup.guide.unsavedDescription"),
      descriptionClassName: "text-slate-700 dark:text-slate-300",
      title: t("quickSetup.guide.unsavedTitle"),
      titleClassName: "text-amber-700 dark:text-amber-300",
    };
  }

  const hasInvalidSetup = onboarding.items.some((item) => item.state === "invalid");
  if (hasInvalidSetup) {
    return {
      description: t("quickSetup.guide.invalidDescription"),
      descriptionClassName: "text-slate-700 dark:text-slate-300",
      title: t("quickSetup.guide.invalidTitle"),
      titleClassName: "text-rose-700 dark:text-rose-300",
    };
  }

  const hasSavedSetup = onboarding.items.some((item) => item.state === "already_saved");
  if (hasSavedSetup) {
    return {
      description: t("quickSetup.guide.savedDescription"),
      descriptionClassName: "text-slate-700 dark:text-slate-300",
      title: t("quickSetup.guide.savedTitle"),
      titleClassName: "text-emerald-700 dark:text-emerald-300",
    };
  }

  return {
    description: t("quickSetup.guide.emptyDescription"),
    descriptionClassName: "text-slate-700 dark:text-slate-300",
    title: t("quickSetup.guide.emptyTitle"),
    titleClassName: "text-sky-700 dark:text-sky-300",
  };
}
