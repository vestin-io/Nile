import { describe, expect, it } from "vitest";

import { LOCAL_MODEL_CATALOG_SOURCE_REGISTRY } from "./ModelCatalogSource";

describe("LocalModelCatalogSourceRegistry", () => {
  it("registers the Claude gateway cache source", () => {
    expect(LOCAL_MODEL_CATALOG_SOURCE_REGISTRY.list().map((manifest) => manifest.id)).toEqual([
      "claude-gateway-cache",
    ]);
  });

  it("reads local model catalog ownership from agent modules", () => {
    expect(LOCAL_MODEL_CATALOG_SOURCE_REGISTRY.list()).toHaveLength(1);
  });
});
