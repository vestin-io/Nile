import { existsSync } from "node:fs";
import { join } from "node:path";

const sessionMarkers = ["settings.json", "google_accounts.json", "oauth_creds.json"] as const;

export class GeminiHomeResolver {
  constructor(
    private readonly pathExists: (path: string) => boolean = existsSync,
  ) {}

  resolve(geminiHome: string): string {
    const nestedHome = join(geminiHome, ".gemini");
    if (this.hasSessionMarkers(nestedHome)) {
      return nestedHome;
    }
    return geminiHome;
  }

  private hasSessionMarkers(geminiHome: string): boolean {
    return sessionMarkers.every((marker) => this.pathExists(join(geminiHome, marker)));
  }
}

export const GEMINI_HOME_RESOLVER = new GeminiHomeResolver();
