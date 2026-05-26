import { delimiter } from "node:path";

export class ShellPath {
  static merge(primary: string | undefined, secondary: string | null): string | undefined {
    const entries = [
      ...(primary?.split(delimiter) ?? []),
      ...(secondary?.split(delimiter) ?? []),
    ].map((entry) => entry.trim()).filter(Boolean);
    if (entries.length === 0) {
      return undefined;
    }
    return [...new Set(entries)].join(delimiter);
  }
}
