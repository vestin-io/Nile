import { describe, expect, it } from "vitest";

import {
  formatAgentLabel,
  listAgentManifests,
  readAgentManifest,
} from "./Manifest";
import { SUPPORTED_AGENT_IDS, isAgentId } from "../Ids";

describe("AgentRegistry", () => {
  it("uses one manifest entry per supported agent", () => {
    expect(listAgentManifests().map((manifest) => manifest.id)).toEqual(SUPPORTED_AGENT_IDS);
  });

  it("reads manifest-owned metadata for Gemini", () => {
    expect(readAgentManifest("gemini")).toMatchObject({
      id: "gemini",
      label: "Gemini",
      iconKey: "gemini",
      connectionEntryMode: "configure_or_import",
      supportedConnectionFamilyIds: ["gemini-cli-session"],
    });
  });

  it("narrows supported agent ids through the registry", () => {
    expect(isAgentId("codex")).toBe(true);
    expect(isAgentId("unknown")).toBe(false);
  });

  it("formats unknown agents defensively", () => {
    expect(formatAgentLabel("openclaw")).toBe("OpenClaw");
    expect(formatAgentLabel("mystery")).toBe("Mystery");
  });
});
