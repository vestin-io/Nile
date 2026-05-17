import { AGENT_MODULE_REGISTRY } from "../models/agent/module/Registry";
import { IndexedRegistry } from "../services/IndexedRegistry";
import type {
  InteractiveSessionLoginContext,
  InteractiveSessionLoginInteractionMode,
  InteractiveSessionLoginManifest,
  InteractiveSessionLoginRequest,
  InteractiveSessionLoginStoredCredential,
} from "./LoginTypes";
export type {
  InteractiveSessionLoginContext,
  InteractiveSessionLoginInteractionMode,
  InteractiveSessionLoginManifest,
  InteractiveSessionLoginRequest,
  InteractiveSessionLoginStoredCredential,
} from "./LoginTypes";

export function listInteractiveSessionLoginManifests(): InteractiveSessionLoginManifest[] {
  return AGENT_MODULE_REGISTRY.list().flatMap((module) =>
    module.interactiveSessionLogin ? [module.interactiveSessionLogin] : []);
}

export class InteractiveSessionLoginRegistry {
  list(): InteractiveSessionLoginManifest[] {
    return this.buildIndex().list();
  }

  read(authMode: InteractiveSessionLoginRequest["authMode"]): InteractiveSessionLoginManifest {
    return this.buildIndex().read(authMode);
  }

  readInteractionMode(
    authMode: InteractiveSessionLoginRequest["authMode"],
  ): InteractiveSessionLoginInteractionMode {
    return this.read(authMode).interactionMode;
  }

  async signInAndRead(
    context: InteractiveSessionLoginContext,
    request: InteractiveSessionLoginRequest,
  ): Promise<InteractiveSessionLoginStoredCredential> {
    return await this.read(request.authMode).signInAndRead(context, request);
  }

  private buildIndex() {
    return new IndexedRegistry(
      listInteractiveSessionLoginManifests(),
      (manifest: InteractiveSessionLoginManifest) => manifest.authMode,
      (authMode: InteractiveSessionLoginRequest["authMode"]) =>
        `Unsupported interactive session login auth mode: ${authMode}`,
    );
  }
}

export const INTERACTIVE_SESSION_LOGIN_REGISTRY = new InteractiveSessionLoginRegistry();
