import { ConnectionLabeler } from "@nile/builtins/connections";
import type { AuthMode } from "@nile/core/models/access";
import type { ConnectionPresetFamily } from "@nile/core/models/connection";
import type { StoredCredential } from "@nile/core/services/credential";

import { InteractivePrompt } from "../InteractivePrompt";
import { ConnectionCredentialResolver } from "./CredentialResolver";

export class ConnectionOnboardingPrompts {
  private readonly connectionLabeler = new ConnectionLabeler();

  constructor(
    private readonly prompt: InteractivePrompt,
    private readonly credentialResolver: ConnectionCredentialResolver,
  ) {}

  async promptForAuthMode(
    supportedAuthModes: AuthMode[],
  ): Promise<AuthMode> {
    const selection = await this.prompt.select(
      "Choose an auth mode",
      supportedAuthModes.map((mode) => ({
        value: mode,
        label: this.credentialResolver.formatAuthModeLabel(mode),
      })),
      { allowBack: true, allowCancel: true },
    );
    if (selection.type === "cancel") {
      throw new Error("Cancelled");
    }
    if (selection.type === "back") {
      throw new Error("Back");
    }
    return selection.value;
  }

  async promptForSuggestedLabel(
    presetFamily: ConnectionPresetFamily,
    authMode: AuthMode,
    credential: StoredCredential,
    endpointUrl?: string,
  ): Promise<string | null> {
    const inferredLabel = this.connectionLabeler.resolveSuggestedAccessLabel(
      presetFamily,
      authMode,
      credential,
      { endpointUrl },
    );
    if (inferredLabel) {
      return inferredLabel;
    }

    let label = "";
    while (!label) {
      const input = await this.prompt.input("Connection label", {
        allowBack: true,
        allowCancel: true,
        defaultValue: this.connectionLabeler.suggestAccessLabel(
          presetFamily,
          authMode,
          credential,
          { endpointUrl },
        ),
      });
      if (input.type === "cancel") {
        throw new Error("Cancelled");
      }
      if (input.type === "back") {
        throw new Error("Back");
      }
      label = input.value;
    }
    return label;
  }

  async confirmGatewayProbe(endpointUrl: string): Promise<void> {
    const host = this.describeHost(endpointUrl);
    this.prompt.showNote(
      [
        `Nile will send your API key to ${host} to detect supported protocols.`,
        "Capability detection does not verify that this endpoint is official or trusted.",
      ].join("\n"),
      "Trust this gateway?",
    );
    const selection = await this.prompt.select(
      "Continue with gateway capability detection?",
      [
        { value: "continue", label: "Continue" },
      ],
      { allowBack: true, allowCancel: true },
    );
    if (selection.type === "cancel") {
      throw new Error("Cancelled");
    }
    if (selection.type === "back") {
      throw new Error("Back");
    }
  }

  private describeHost(endpointUrl: string): string {
    try {
      return new URL(endpointUrl).host || endpointUrl;
    } catch {
      return endpointUrl;
    }
  }
}
