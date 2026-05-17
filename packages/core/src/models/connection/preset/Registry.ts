import { IndexedRegistry } from "../../../services/IndexedRegistry";
import { CONNECTION_PRESET_MODULES } from "./Modules";
import type { ConnectionPresetManifest } from "./ManifestTypes";
import type { ConnectionPresetFamily } from "./Types";

type RegisteredConnectionPresetModule = (typeof CONNECTION_PRESET_MODULES)[number];
type RegisteredConnectionPresetManifest = ConnectionPresetManifest<ConnectionPresetFamily>;

export class ConnectionPresetRegistry {
  private readonly modules = new IndexedRegistry<ConnectionPresetFamily, RegisteredConnectionPresetModule>(
    CONNECTION_PRESET_MODULES,
    (module) => module.manifest.id,
    (preset) => `Unsupported connection preset: ${preset}`,
  );

  list(): RegisteredConnectionPresetManifest[] {
    return this.modules.list().map((module) => module.manifest);
  }

  read(preset: string): RegisteredConnectionPresetManifest | null {
    const manifest = this.list().find((candidate) => candidate.id === preset);
    return manifest ?? null;
  }

  readRequired(preset: ConnectionPresetFamily): RegisteredConnectionPresetManifest {
    return this.modules.read(preset).manifest;
  }

  readModule(preset: ConnectionPresetFamily): RegisteredConnectionPresetModule {
    return this.modules.read(preset);
  }
}

export const CONNECTION_PRESET_REGISTRY = new ConnectionPresetRegistry();
