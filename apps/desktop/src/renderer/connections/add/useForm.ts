import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { AgentId } from "@nile/core/models/agent";
import type { CredentialStorageBackend } from "@nile/core/services/credential";
import { SHARED_SESSION_CONNECTION_METHODS } from "@nile/builtins/session";
import { EnabledAgentsPolicy } from "@nile/core/models/connection/enabled-agents-policy";

import { orderSupportedAuthModes, type Definition } from "../../shared/DesktopData";
import { sameAgentSelection } from "../../shared/AgentSelection";
import { syncDefaultAuthJsonPath } from "../AuthJsonPath";

export { sameAgentSelection } from "../../shared/AgentSelection";

type SessionSourceSelection =
  | "login"
  | "current_codex"
  | "current_claude"
  | "current_gemini"
  | "current_cursor";

type AddConnectionFormState = {
  apiKey: string;
  apiKeySource: "direct" | "env_key";
  authMode: string;
  authJsonPath: string;
  credentialStorageBackend: CredentialStorageBackend;
  encryptedLocalPassphrase: string;
  encryptedLocalPassphraseConfirmation: string;
  envKey: string;
  endpointUrl: string;
  enabledAgents: AgentId[];
  preset: Definition["preset"] | "";
  sessionSource: SessionSourceSelection;
};

export type SetEnabledAgentsOptions = {
  userEdited?: boolean;
};

export function resolveSessionSourceSelection(
  authMode: string,
  sessionSource: SessionSourceSelection,
  options?: { preferDefault?: boolean },
): SessionSourceSelection {
  const methods = SHARED_SESSION_CONNECTION_METHODS.listVisibleForAddConnectionForAuthMode(authMode);
  const defaultMethod = SHARED_SESSION_CONNECTION_METHODS.readDefaultForAuthMode(authMode);
  if (methods.length === 0 || !defaultMethod) {
    return sessionSource;
  }

  if (options?.preferDefault) {
    return defaultMethod.source;
  }

  return methods.some((method) => method.source === sessionSource)
    ? sessionSource
    : defaultMethod.source;
}

function createInitialFormState(
  defaultOpenAiAuthJsonPath: string,
  credentialStorageMode: CredentialStorageBackend | null,
): AddConnectionFormState {
  return {
    apiKey: "",
    apiKeySource: "direct",
    authMode: "",
    authJsonPath: defaultOpenAiAuthJsonPath,
    credentialStorageBackend: credentialStorageMode ?? "system_secure_storage",
    encryptedLocalPassphrase: "",
    encryptedLocalPassphraseConfirmation: "",
    envKey: "",
    endpointUrl: "",
    enabledAgents: [],
    preset: "",
    sessionSource: "login",
  };
}

