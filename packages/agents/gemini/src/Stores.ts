import { GeminiAccountsStore } from "./AccountsStore";
import { GeminiCredentialBackend } from "./Backend";
import { GeminiCredentialStore } from "./CredentialStore";
import { GEMINI_HOME_RESOLVER } from "./Home";
import { GeminiKeychainCredentialStore } from "./KeychainStore";
import { GeminiSessionReader } from "./Reader";
import { GeminiSettingsStore } from "./SettingsStore";

export class GeminiSessionStores {
  static open(geminiHome: string): GeminiSessionStores {
    return new GeminiSessionStores(GEMINI_HOME_RESOLVER.resolve(geminiHome));
  }

  readonly settings: GeminiSettingsStore;
  readonly accounts: GeminiAccountsStore;
  readonly backend: GeminiCredentialBackend;
  readonly reader: GeminiSessionReader;

  private constructor(readonly geminiHome: string) {
    this.settings = new GeminiSettingsStore(geminiHome);
    this.accounts = new GeminiAccountsStore(geminiHome);
    this.backend = new GeminiCredentialBackend(
      new GeminiCredentialStore(geminiHome),
      new GeminiKeychainCredentialStore(),
    );
    this.reader = new GeminiSessionReader(
      this.backend,
      this.accounts,
      this.settings,
    );
  }
}
