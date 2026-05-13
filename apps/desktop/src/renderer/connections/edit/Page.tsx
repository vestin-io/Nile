import type { DesktopConnection } from "../../../state/Types";
import type { LanguagePreference } from "../../settings/Preferences";
import {
  ConnectionCapabilityField,
  ConnectionMethodSelector,
  FormField,
} from "../ConnectionFormParts";
import type { Translator } from "../../shared/I18n";
import type { Definition } from "../../shared/DesktopData";
import { authModeLabel } from "../../shared/DisplayText";
import { ProviderSummary } from "../../providers/ProviderSummary";
import {
  useConnectionEditState,
  type ConnectionEditSubmitInput,
} from "./useEditState";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "../../ui/breadcrumb";
import { Button } from "../../ui/button";
import { Checkbox } from "../../ui/checkbox";
import { Input } from "../../ui/input";
import { Alert, AlertDescription, AlertTitle } from "../../ui/alert";
import { Card, CardContent } from "../../ui/card";

type ConnectionEditPageProps = {
  connection: DesktopConnection;
  defaultOpenAiAuthJsonPath: string;
  definitions: Definition[];
  language: LanguagePreference;
  t: Translator;
  onBack(): void;
  onSubmit(input: ConnectionEditSubmitInput): Promise<void>;
};

