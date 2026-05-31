import type { EnvironmentSource } from "@nile/core/services/EnvironmentSource";

import { join } from "node:path";

import { GeminiSessionLogin } from "./GeminiSessionLogin";
import { GeminiSessionStores } from "./Stores";

const loginPollIntervalMs = 1000;
const loginTimeoutMs = 5 * 60 * 1000;

type GeminiSessionSnapshot = {
  resolvedSignature: string | null;
  settings: string | null;
  accounts: string | null;
  backend: {
    keychain: string | null;
    file: string | null;
  };
};

export class GeminiSignInFlow {
  constructor(
    private readonly environment: EnvironmentSource,
    private readonly createLogin: (environment: EnvironmentSource) => GeminiSessionLogin =
      (environment) => new GeminiSessionLogin(environment),
    private readonly sleep: (milliseconds: number) => Promise<void> = (milliseconds) =>
      new Promise((resolve) => setTimeout(resolve, milliseconds)),
  ) {}

  async signInAndRead(
    geminiHome: string,
    options: { commandPathOverride?: string | null } = {},
  ) {
    const stores = GeminiSessionStores.open(geminiHome);
    const baseline = this.readSessionSnapshot(stores);

    await this.createLogin(this.environment).signIn(geminiHome, options);
    const session = await this.waitForSignedInSession(stores, baseline);
    if (session.kind !== "resolved") {
      throw new Error(
        `No Gemini CLI session found after Gemini sign-in: ${session.issues.join("; ")}`,
      );
    }

    return {
      kind: "gemini_cli_session" as const,
      accessToken: session.value.credential.accessToken,
      refreshToken: session.value.credential.refreshToken,
      idToken: session.value.credential.idToken,
      ...(session.value.credential.expiryDate !== undefined ? { expiryDate: session.value.credential.expiryDate } : {}),
      ...(session.value.credential.tokenType ? { tokenType: session.value.credential.tokenType } : {}),
      ...(session.value.credential.scope ? { scope: session.value.credential.scope } : {}),
    };
  }

  private readSessionSnapshot(stores: GeminiSessionStores): GeminiSessionSnapshot {
    const session = stores.reader.read();
    return {
      resolvedSignature: session.kind === "resolved" ? JSON.stringify(session.value) : null,
      settings: stores.settings.snapshot(),
      accounts: stores.accounts.snapshot(),
      backend: stores.backend.snapshot(),
    };
  }

  private async waitForSignedInSession(
    stores: GeminiSessionStores,
    baseline: GeminiSessionSnapshot,
  ): Promise<ReturnType<GeminiSessionStores["reader"]["read"]>> {
    const deadline = Date.now() + loginTimeoutMs;
    let latest = stores.reader.read();

    while (Date.now() < deadline) {
      this.syncNestedGeminiHome(stores);
      latest = stores.reader.read();
      if (latest.kind === "resolved" && this.didSessionChange(baseline, stores, latest.value)) {
        return latest;
      }

      await this.sleep(loginPollIntervalMs);
    }

    if (latest.kind === "resolved" && baseline.resolvedSignature === null) {
      return latest;
    }

    throw new Error(
      "Gemini sign-in did not produce a new local Gemini CLI session. Finish the login flow in the opened Terminal window, then try again or use Import local Gemini CLI session.",
    );
  }

  private syncNestedGeminiHome(stores: GeminiSessionStores): void {
    const nested = GeminiSessionStores.open(join(stores.geminiHome, ".gemini"));
    const nestedSession = nested.reader.read();
    if (nestedSession.kind !== "resolved") {
      return;
    }

    stores.settings.restore(nested.settings.snapshot());
    stores.accounts.restore(nested.accounts.snapshot());
    stores.backend.restoreSnapshot(nested.backend.snapshot());
  }

  private didSessionChange(
    baseline: GeminiSessionSnapshot,
    stores: GeminiSessionStores,
    session: NonNullable<Extract<ReturnType<GeminiSessionStores["reader"]["read"]>, { kind: "resolved" }>["value"]>,
  ): boolean {
    if (baseline.resolvedSignature !== JSON.stringify(session)) {
      return true;
    }

    const currentBackend = stores.backend.snapshot();
    return baseline.settings !== stores.settings.snapshot()
      || baseline.accounts !== stores.accounts.snapshot()
      || baseline.backend.keychain !== currentBackend.keychain
      || baseline.backend.file !== currentBackend.file;
  }
}
