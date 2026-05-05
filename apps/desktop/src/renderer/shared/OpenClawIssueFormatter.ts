import type { Translator } from "./I18n";

export function formatOpenClawLiveIssue(issue: string, t: Translator): string {
  const missingConfigMatch = issue.match(/^OpenClaw config not found at (.+)$/);
  if (missingConfigMatch) {
    return t("issues.openclaw.configNotFound", { path: missingConfigMatch[1] });
  }

  const emptyConfigMatch = issue.match(/^OpenClaw config is empty at (.+)$/);
  if (emptyConfigMatch) {
    return t("issues.openclaw.configEmpty", { path: emptyConfigMatch[1] });
  }

  if (issue === "OpenClaw config does not define agents.defaults.model.primary") {
    return t("issues.openclaw.primaryModelMissing");
  }

  if (issue === "OpenClaw config does not define models.providers") {
    return t("issues.openclaw.providersMissing");
  }

  const missingProviderMatch = issue.match(
    /^OpenClaw config does not contain provider (.+) referenced by agents\.defaults\.model\.primary$/,
  );
  if (missingProviderMatch) {
    return t("issues.openclaw.providerMissing", { provider: missingProviderMatch[1] });
  }

  const missingFieldMatch = issue.match(
    /^OpenClaw provider (.+) is missing (baseUrl|apiKey|api)$/,
  );
  if (missingFieldMatch) {
    return t("issues.openclaw.providerFieldMissing", {
      provider: missingFieldMatch[1],
      field: missingFieldMatch[2],
    });
  }

  const unsupportedProtocolMatch = issue.match(
    /^OpenClaw provider (.+) uses unsupported api protocol (.+)$/,
  );
  if (unsupportedProtocolMatch) {
    return t("issues.openclaw.unsupportedProtocol", {
      provider: unsupportedProtocolMatch[1],
      protocol: unsupportedProtocolMatch[2],
    });
  }

  const invalidPrimaryMatch = issue.match(
    /^OpenClaw primary model must use provider\/model format, received: (.+)$/,
  );
  if (invalidPrimaryMatch) {
    return t("issues.openclaw.invalidPrimaryModel", { value: invalidPrimaryMatch[1] });
  }

  return issue;
}
