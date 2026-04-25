import { execFileSync } from "node:child_process";

type ExecFile = typeof execFileSync;
const LOGIN_SHELL_TIMEOUT_MS = 1_500;
const LOGIN_SHELL_MAX_BUFFER = 1_024 * 1_024;

export class ShellEnvironment {
  constructor(private readonly execFile: ExecFile = execFileSync) {}

  readLoginShellEnvironment(): Record<string, string | undefined> {
    const values: Record<string, string | undefined> = { ...process.env };

    try {
      const output = this.execFile("/bin/zsh", ["-lc", "env"], {
        encoding: "utf8",
        stdio: ["ignore", "pipe", "ignore"],
        timeout: LOGIN_SHELL_TIMEOUT_MS,
        maxBuffer: LOGIN_SHELL_MAX_BUFFER,
      });
      for (const line of output.split("\n")) {
        const index = line.indexOf("=");
        if (index <= 0) {
          continue;
        }
        const key = line.slice(0, index).trim();
        const value = line.slice(index + 1);
        if (key) {
          values[key] = value;
        }
      }
    } catch {
      return values;
    }

    return values;
  }
}
