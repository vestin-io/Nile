import { MousePointer2, Waypoints } from "lucide-react";
import openAiSvg from "@lobehub/icons-static-svg/icons/openai.svg";
import azureAiSvg from "@lobehub/icons-static-svg/icons/azureai-color.svg";
import claudeSvg from "@lobehub/icons-static-svg/icons/claude.svg";
import geminiSvg from "@lobehub/icons-static-svg/icons/gemini-color.svg";

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
  if (provider === "gemini") {
    return "Gemini";
  }
  return t("common.unknown");
}

export function readProviderIconNode(iconKey: string) {
  if (iconKey === "openai") {
    return <BrandIcon svg={openAiSvg} />;
  }
  if (iconKey === "azure-openai") {
    return <BrandIcon svg={azureAiSvg} />;
  }
  if (iconKey === "anthropic") {
    return <BrandIcon svg={claudeSvg} />;
  }
  if (iconKey === "gemini") {
    return <BrandIcon svg={geminiSvg} />;
  }
  if (iconKey === "gateway") {
    return <Waypoints className="h-4 w-4 text-muted-foreground" />;
  }
  if (iconKey === "cursor") {
    return <MousePointer2 className="h-4 w-4 text-muted-foreground" />;
  }
  return <span className="text-muted-foreground">•</span>;
}

export function readEndpointProviderIconNode(provider: DesktopConnection["endpointFamily"]) {
  return readProviderIconNode(provider);
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
