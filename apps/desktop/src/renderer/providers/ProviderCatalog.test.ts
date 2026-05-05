import { describe, expect, it } from "vitest";

import { ProviderCatalog } from "./ProviderCatalog";

describe("ProviderCatalog", () => {
  it("loads localized provider entries from the local catalog json", () => {
    const entries = ProviderCatalog.shared.list("zh");

    expect(entries.length).toBeGreaterThan(0);
    expect(entries[0]).toEqual({
      provider: "Anthropic",
      providerKey: "anthropic",
      officialLink: "https://docs.anthropic.com/",
      description: "Anthropic Claude 官方 API 与文档入口，适合 Claude 系列模型接入。",
    });
  });

  it("falls back to the en translation when the selected language is not defined", () => {
    const catalog = ProviderCatalog.fromUnknown({
      providers: [
        {
          providerKey: "openai",
          officialLink: "https://platform.openai.com/docs/overview",
          translations: {
            en: {
              provider: "OpenAI",
              description: "English description",
            },
          },
        },
      ],
    });

    expect(catalog.list("fr")[0]).toEqual({
      provider: "OpenAI",
      providerKey: "openai",
      officialLink: "https://platform.openai.com/docs/overview",
      description: "English description",
    });
  });

  it("finds a provider by key", () => {
    expect(ProviderCatalog.shared.findByKey("openai", "en")).toEqual({
      provider: "OpenAI",
      providerKey: "openai",
      officialLink: "https://platform.openai.com/docs/overview",
      description: "OpenAI's official model and API platform for general reasoning, generation, and tool-calling workflows.",
    });
    expect(ProviderCatalog.shared.findByKey("gateway", "en")).toBeNull();
  });

  it("rejects entries without an https official link", () => {
    expect(() =>
      ProviderCatalog.fromUnknown({
        providers: [
          {
            providerKey: "bad",
            officialLink: "javascript:alert(1)",
            translations: {
              en: {
                provider: "Bad Provider",
                description: "bad",
              },
            },
          },
        ],
      }),
    ).toThrow("providers[0].officialLink must use https.");
  });
});
