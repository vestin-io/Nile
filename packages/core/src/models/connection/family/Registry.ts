import { IndexedRegistry } from "../../../services/IndexedRegistry";
import type { AuthMode } from "../../access/AuthMode";
import type { EndpointProtocols } from "../../endpoint";
import type { ConnectionPresetFamily } from "../preset";
import type { ConnectionFamilyId, ConnectionFamilyProtocolKey } from "./Types";
import type { CurrentSessionSourceId } from "../SourceTypes";
import type { ConnectionFamilyManifestDefinition } from "./ManifestTypes";
import type { ConnectionFamilyModule } from "./ModuleTypes";

type ConnectionSupportProtocols = Pick<EndpointProtocols, "openai" | "anthropic" | "cursor" | "gemini">;

type ReadSavedFamilyIdsInput = {
  protocols: ConnectionSupportProtocols;
  authMode: AuthMode;
};

type ReadSelectableFamilyIdsInput = {
  preset: ConnectionPresetFamily;
  authMode: AuthMode;
};

export class ConnectionFamilyRegistry {
  private modules: IndexedRegistry<ConnectionFamilyId, ConnectionFamilyModule>;

  constructor(modules: readonly ConnectionFamilyModule[]) {
    this.modules = this.buildIndex(modules);
  }

  register(modules: readonly ConnectionFamilyModule[]): void {
    this.modules = this.buildIndex(modules);
  }

  list(): ConnectionFamilyManifestDefinition[] {
    return this.modules.list().map((module) => module.manifest);
  }

  listModules(): ConnectionFamilyModule[] {
    return this.modules.list();
  }

  read(familyId: ConnectionFamilyId): ConnectionFamilyManifestDefinition {
    return this.readModule(familyId).manifest;
  }

  readModule(familyId: ConnectionFamilyId): ConnectionFamilyModule {
    return this.modules.read(familyId);
  }

  readDetectedApiKeyFamilyIds(protocols: ConnectionSupportProtocols): ConnectionFamilyId[] {
    return this.readByAuthMode("api_key").flatMap((manifest) =>
      this.hasProtocol(protocols, manifest.protocol) ? [manifest.id] : []);
  }

  readSavedFamilyIds(input: ReadSavedFamilyIdsInput): ConnectionFamilyId[] {
    return this.readByAuthMode(input.authMode).flatMap((manifest) =>
      this.hasProtocol(input.protocols, manifest.protocol) ? [manifest.id] : []);
  }

  readSelectableFamilyIds(input: ReadSelectableFamilyIdsInput): ConnectionFamilyId[] {
    return this.readByAuthMode(input.authMode).flatMap((manifest) =>
      manifest.selectablePresets.includes(input.preset) ? [manifest.id] : []);
  }

  readModulesByAuthMode(authMode: AuthMode): ConnectionFamilyModule[] {
    return this.modules.list().filter((module) => module.manifest.authMode === authMode);
  }

  readCurrentSessionSourceIds(familyId: ConnectionFamilyId): CurrentSessionSourceId[] {
    return [...this.read(familyId).currentSessionSourceIds];
  }

  private readByAuthMode(authMode: AuthMode): ConnectionFamilyManifestDefinition[] {
    return this.modules.list().map((m) => m.manifest).filter((manifest) => manifest.authMode === authMode);
  }

  private hasProtocol(
    protocols: ConnectionSupportProtocols,
    protocol: ConnectionFamilyProtocolKey,
  ): boolean {
    return Boolean(protocols[protocol]);
  }

  private buildIndex(modules: readonly ConnectionFamilyModule[]) {
    return new IndexedRegistry<ConnectionFamilyId, ConnectionFamilyModule>(
      modules,
      (module) => module.manifest.id,
      (familyId) => `Unsupported connection family: ${familyId}`,
    );
  }
}

export const CONNECTION_FAMILY_REGISTRY = new ConnectionFamilyRegistry([]);

