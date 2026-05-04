import { spawnSync } from "node:child_process";

export type SecurityCliResult = {
  exitCode: number;
  stdout: string;
  stderr: string;
};

export class SecurityCli {
  run(args: string[]): SecurityCliResult {
    const result = spawnSync("security", args, { encoding: "utf8" });
    return {
      exitCode: result.status ?? 1,
      stdout: result.stdout ?? "",
      stderr: result.stderr ?? "",
    };
  }

  runWithSecretPrompt(args: string[], secret: string): SecurityCliResult {
    const result = spawnSync("security", args, {
      encoding: "utf8",
      input: `${secret}\n`,
    });
    return {
      exitCode: result.status ?? 1,
      stdout: result.stdout ?? "",
      stderr: result.stderr ?? "",
    };
  }
}
