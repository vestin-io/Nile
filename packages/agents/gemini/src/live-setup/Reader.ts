import { GeminiSessionReader } from "../Reader";
import type { ReadLiveSetupResult } from "./Internal";

const GEMINI_ENDPOINT_ID = "gemini";
const GEMINI_ROOT_URL = "https://generativelanguage.googleapis.com";

export class LiveSetupReader {
  constructor(private readonly sessionReader: GeminiSessionReader) {}

  read(): ReadLiveSetupResult {
    const session = this.sessionReader.read();
    if (session.kind !== "resolved") {
      return session;
    }

    return {
      kind: "resolved",
      value: {
        endpoint: {
          id: GEMINI_ENDPOINT_ID,
          label: "Gemini",
          rootUrl: GEMINI_ROOT_URL,
          profile: "gemini-cli",
          protocols: {
            gemini: {
              authTypes: ["oauth-personal"],
            },
          },
        },
        access: {
          label: session.value.labelHint,
          authMode: "gemini_cli_session",
          identityKey: session.value.identityKey,
        },
        detectedEndpoint: {
          endpointFamily: "gemini",
          endpointIdHint: GEMINI_ENDPOINT_ID,
          labelHint: "Gemini",
          baseUrl: GEMINI_ROOT_URL,
        },
        credential: {
          kind: "gemini_cli_session",
          ...session.value.credential,
        },
        detectedAccess: {
          authMode: "gemini_cli_session",
          labelHint: session.value.labelHint,
          identityKey: session.value.identityKey,
        },
      },
    };
  }
}