export function ConnectionEditPage({
  connection,
  defaultOpenAiAuthJsonPath,
  definitions,
  language,
  t,
  onBack,
  onSubmit,
}: ConnectionEditPageProps) {
  const {
    apiKey,
    apiKeySource,
    authJsonPath,
    canEditEnabledAgents,
    canEditEndpointUrl,
    canUpdateCredential,
    chooseAuthJsonPath,
    connectionMethods,
    configurableAgents,
    displayedEnabledAgents,
    definition,
    enabledAgents,
    endpointUrl,
    envKey,
    gatewayTrustConfirmed,
    hasProbedSupport,
    isChoosingAuthJsonPath,
    isProbingSupport,
    isSaving,
    label,
    redetectSupport,
    selectedMethodKey,
    setAgentsDirty,
    setApiKey,
    setApiKeySource,
    setAuthUpdateRequested,
    setClaudeSessionSource,
    setEnabledAgents,
    setEndpointUrl,
    setEnvKey,
    setGatewayTrustConfirmed,
    setLabel,
    setSessionSource,
    shouldShowAuthJsonPath,
    shouldProbeGatewaySupport,
    detectedAgents,
    submit,
    trimmedLabel,
    requiresGatewayTrustForSave,
    actionError,
  } = useConnectionEditState({
    connection,
    defaultOpenAiAuthJsonPath,
    definitions,
    onSubmit,
    t,
  });
  const gatewayTrustTarget = describeGatewayTrustTarget(endpointUrl);

  return (
    <div className="space-y-5">
      <div className="space-y-4">
        <Breadcrumb>
          <BreadcrumbList>
            <BreadcrumbItem>
              <BreadcrumbLink
                href="#"
                onClick={(event) => {
                  event.preventDefault();
                  onBack();
                }}
              >
                {t("page.connections")}
              </BreadcrumbLink>
            </BreadcrumbItem>
            <BreadcrumbSeparator />
            <BreadcrumbItem>
              <BreadcrumbPage>{connection.label}</BreadcrumbPage>
            </BreadcrumbItem>
            <BreadcrumbSeparator />
            <BreadcrumbItem>
              <BreadcrumbPage>{t("common.edit")}</BreadcrumbPage>
            </BreadcrumbItem>
          </BreadcrumbList>
        </Breadcrumb>
        <div className="space-y-1">
          <h1 className="text-2xl font-semibold tracking-tight">{t("connections.editTitle")}</h1>
          <p className="text-sm text-muted-foreground">{t("connections.editDescription")}</p>
        </div>
      </div>

      {definition ? (
        <Card className="rounded-2xl">
          <CardContent className="pt-6">
            <ProviderSummary
              language={language}
              providerKey={definition.preset}
              t={t}
            />
          </CardContent>
        </Card>
      ) : null}

      <form
        className="space-y-5"
        onSubmit={(event) => {
          event.preventDefault();
          void submit();
        }}
      >
        {actionError ? (
          <Alert>
            <AlertDescription>{actionError}</AlertDescription>
          </Alert>
        ) : null}

        <div className="grid gap-5 lg:grid-cols-2">
          <FormField label={t("common.name")}>
            <Input value={label} onChange={(event) => setLabel(event.target.value)} />
            {!trimmedLabel ? (
              <div className="text-sm text-destructive">{t("connections.labelRequired")}</div>
            ) : null}
          </FormField>

          {canEditEndpointUrl ? (
            <FormField label={t("dialog.endpointUrl")}>
              <Input
                type="url"
                value={endpointUrl}
                onChange={(event) => {
                  setEndpointUrl(event.target.value);
                  if (event.target.value !== (connection.endpointUrl ?? "")) {
                    setAuthUpdateRequested(true);
                  }
                }}
                placeholder={t("dialog.endpointUrlPlaceholder")}
              />
            </FormField>
          ) : (
            <FormField label={t("common.auth")}>
              <div className="rounded-xl border bg-muted/20 px-4 py-3 text-sm">{authModeLabel(connection.authMode, t)}</div>
            </FormField>
          )}
        </div>

        {canUpdateCredential && connectionMethods.length > 0 ? (
          <FormField label={t("addConnection.chooseMethod")}>
            <ConnectionMethodSelector
              methods={connectionMethods}
              selectedKey={selectedMethodKey}
              onSelect={(method) => {
                setAuthUpdateRequested(true);
                if (method.apiKeySource) {
                  setApiKeySource(method.apiKeySource);
                }
                if (method.authMode === "openai_session" && method.sessionSource) {
                  setSessionSource(method.sessionSource);
                }
                if (method.authMode === "claude_session") {
                  setClaudeSessionSource("login");
                }
              }}
            />
          </FormField>
        ) : null}

        <div className="grid gap-5 lg:grid-cols-2">
          {connection.authMode === "api_key" ? (
            apiKeySource === "env_key" ? (
              <FormField label={t("dialog.envKey")}>
                <Input
                  type="text"
                  value={envKey}
                  onChange={(event) => {
                    setEnvKey(event.target.value);
                    if (event.target.value.trim()) {
                      setAuthUpdateRequested(true);
                    }
                  }}
                  placeholder={t("dialog.envKeyPlaceholder")}
                />
              </FormField>
            ) : (
              <FormField label={t("dialog.apiKey")}>
                <Input
                  type="password"
                  value={apiKey}
                  onChange={(event) => {
                    setApiKey(event.target.value);
                    if (event.target.value.trim()) {
                      setAuthUpdateRequested(true);
                    }
                  }}
                  placeholder={t("dialog.apiKeyPlaceholder")}
                />
              </FormField>
            )
          ) : null}

          {shouldShowAuthJsonPath ? (
            <FormField label={t("addConnection.authJsonPath")}>
              <div className="flex gap-2">
                <Input
                  type="text"
                  readOnly
                  value={authJsonPath}
                  placeholder={t("addConnection.authJsonPathPlaceholder")}
                />
                <Button
                  type="button"
                  variant="secondary"
                  disabled={isChoosingAuthJsonPath}
                  onClick={() => void chooseAuthJsonPath()}
                >
                  {isChoosingAuthJsonPath ? t("common.loading") : t("common.chooseFile")}
                </Button>
              </div>
            </FormField>
          ) : null}
        </div>

        {canEditEnabledAgents && connection.authMode === "api_key" ? (
          <Alert>
            <AlertTitle>{t("addConnection.gatewayTrustTitle")}</AlertTitle>
            <AlertDescription className="space-y-3">
              <div>{t("addConnection.gatewayTrustDescription", { host: gatewayTrustTarget })}</div>
              <label className="flex items-start gap-3 text-sm">
                <Checkbox
                  checked={gatewayTrustConfirmed}
                  onCheckedChange={(checked) => setGatewayTrustConfirmed(checked === true)}
                />
                <span>{t("addConnection.gatewayTrustAcknowledge")}</span>
              </label>
            </AlertDescription>
          </Alert>
        ) : null}

        {definition ? (
          <ConnectionCapabilityField
            configurableAgents={configurableAgents}
            editable={canEditEnabledAgents}
            enabledAgents={displayedEnabledAgents}
            isProbingSupport={isProbingSupport}
            showDetectionState={canEditEnabledAgents && (isProbingSupport || hasProbedSupport)}
            detectedAgents={detectedAgents}
            t={t}
            onEnabledAgentsChange={(nextAgents) => {
              setAgentsDirty(true);
              setEnabledAgents(nextAgents);
            }}
          />
        ) : null}

        <div className="flex flex-wrap justify-end gap-2">
          {canEditEnabledAgents ? (
            <Button
              variant="secondary"
              type="button"
              disabled={!gatewayTrustConfirmed || !shouldProbeGatewaySupport || isProbingSupport || isSaving}
              onClick={() => void redetectSupport()}
            >
              {isProbingSupport ? t("addConnection.detectingCapability") : t("addConnection.redetectCapability")}
            </Button>
          ) : null}
          <Button variant="ghost" type="button" onClick={onBack}>
            {t("common.cancel")}
          </Button>
          <Button disabled={!trimmedLabel || isSaving || (requiresGatewayTrustForSave && !gatewayTrustConfirmed)} type="submit">
            {isSaving ? t("connections.saving") : t("common.save")}
          </Button>
        </div>
      </form>
    </div>
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
