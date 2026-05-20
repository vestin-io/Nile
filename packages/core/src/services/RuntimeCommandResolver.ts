import { existsSync } from "node:fs";

import { listCommandsInNvm, listCommandsInPath } from "./RuntimeCommandDiscovery";

export type RuntimeCommandResolution = {
  command: string | null;
};

type RuntimeCommandResolutionOptions = {
  homeDirectory?: string | null;
};

export class RuntimeCommandResolver {
  constructor(
    private readonly commandName: string,
    private readonly pathExists: (path: string) => boolean = existsSync,
  ) {}

  resolve(pathValue: string, options: RuntimeCommandResolutionOptions = {}): RuntimeCommandResolution {
    for (const command of listCommandsInPath(pathValue, this.commandName)) {
      if (this.pathExists(command)) {
        return { command };
      }
    }

    for (const command of listCommandsInNvm(this.commandName, options.homeDirectory)) {
      if (this.pathExists(command)) {
        return { command };
      }
    }

    return { command: null };
  }

  resolveExplicit(commandPath: string | null | undefined): RuntimeCommandResolution {
    const normalized = commandPath?.trim();
    if (!normalized) {
      return { command: null };
    }

    return {
      command: this.pathExists(normalized) ? normalized : null,
    };
  }
}
