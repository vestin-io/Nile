import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const connectionDir = dirname(fileURLToPath(import.meta.url));
const packageRoot = join(connectionDir, "..", "..", "..");
const coreSrcRoot = join(packageRoot, "src");
const repoRoot = join(packageRoot, "..", "..");

describe("connection architecture guards", () => {
  it("keeps shared-connection compatibility on the central policy path", () => {
    const files = [
      join(coreSrcRoot, "actions", "live-setup", "Import.ts"),
      join(connectionDir, "SavedConnections.ts"),
      join(connectionDir, "setup", "OnboardingPolicy.ts"),
    ];

    for (const path of files) {
      const source = readFileSync(path, "utf8");
      expect(source).toContain("SHARED_CONNECTION_AGENT_POLICY");
    }
  });

  it("keeps renderer apply and switch flows free of hardcoded agent-id branches", () => {
    const files = [
      join(repoRoot, "apps", "desktop", "src", "renderer", "shared", "ApplyRequirements.ts"),
      join(repoRoot, "apps", "desktop", "src", "renderer", "quick-setup", "ConnectionDialog.tsx"),
      join(repoRoot, "apps", "desktop", "src", "renderer", "agents", "detail", "ModelEditor.tsx"),
      join(repoRoot, "apps", "desktop", "src", "renderer", "agents", "useConnectionSwitchFlow.ts"),
    ];
    const hardcodedAgentPattern = /["'](?:codex|cursor|claude|openclaw)["']/;

    for (const path of files) {
      const source = readFileSync(path, "utf8");
      expect(source).not.toMatch(hardcodedAgentPattern);
    }
  });
});
