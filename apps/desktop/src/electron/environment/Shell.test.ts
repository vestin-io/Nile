import { chmodSync, mkdirSync, mkdtempSync, readFileSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { execFileSync } from "node:child_process";
import { afterEach, describe, expect, it } from "vitest";

import { DesktopShellEnvironment } from "./Shell";

const tempDirs: string[] = [];

afterEach(() => {
  while (tempDirs.length > 0) {
    rmSync(tempDirs.pop()!, { recursive: true, force: true });
  }
});

describe("DesktopShellEnvironment", () => {
  it("writes managed shell scripts and sources them from common posix shell profiles", () => {
    const setup = createSetup();
    const environment = new DesktopShellEnvironment({
      homeDir: setup.homeDir,
      indexPath: setup.indexPath,
      posixScriptPath: setup.posixScriptPath,
      fishScriptPath: setup.fishScriptPath,
      posixProfilePaths: setup.posixProfiles,
    });

    environment.ensure("NILE_GATEWAY_TEST_API_KEY");

    expect(readFileSync(setup.indexPath, "utf8")).toContain("NILE_GATEWAY_TEST_API_KEY");
    expect(readFileSync(setup.posixScriptPath, "utf8")).toContain('"/usr/bin/security" find-generic-password');
    expect(readFileSync(setup.posixScriptPath, "utf8")).toContain("export NILE_GATEWAY_TEST_API_KEY");
    expect(readFileSync(setup.fishScriptPath, "utf8")).toContain("set -gx NILE_GATEWAY_TEST_API_KEY");
    for (const profilePath of setup.posixProfiles) {
      expect(readFileSync(profilePath, "utf8")).toContain("# BEGIN nile-switcher managed environment");
      expect(readFileSync(profilePath, "utf8")).toContain("NILE_SWITCHER_MANAGED_ENV_LOADED");
      expect(readFileSync(profilePath, "utf8")).toContain(setup.posixScriptPath);
    }
  });

  it("removes managed shell wiring when the last env key is removed", () => {
    const setup = createSetup();
    for (const profilePath of setup.posixProfiles) {
      writeFileSync(profilePath, "# user profile\n", "utf8");
    }
    const environment = new DesktopShellEnvironment({
      homeDir: setup.homeDir,
      indexPath: setup.indexPath,
      posixScriptPath: setup.posixScriptPath,
      fishScriptPath: setup.fishScriptPath,
      posixProfilePaths: setup.posixProfiles,
    });

    environment.ensure("NILE_GATEWAY_TEST_API_KEY");
    environment.remove("NILE_GATEWAY_TEST_API_KEY");

    expect(() => readFileSync(setup.indexPath, "utf8")).toThrow();
    expect(() => readFileSync(setup.posixScriptPath, "utf8")).toThrow();
    expect(() => readFileSync(setup.fishScriptPath, "utf8")).toThrow();
    for (const profilePath of setup.posixProfiles) {
      expect(readFileSync(profilePath, "utf8")).toBe("# user profile\n");
    }
  });

  it("preserves empty profile files when removing the managed block", () => {
    const setup = createSetup();
    writeFileSync(setup.posixProfiles[0], "", "utf8");
    const environment = new DesktopShellEnvironment({
      homeDir: setup.homeDir,
      indexPath: setup.indexPath,
      posixScriptPath: setup.posixScriptPath,
      fishScriptPath: setup.fishScriptPath,
      posixProfilePaths: setup.posixProfiles,
    });

    environment.ensure("NILE_GATEWAY_TEST_API_KEY");
    environment.remove("NILE_GATEWAY_TEST_API_KEY");

    expect(readFileSync(setup.posixProfiles[0], "utf8")).toBe("");
  });

  it("exports managed env vars when the generated posix script runs in sh", () => {
    const setup = createSetup();
    const securityPath = join(setup.homeDir, "bin", "security");
    mkdirSync(join(setup.homeDir, "bin"), { recursive: true });
    writeFileSync(
      securityPath,
      [
        "#!/bin/sh",
        "account=\"\"",
        "while [ \"$#\" -gt 0 ]; do",
        "  case \"$1\" in",
        "    -a)",
        "      account=\"$2\"",
        "      shift 2",
        "      ;;",
        "    *)",
        "      shift",
        "      ;;",
        "  esac",
        "done",
        "if [ \"$account\" = \"NILE_GATEWAY_TEST_API_KEY\" ]; then",
        "  printf '%s' 'resolved-secret'",
        "  exit 0",
        "fi",
        "exit 1",
        "",
      ].join("\n"),
      "utf8",
    );
    chmodSync(securityPath, 0o755);

    const environment = new DesktopShellEnvironment({
      homeDir: setup.homeDir,
      indexPath: setup.indexPath,
      posixScriptPath: setup.posixScriptPath,
      fishScriptPath: setup.fishScriptPath,
      posixProfilePaths: setup.posixProfiles,
      securityCommandPath: securityPath,
    });

    environment.ensure("NILE_GATEWAY_TEST_API_KEY");

    const exportedValue = execFileSync(
      "/bin/sh",
      ["-c", `. "${setup.posixScriptPath}"; printf '%s' "$NILE_GATEWAY_TEST_API_KEY"`],
      { encoding: "utf8" },
    );

    expect(exportedValue).toBe("resolved-secret");
  });

  it("refuses to manage shell environment through symlinked profile files", () => {
    const setup = createSetup();
    const targetPath = join(setup.homeDir, "linked-profile");
    writeFileSync(targetPath, "# external profile\n", "utf8");
    rmSync(setup.posixProfiles[0], { force: true });
    symlinkSync(targetPath, setup.posixProfiles[0]);

    const environment = new DesktopShellEnvironment({
      homeDir: setup.homeDir,
      indexPath: setup.indexPath,
      posixScriptPath: setup.posixScriptPath,
      fishScriptPath: setup.fishScriptPath,
      posixProfilePaths: setup.posixProfiles,
    });

    expect(() => environment.ensure("NILE_GATEWAY_TEST_API_KEY")).toThrow(
      "Refusing to manage shell environment through symlinked path",
    );
  });
});

function createSetup(): {
  homeDir: string;
  indexPath: string;
  posixScriptPath: string;
  fishScriptPath: string;
  posixProfiles: string[];
} {
  const homeDir = mkdtempSync(join(tmpdir(), "nile-shell-environment-"));
  tempDirs.push(homeDir);
  return {
    homeDir,
    indexPath: join(homeDir, ".nile-switcher", "environment", "managed-keys.json"),
    posixScriptPath: join(homeDir, ".nile-switcher", "environment", "managed.sh"),
    fishScriptPath: join(homeDir, ".config", "fish", "conf.d", "nile-switcher-managed.fish"),
    posixProfiles: [
      join(homeDir, ".zprofile"),
      join(homeDir, ".bash_profile"),
      join(homeDir, ".profile"),
    ],
  };
}
