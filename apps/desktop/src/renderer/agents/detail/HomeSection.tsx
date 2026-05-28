import { useEffect, useState } from "react";
import { AlertTriangle } from "lucide-react";

import type { AgentId } from "@nile/core/models/agent";

import { formatLiveIssue } from "../../shared/DisplayText";
import type { Translator } from "../../shared/I18n";
import { Alert, AlertDescription, AlertTitle } from "../../ui/alert";
import { Button } from "../../ui/button";
import { Card, CardContent } from "../../ui/card";
import { Field } from "../../ui/field";
import { Input } from "../../ui/input";

type AgentHomeSectionProps = {
  agentId: AgentId;
  currentPath: string;
  defaultPath: string;
  runtimeCommandPath?: string | null;
  liveIssues?: string[];
  t: Translator;
  onSaveHome(agentId: AgentId, path: string | null): Promise<void>;
  onSaveRuntimeCommand(agentId: AgentId, path: string | null): Promise<void>;
};

export function AgentHomeSection({
  agentId,
  currentPath,
  defaultPath,
  runtimeCommandPath,
  liveIssues,
  t,
  onSaveHome,
  onSaveRuntimeCommand,
}: AgentHomeSectionProps) {
  const [path, setPath] = useState(currentPath);
  const [runtimeCommandInputPath, setRuntimeCommandInputPath] = useState(runtimeCommandPath ?? "");
  const [isSaving, setIsSaving] = useState(false);

  const normalizedPath = path.trim() ? path : null;
  const normalizedCurrentPath = currentPath.trim() ? currentPath : null;
  const normalizedRuntimeCommandPath = runtimeCommandInputPath.trim() ? runtimeCommandInputPath : null;
  const normalizedCurrentRuntimeCommandPath = runtimeCommandPath?.trim() ? runtimeCommandPath : null;
  const isDirty = normalizedPath !== normalizedCurrentPath
    || normalizedRuntimeCommandPath !== normalizedCurrentRuntimeCommandPath;

  useEffect(() => {
    setPath(currentPath);
  }, [currentPath]);

  useEffect(() => {
    setRuntimeCommandInputPath(runtimeCommandPath ?? "");
  }, [runtimeCommandPath]);

  const handleSave = async () => {
    if (isSaving) {
      return;
    }

    setIsSaving(true);
    try {
      await onSaveHome(agentId, normalizedPath);
      await onSaveRuntimeCommand(agentId, normalizedRuntimeCommandPath);
    } finally {
      setIsSaving(false);
    }
  };

  const handleReset = () => {
    setPath(defaultPath);
  };

  const handleRuntimeCommandReset = () => {
    setRuntimeCommandInputPath("");
  };

  return (
    <div className="space-y-4">
      {liveIssues && liveIssues.length > 0 ? (
        <Alert variant="destructive">
          <AlertTitle className="flex items-center gap-2">
            <AlertTriangle className="h-4 w-4" />
            {t("agents.localStateIssues")}
          </AlertTitle>
          <AlertDescription>
            <ul className="space-y-1">
              {liveIssues.map((issue) => (
                <li key={issue}>{formatLiveIssue(issue, t)}</li>
              ))}
            </ul>
          </AlertDescription>
        </Alert>
      ) : null}

      <Card>
        <CardContent className="space-y-4 p-6">
          <Field label={t("agents.home.currentPath")}>
            <Input
              value={path}
              placeholder={t("agents.home.pathPlaceholder")}
              onChange={(event) => setPath(event.target.value)}
            />
          </Field>
          <div className="flex flex-wrap gap-2">
            <Button
              variant="outline"
              onClick={handleReset}
              disabled={isSaving}
            >
              {t("agents.home.resetDefault", { path: defaultPath })}
            </Button>
          </div>
        </CardContent>
      </Card>

      {runtimeCommandPath !== undefined ? (
        <Card>
          <CardContent className="space-y-4 p-6">
            {!runtimeCommandPath ? (
              <Alert variant="destructive">
                <AlertTitle className="flex items-center gap-2">
                  <AlertTriangle className="h-4 w-4" />
                  {t("agents.home.cliCommand")}
                </AlertTitle>
                <AlertDescription>{t("agents.home.cliCommandMissing")}</AlertDescription>
              </Alert>
            ) : null}

            <Field label={t("agents.home.cliCommand")}>
              <Input
                value={runtimeCommandInputPath}
                placeholder={t("agents.home.cliCommandOverridePlaceholder")}
                onChange={(event) => setRuntimeCommandInputPath(event.target.value)}
              />
            </Field>
            <div className="flex flex-wrap gap-2">
              <Button
                variant="outline"
                onClick={handleRuntimeCommandReset}
                disabled={isSaving}
              >
                {t("agents.home.resetCliCommandOverride")}
              </Button>
            </div>
          </CardContent>
        </Card>
      ) : null}

      <div className="flex flex-wrap gap-2">
        <Button onClick={() => void handleSave()} disabled={isSaving || !isDirty}>
          {isSaving ? t("agents.home.saving") : t("common.save")}
        </Button>
      </div>
    </div>
  );
}
