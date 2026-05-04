import { spawnSync, type SpawnSyncReturns } from "node:child_process";

export type SecurityCliResult = {
  exitCode: number;
  stdout: string;
  stderr: string;
};

type SpawnSyncFn = (
  command: string,
  args: readonly string[],
  options: {
    encoding: "utf8";
    input?: string;
  },
) => SpawnSyncReturns<string>;

export class SecurityCli {
  constructor(private readonly spawn: SpawnSyncFn = spawnSync) {}

  run(args: string[]): SecurityCliResult {
    const result = this.spawn("security", args, { encoding: "utf8" });
    return {
      exitCode: result.status ?? 1,
      stdout: result.stdout ?? "",
      stderr: result.stderr ?? "",
    };
  }

  runWithSecretData(args: string[], secret: string): SecurityCliResult {
    const result = this.spawn("security", rewriteSecretArgs(args, secret), { encoding: "utf8" });
    return {
      exitCode: result.status ?? 1,
      stdout: result.stdout ?? "",
      stderr: result.stderr ?? "",
    };
  }
}

function rewriteSecretArgs(args: string[], secret: string): string[] {
  const flagIndex = args.lastIndexOf("-w");
  if (flagIndex === -1) {
    throw new Error("security secret writes require a trailing -w placeholder");
  }

  return [
    ...args.slice(0, flagIndex),
    "-w",
    secret,
    ...args.slice(flagIndex + 1),
  ];
}
