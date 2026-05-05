import type { CommandResult } from "./types";

export class NileCliResultFactory {
  ok(payload: unknown): CommandResult {
    return {
      exitCode: 0,
      stdout: `${JSON.stringify(payload, null, 2)}\n`,
    };
  }

  okText(stdout: string): CommandResult {
    return {
      exitCode: 0,
      stdout: `${stdout}\n`,
    };
  }

  cancelled(): CommandResult {
    return {
      exitCode: 0,
      stdout: "",
    };
  }

  error(error: unknown): CommandResult {
    return {
      exitCode: 1,
      stdout: "",
      stderr: error instanceof Error ? error.message : String(error),
    };
  }
}
