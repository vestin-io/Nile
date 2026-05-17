import type { AuthMode } from "@nile/core/models/access";
import type { StoredCredential } from "@nile/core/services/credential/Types";
import { CONNECTION_FAMILY_REGISTRY } from "@nile/core/models/connection/family";

export class ConnectionIdentityKeyResolver {
  resolve(authMode: AuthMode, credential: StoredCredential): string | null {
    for (const family of CONNECTION_FAMILY_REGISTRY.listModules()) {
      if (family.manifest.authMode !== authMode || !family.behaviors.identityKeyReader) {
        continue;
      }
      return family.behaviors.identityKeyReader.resolve(credential);
    }
    return null;
  }
}
