import { useEffect, useState } from "react";
import { AlertTriangle } from "lucide-react";

import type { AgentId } from "@nile/core/models/agent/types";

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
  liveIssues?: string[];
  t: Translator;
  onSave(agentId: AgentId, path: string | null): Promise<void>;
};

export function AgentHomeSection({
  agentId,
  currentPath,
  defaultPath,
  liveIssues,
  t,
  onSave,
}: AgentHomeSectionProps) {
  const [path, setPath] = useState(currentPath);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    setPath(currentPath);
  }, [currentPath]);

  const handleSave = async () => {
    if (isSaving) {
      return;
    }

    setIsSaving(true);
    try {
      await onSave(agentId, path.trim() ? path : null);
    } finally {
      setIsSaving(false);
    }
  };

  const handleReset = async () => {
    if (isSaving) {
      return;
    }

    setPath(defaultPath);
    setIsSaving(true);
    try {
      await onSave(agentId, null);
    } finally {
      setIsSaving(false);
    }
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
            <Button onClick={() => void handleSave()} disabled={isSaving}>
              {isSaving ? t("agents.home.saving") : t("common.save")}
            </Button>
            <Button
              variant="outline"
              onClick={() => void handleReset()}
              disabled={isSaving}
            >
              {t("agents.home.resetDefault", { path: defaultPath })}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
