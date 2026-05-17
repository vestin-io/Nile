import { CONNECTION_PRESET_MODULES } from "./Modules";

type PresetIdTuple<TModules extends readonly { manifest: { id: string } }[]> = {
  readonly [Index in keyof TModules]: TModules[Index] extends { manifest: { id: infer Id extends string } }
    ? Id
    : never;
};

function readPresetIds<TModules extends readonly { manifest: { id: string } }[]>(
  modules: TModules,
): PresetIdTuple<TModules> {
  return modules.map((module) => module.manifest.id) as PresetIdTuple<TModules>;
}

export const SUPPORTED_CONNECTION_PRESET_FAMILIES = readPresetIds(CONNECTION_PRESET_MODULES);

export type ConnectionPresetFamily = (typeof CONNECTION_PRESET_MODULES)[number]["manifest"]["id"];
