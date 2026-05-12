import { EnvironmentSource } from "@nile/core/services/EnvironmentSource";

import { DesktopEnvironmentStore } from "./Store";

export class DesktopEnvironmentSource extends EnvironmentSource {
  private readonly fallback: EnvironmentSource;

  constructor(
    values: Readonly<Record<string, string | undefined>>,
    private readonly store: DesktopEnvironmentStore,
  ) {
    super({});
    this.fallback = EnvironmentSource.from(values);
  }

  override read(key: string | undefined): string | null {
    if (!key) {
      return null;
    }

    try {
      const managedValue = this.store.read(key);
      if (managedValue) {
        return managedValue;
      }
    } catch {
      return this.fallback.read(key);
    }

    return this.fallback.read(key);
  }
}
