import { SHARED_CONNECTION_PRESET_SUPPORT, type ConnectionDefinition } from "./PresetSupport";

export type { ConnectionDefinition } from "./PresetSupport";

export class ConnectionCatalog {
  listDefinitions(): ConnectionDefinition[] {
    return SHARED_CONNECTION_PRESET_SUPPORT.listDefinitions();
  }

  getDefinition(preset: string): ConnectionDefinition | null {
    return SHARED_CONNECTION_PRESET_SUPPORT.readDefinition(preset);
  }
}

export const SHARED_CONNECTION_CATALOG = new ConnectionCatalog();
