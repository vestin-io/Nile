import type { Definition } from "../../shared/DesktopData";
import type { Translator } from "../../shared/I18n";
import { Alert, AlertDescription, AlertTitle } from "../../ui/alert";
import { Checkbox } from "../../ui/checkbox";
import { Input } from "../../ui/input";
import { FormField } from "../ConnectionFormParts";

type AddConnectionGatewayPreparationProps = {
  apiKey: string;
  apiKeySource: "direct" | "env_key";
  endpointUrl: string;
  gatewayTrustConfirmed: boolean;
  selectedDefinition: Definition | null;
  t: Translator;
  onApiKeyChange(value: string): void;
  onEndpointUrlChange(value: string): void;
  onEnvKeyChange(value: string): void;
  onGatewayTrustConfirmedChange(value: boolean): void;
};

export function AddConnectionGatewayPreparation({
  apiKey,
  apiKeySource,
  endpointUrl,
  gatewayTrustConfirmed,
  selectedDefinition,
  t,
  onApiKeyChange,
  onEndpointUrlChange,
  onEnvKeyChange,
  onGatewayTrustConfirmedChange,
}: AddConnectionGatewayPreparationProps) {
  const gatewayTrustTarget = describeGatewayTrustTarget(endpointUrl);

  return (
    <>
      <div className="grid gap-5 lg:grid-cols-2">
        {selectedDefinition?.requiresEndpointUrl ? (
          <FormField label={t("dialog.endpointUrl")}>
            <Input
              type="url"
              value={endpointUrl}
              onChange={(event) => onEndpointUrlChange(event.target.value)}
              placeholder={t("dialog.endpointUrlPlaceholder")}
            />
          </FormField>
        ) : null}

        {apiKeySource === "env_key" ? (
          <FormField label={t("dialog.envKey")}>
            <Input
              type="text"
              value={apiKey}
              onChange={(event) => onEnvKeyChange(event.target.value)}
              placeholder={t("dialog.envKeyPlaceholder")}
            />
          </FormField>
        ) : (
          <FormField label={t("dialog.apiKey")}>
            <Input
              type="password"
              value={apiKey}
              onChange={(event) => onApiKeyChange(event.target.value)}
              placeholder={t("dialog.apiKeyPlaceholder")}
            />
          </FormField>
        )}
      </div>

      <Alert>
        <AlertTitle>{t("addConnection.gatewayTrustTitle")}</AlertTitle>
        <AlertDescription className="space-y-3">
          <div>{t("addConnection.gatewayTrustDescription", { host: gatewayTrustTarget })}</div>
          <label className="flex items-start gap-3 text-sm">
            <Checkbox
              checked={gatewayTrustConfirmed}
              onCheckedChange={(checked) => onGatewayTrustConfirmedChange(checked === true)}
            />
            <span>{t("addConnection.gatewayTrustAcknowledge")}</span>
          </label>
        </AlertDescription>
      </Alert>
    </>
  );
}

function describeGatewayTrustTarget(endpointUrl: string): string {
  const trimmed = endpointUrl.trim();
  if (!trimmed) {
    return "this endpoint";
  }

  try {
    return new URL(trimmed).host || trimmed;
  } catch {
    return trimmed;
  }
}
