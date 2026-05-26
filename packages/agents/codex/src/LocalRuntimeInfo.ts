import type { AgentLocalRuntimeInfoProvider } from "@nile/core/models/agent/module/LocalRuntimeInfo";
import { ShellPath } from "@nile/core/services/ShellPath";
import { CliCommandResolver } from "./CliCommandResolver";

const resolver = new CliCommandResolver();

export const CODEX_LOCAL_RUNTIME_INFO = {
  read(context) {
    const explicitResolution = resolver.resolveExplicit(context.runtimeCommandPathOverride);
    if (explicitResolution.launcherCommand) {
      return {
        runtimeCommandPath: explicitResolution.launcherCommand,
      };
    }
    if (explicitResolution.invalidCommandPaths.length > 0) {
      return {
        runtimeCommandPath: null,
      };
    }

    const pathValue = ShellPath.merge(process.env.PATH, context.environment.read("PATH"));
    const resolution = resolver.resolve(pathValue ?? "", {
      homeDirectory: context.environment.read("HOME") ?? process.env.HOME,
    });
    return {
      runtimeCommandPath: resolution.launcherCommand,
    };
  },
} as const satisfies AgentLocalRuntimeInfoProvider;
