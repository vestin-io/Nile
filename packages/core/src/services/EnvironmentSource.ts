export class EnvironmentSource {
  static empty(): EnvironmentSource {
    return new EnvironmentSource({});
  }

  static from(values: Readonly<Record<string, string | undefined>>): EnvironmentSource {
    return new EnvironmentSource(values);
  }

  constructor(private readonly values: Readonly<Record<string, string | undefined>>) {}

  read(key: string | undefined): string | null {
    if (!key) {
      return null;
    }

    const value = this.values[key];
    if (typeof value !== "string") {
      return null;
    }

    const normalized = value.trim();
    return normalized ? normalized : null;
  }
}
