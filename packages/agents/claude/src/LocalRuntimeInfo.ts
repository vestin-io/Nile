import type { AgentLocalRuntimeInfoProvider } from "@nile/core/models/agent/module/LocalRuntimeInfo";
import { RuntimeCommandResolver } from "@nile/core/services/RuntimeCommandResolver";
import { ShellPath } from "@nile/core/services/ShellPath";

const resolver = new RuntimeCommandResolver("claude");

export const CLAUDE_LOCAL_RUNTIME_INFO = {
  read(context) {
    const explicitResolution = resolver.resolveExplicit(context.runtimeCommandPathOverride);
    if (explicitResolution.command) {
      return {
        runtimeCommandPath: explicitResolution.command,
      };
    }
    if (context.runtimeCommandPathOverride?.trim()) {
      return {
        runtimeCommandPath: null,
      };
    }

    const pathValue = ShellPath.merge(process.env.PATH, context.environment.read("PATH"));
    const resolution = resolver.resolve(pathValue ?? "", {
      homeDirectory: context.environment.read("HOME") ?? process.env.HOME,
    });
    return {
      runtimeCommandPath: resolution.command,
    };
  },
} as const satisfies AgentLocalRuntimeInfoProvider;
