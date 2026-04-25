export class ConnectionNaming {
  static createSlug(value: string): string {
    const normalized = value
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "");

    return normalized || "default";
  }

  static createUniqueId(baseValue: string, existingIds: string[]): string {
    const baseId = ConnectionNaming.createSlug(baseValue);
    const existing = new Set(existingIds);
    if (!existing.has(baseId)) {
      return baseId;
    }

    let index = 2;
    while (existing.has(`${baseId}-${index}`)) {
      index += 1;
    }
    return `${baseId}-${index}`;
  }

  static prettifyHost(value: string): string | null {
    try {
      const url = new URL(value);
      return url.host || null;
    } catch {
      return null;
    }
  }

  static prettifyAzureResource(value: string): string | null {
    const host = ConnectionNaming.prettifyHost(value);
    if (!host) {
      return null;
    }

    const azureSuffix = ".cognitiveservices.azure.com";
    if (host.endsWith(azureSuffix)) {
      return host.slice(0, -azureSuffix.length) || null;
    }

    return host.split(".")[0] || null;
  }
}
