import type { ConnectionEndpointModule } from "./Types";

const GEMINI_ROOT_URL = "https://generativelanguage.googleapis.com";

export function createGeminiEndpointModule(): ConnectionEndpointModule {
  return {
    preset: "gemini",
    async build() {
      return {
        id: "gemini",
        label: "Gemini",
        rootUrl: GEMINI_ROOT_URL,
        profile: "gemini-cli",
        protocols: {
          gemini: {
            authTypes: ["oauth-personal"],
          },
        },
      };
    },
  };
}
