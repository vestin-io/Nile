import type { CurrentSessionSourceId } from "../models/connection/SourceTypes";
import { AGENT_MODULE_REGISTRY } from "../models/agent/module/Registry";
import { IndexedRegistry } from "../services/IndexedRegistry";
import type {
  CurrentSessionSourceManifest,
  CurrentSessionCredentialRequest,
  CurrentSessionResolveContext,
  CurrentSessionStoredCredential,
} from "./Types";

export function listCurrentSessionSourceManifests(): CurrentSessionSourceManifest[] {
  return AGENT_MODULE_REGISTRY.list().flatMap((module) =>
    module.currentSessionSource ? [module.currentSessionSource] : []);
}

export function isCurrentSessionSourceId(value: string): value is CurrentSessionSourceId {
  return listCurrentSessionSourceManifests().some((manifest) => manifest.id === value);
}

export class CurrentSessionSourceRegistry {
  list(): CurrentSessionSourceManifest[] {
    return this.buildIndex().list();
  }

  read(sourceId: CurrentSessionSourceId): CurrentSessionSourceManifest {
    return this.buildIndex().read(sourceId);
  }

  resolve(
    context: CurrentSessionResolveContext,
    request: CurrentSessionCredentialRequest,
  ): CurrentSessionStoredCredential {
    const manifest = this.read(request.source);
    if (request.authMode !== manifest.authMode) {
      throw new Error(`Current session source ${request.source} does not support auth mode ${request.authMode}`);
    }
    return manifest.resolve(context, request);
  }

  private buildIndex() {
    return new IndexedRegistry(
      listCurrentSessionSourceManifests(),
      (manifest: CurrentSessionSourceManifest) => manifest.id,
      (sourceId: CurrentSessionSourceId) => `Unsupported current session source: ${sourceId}`,
    );
  }
}
export const CURRENT_SESSION_SOURCE_REGISTRY = new CurrentSessionSourceRegistry();
