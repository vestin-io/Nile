import { MousePointer2, Waypoints } from "lucide-react";
import openAiSvg from "@lobehub/icons-static-svg/icons/openai.svg";
import azureAiSvg from "@lobehub/icons-static-svg/icons/azureai-color.svg";
import claudeSvg from "@lobehub/icons-static-svg/icons/claude.svg";

import type { Translator } from "../shared/I18n";
import type { DesktopConnection } from "../../state/Types";

export function readProviderLabel(
  provider: DesktopConnection["endpointFamily"],
  t: Translator,
): string {
  if (provider === "openai") {
    return "OpenAI";
  }
  if (provider === "azure-openai") {
    return "Azure OpenAI";
  }
  if (provider === "anthropic") {
    return "Anthropic";
  }
  if (provider === "gateway") {
    return "Gateway";
  }
  if (provider === "cursor") {
    return "Cursor";
  }
  return t("common.unknown");
}

function readProviderIcon(provider: DesktopConnection["endpointFamily"]) {
  if (provider === "openai") {
    return <BrandIcon svg={openAiSvg} />;
  }
  if (provider === "azure-openai") {
    return <BrandIcon svg={azureAiSvg} />;
  }
  if (provider === "anthropic") {
    return <BrandIcon svg={claudeSvg} />;
  }
  if (provider === "gateway") {
    return <Waypoints className="h-4 w-4 text-muted-foreground" />;
  }
  if (provider === "cursor") {
    return <MousePointer2 className="h-4 w-4 text-muted-foreground" />;
  }
  return <span className="text-muted-foreground">•</span>;
}

export function readProviderIconNode(provider: DesktopConnection["endpointFamily"]) {
  return readProviderIcon(provider);
}

function BrandIcon({ svg }: { svg: string }) {
  return (
    <span
      aria-hidden="true"
      className="flex h-4 w-4 shrink-0 items-center justify-center [&_svg]:h-4 [&_svg]:w-4"
      dangerouslySetInnerHTML={{ __html: svg }}
    />
  );
}
