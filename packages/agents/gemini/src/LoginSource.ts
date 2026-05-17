import type { InteractiveSessionLoginManifest } from "@nile/core/session/LoginTypes";
import { mkdirSync, mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { GeminiSessionLogin } from "./GeminiSessionLogin";
import { GeminiSessionStores } from "./Stores";

const loginPollIntervalMs = 1000;
const loginTimeoutMs = 5 * 60 * 1000;

export const GEMINI_LOGIN_SOURCE = {
  authMode: "gemini_cli_session",
  label: "Sign in with Gemini",
  async signInAndRead(context) {
    const geminiHome = createTemporaryGeminiHome();
    const stores = GeminiSessionStores.open(geminiHome);
    const baseline = readSessionSnapshot(
      stores.reader,
      stores.settings,
      stores.accounts,
      stores.backend,
    );

    await new GeminiSessionLogin(context.environment).signIn(geminiHome);
    const session = await waitForSignedInSession(stores, baseline);
    if (session.kind !== "resolved") {
      throw new Error(
        `No Gemini CLI session found after Gemini sign-in: ${session.issues.join("; ")}`,
      );
    }

    return {
      kind: "gemini_cli_session",
      accessToken: session.value.credential.accessToken,
      refreshToken: session.value.credential.refreshToken,
      idToken: session.value.credential.idToken,
      ...(session.value.credential.expiryDate !== undefined ? { expiryDate: session.value.credential.expiryDate } : {}),
      ...(session.value.credential.tokenType ? { tokenType: session.value.credential.tokenType } : {}),
      ...(session.value.credential.scope ? { scope: session.value.credential.scope } : {}),
    };
  },
} as const satisfies InteractiveSessionLoginManifest;

type GeminiSessionSnapshot = {
  resolvedSignature: string | null;
  settings: string | null;
  accounts: string | null;
  backend: {
    keychain: string | null;
    file: string | null;
  };
};

type GeminiStores = {
  geminiHome: string;
  settings: GeminiSessionStores["settings"];
  accounts: GeminiSessionStores["accounts"];
  backend: GeminiSessionStores["backend"];
  reader: GeminiSessionStores["reader"];
};

function readSessionSnapshot(
  reader: GeminiStores["reader"],
  settings: GeminiStores["settings"],
  accounts: GeminiStores["accounts"],
  backend: GeminiStores["backend"],
): GeminiSessionSnapshot {
  const session = reader.read();
  return {
    resolvedSignature: session.kind === "resolved" ? JSON.stringify(session.value) : null,
    settings: settings.snapshot(),
    accounts: accounts.snapshot(),
    backend: backend.snapshot(),
  };
}

async function waitForSignedInSession(
  stores: GeminiStores,
  baseline: GeminiSessionSnapshot,
): Promise<ReturnType<GeminiStores["reader"]["read"]>> {
  const deadline = Date.now() + loginTimeoutMs;
  let latest = stores.reader.read();

  while (Date.now() < deadline) {
    syncNestedGeminiHome(stores);
    latest = stores.reader.read();
    if (
      latest.kind === "resolved"
      && didSessionChange(
        baseline,
        stores.settings,
        stores.accounts,
        stores.backend,
        latest.value,
      )
    ) {
      return latest;
    }

    await new Promise((resolve) => setTimeout(resolve, loginPollIntervalMs));
  }

  if (latest.kind === "resolved" && baseline.resolvedSignature === null) {
    return latest;
  }

  throw new Error(
    "Gemini sign-in did not produce a new local Gemini CLI session. Finish the login flow in the opened Terminal window, then try again or use Import local Gemini CLI session.",
  );
}

function syncNestedGeminiHome(stores: GeminiStores): void {
  const nested = GeminiSessionStores.open(join(stores.geminiHome, ".gemini"));
  const nestedSession = nested.reader.read();
  if (nestedSession.kind !== "resolved") {
    return;
  }

  stores.settings.restore(nested.settings.snapshot());
  stores.accounts.restore(nested.accounts.snapshot());
  stores.backend.restoreSnapshot(nested.backend.snapshot());
}

function didSessionChange(
  baseline: GeminiSessionSnapshot,
  settings: GeminiStores["settings"],
  accounts: GeminiStores["accounts"],
  backend: GeminiStores["backend"],
  session: NonNullable<Extract<ReturnType<GeminiStores["reader"]["read"]>, { kind: "resolved" }>["value"]>,
): boolean {
  if (baseline.resolvedSignature !== JSON.stringify(session)) {
    return true;
  }

  const currentBackend = backend.snapshot();
  return baseline.settings !== settings.snapshot()
    || baseline.accounts !== accounts.snapshot()
    || baseline.backend.keychain !== currentBackend.keychain
    || baseline.backend.file !== currentBackend.file;
}

function createTemporaryGeminiHome(): string {
  const loginRoot = mkdtempSync(join(tmpdir(), "nile-gemini-login-"));
  const geminiHome = join(loginRoot, ".gemini");
  mkdirSync(geminiHome, { recursive: true });
  return geminiHome;
}