export function useAddConnectionForm(
  definitions: Definition[],
  defaultOpenAiAuthJsonPath: string,
  credentialStorageMode: CredentialStorageBackend | null,
) {
  const enabledAgentsPolicy = useMemo(() => new EnabledAgentsPolicy(), []);
  const previousDefaultOpenAiAuthJsonPath = useRef(defaultOpenAiAuthJsonPath);
  const previousCredentialStorageMode = useRef(credentialStorageMode);
  const previousAuthMode = useRef("");
  const [enabledAgentsManuallyEdited, setEnabledAgentsManuallyEdited] = useState(false);
  const [formState, setFormState] = useState<AddConnectionFormState>(() =>
    createInitialFormState(defaultOpenAiAuthJsonPath, credentialStorageMode),
  );

  useEffect(() => {
    if (definitions.length === 0 || formState.preset) {
      return;
    }
    setFormState((current) => ({
      ...current,
      preset: definitions[0]?.preset ?? "",
    }));
  }, [definitions, formState.preset]);

  const selectedDefinition = useMemo(
    () => definitions.find((definition) => definition.preset === formState.preset) ?? definitions[0] ?? null,
    [definitions, formState.preset],
  );

  useEffect(() => {
    setEnabledAgentsManuallyEdited(false);
  }, [selectedDefinition?.preset]);

  useEffect(() => {
    const previousDefault = previousDefaultOpenAiAuthJsonPath.current;
    previousDefaultOpenAiAuthJsonPath.current = defaultOpenAiAuthJsonPath;

    if (previousDefault === defaultOpenAiAuthJsonPath) {
      return;
    }

    setFormState((current) => {
      const nextPath = syncDefaultAuthJsonPath(
        current.authJsonPath,
        previousDefault,
        defaultOpenAiAuthJsonPath,
      );
      if (nextPath === current.authJsonPath) {
        return current;
      }
      return {
        ...current,
        authJsonPath: nextPath,
      };
    });
  }, [defaultOpenAiAuthJsonPath]);

  useEffect(() => {
    const previousMode = previousCredentialStorageMode.current;
    previousCredentialStorageMode.current = credentialStorageMode;
    if (previousMode === credentialStorageMode) {
      return;
    }
    setFormState((current) => {
      if (current.credentialStorageBackend !== (previousMode ?? "system_secure_storage")) {
        return current;
      }
      const nextCredentialStorageBackend = credentialStorageMode ?? "system_secure_storage";
      return {
        ...current,
        credentialStorageBackend: nextCredentialStorageBackend,
        encryptedLocalPassphrase: nextCredentialStorageBackend === "encrypted_local_storage"
          ? current.encryptedLocalPassphrase
          : "",
        encryptedLocalPassphraseConfirmation: nextCredentialStorageBackend === "encrypted_local_storage"
          ? current.encryptedLocalPassphraseConfirmation
          : "",
      };
    });
  }, [credentialStorageMode]);

  useEffect(() => {
    if (!selectedDefinition) {
      return;
    }
    const orderedAuthModes = orderSupportedAuthModes(selectedDefinition.supportedAuthModes);
    if (selectedDefinition.supportedAuthModes.length === 1) {
      const nextAuthMode = orderedAuthModes[0] ?? "";
      if (formState.authMode !== nextAuthMode) {
        setFormState((current) => ({
          ...current,
          authMode: nextAuthMode,
        }));
      }
      return;
    }

    if (!selectedDefinition.supportedAuthModes.includes(formState.authMode as Definition["supportedAuthModes"][number])) {
      setFormState((current) => ({
        ...current,
        authMode: orderedAuthModes[0] ?? "",
      }));
    }
  }, [selectedDefinition, formState.authMode]);

  useEffect(() => {
    const preferDefault = previousAuthMode.current !== formState.authMode;
    previousAuthMode.current = formState.authMode;

    setFormState((current) => {
      const nextSessionSource = resolveSessionSourceSelection(
        current.authMode,
        current.sessionSource,
        { preferDefault },
      );
      if (nextSessionSource !== current.sessionSource) {
        return { ...current, sessionSource: nextSessionSource };
      }

      return current;
    });
  }, [formState.authMode]);

  useEffect(() => {
    if (!selectedDefinition) {
      return;
    }
    setFormState((current) => {
      const nextEnabledAgents = enabledAgentsPolicy.reconcile(
        current.enabledAgents,
        selectedDefinition.configurableAgents,
        selectedDefinition.defaultEnabledAgents,
      );

      if (sameAgentSelection(nextEnabledAgents, current.enabledAgents)) {
        return current;
      }

      return {
        ...current,
        enabledAgents: nextEnabledAgents,
      };
    });
  }, [enabledAgentsPolicy, selectedDefinition]);

  const setApiKey = useCallback(
    (apiKey: string) => setFormState((current) => ({ ...current, apiKey })),
    [],
  );
  const setApiKeySource = useCallback(
    (apiKeySource: "direct" | "env_key") => setFormState((current) => ({ ...current, apiKeySource })),
    [],
  );
  const setAuthJsonPath = useCallback(
    (authJsonPath: string) => setFormState((current) => ({ ...current, authJsonPath })),
    [],
  );
  const setAuthMode = useCallback(
    (authMode: string) => setFormState((current) => ({ ...current, authMode })),
    [],
  );
  const setCredentialStorageBackend = useCallback(
    (credentialStorageBackend: CredentialStorageBackend) => setFormState((current) => ({
      ...current,
      credentialStorageBackend,
      encryptedLocalPassphrase: credentialStorageBackend === "encrypted_local_storage"
        ? current.encryptedLocalPassphrase
        : "",
      encryptedLocalPassphraseConfirmation: credentialStorageBackend === "encrypted_local_storage"
        ? current.encryptedLocalPassphraseConfirmation
        : "",
    })),
    [],
  );
  const setEncryptedLocalPassphrase = useCallback(
    (encryptedLocalPassphrase: string) => setFormState((current) => ({ ...current, encryptedLocalPassphrase })),
    [],
  );
  const setEncryptedLocalPassphraseConfirmation = useCallback(
    (encryptedLocalPassphraseConfirmation: string) => setFormState((current) => ({
      ...current,
      encryptedLocalPassphraseConfirmation,
    })),
    [],
  );
  const setEnvKey = useCallback(
    (envKey: string) => setFormState((current) => ({ ...current, envKey })),
    [],
  );
  const setEndpointUrl = useCallback(
    (endpointUrl: string) => setFormState((current) => ({ ...current, endpointUrl })),
    [],
  );
  const setEnabledAgents = useCallback(
    (enabledAgents: AgentId[], options?: SetEnabledAgentsOptions) => {
      if (options?.userEdited !== false) {
        setEnabledAgentsManuallyEdited(true);
      }
      setFormState((current) =>
        sameAgentSelection(enabledAgents, current.enabledAgents)
          ? current
          : { ...current, enabledAgents }
      );
    },
    [],
  );
  const setPreset = useCallback(
    (preset: Definition["preset"]) => setFormState((current) => ({ ...current, preset })),
    [],
  );
  const setSessionSource = useCallback(
    (sessionSource: SessionSourceSelection) => setFormState((current) => ({ ...current, sessionSource })),
    [],
  );

  return {
    enabledAgentsManuallyEdited,
    formState,
    selectedDefinition,
    setApiKey,
    setApiKeySource,
    setAuthJsonPath,
    setAuthMode,
    setCredentialStorageBackend,
    setEncryptedLocalPassphrase,
    setEncryptedLocalPassphraseConfirmation,
    setEnvKey,
    setEndpointUrl,
    setEnabledAgents,
    setPreset,
    setSessionSource,
  };
}
