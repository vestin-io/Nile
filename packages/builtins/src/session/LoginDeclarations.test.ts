import { describe, expect, it } from "vitest";

import { INTERACTIVE_SESSION_LOGIN_REGISTRY } from "@nile/core/session";

import {
  BUILTIN_INTERACTIVE_SESSION_LOGIN_DECLARATIONS,
  readBuiltinInteractiveSessionLoginDeclaration,
} from "./LoginDeclarations";

describe("BUILTIN_INTERACTIVE_SESSION_LOGIN_DECLARATIONS", () => {
  it("stays aligned with the runtime interactive login registry", () => {
    const registryAuthModes = INTERACTIVE_SESSION_LOGIN_REGISTRY.list()
      .map((manifest) => manifest.authMode)
      .sort();
    const declarationAuthModes = BUILTIN_INTERACTIVE_SESSION_LOGIN_DECLARATIONS
      .map((declaration) => declaration.authMode)
      .sort();

    expect(declarationAuthModes).toEqual(registryAuthModes);
  });

  it("matches interaction mode metadata from the runtime registry", () => {
    for (const declaration of BUILTIN_INTERACTIVE_SESSION_LOGIN_DECLARATIONS) {
      expect(readBuiltinInteractiveSessionLoginDeclaration(declaration.authMode)).toMatchObject({
        authMode: declaration.authMode,
        interactionMode: INTERACTIVE_SESSION_LOGIN_REGISTRY.read(declaration.authMode).interactionMode,
      });
    }
  });
});
