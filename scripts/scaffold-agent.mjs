#!/usr/bin/env node

import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const rootDir = dirname(dirname(fileURLToPath(import.meta.url)));
const agentsDir = join(rootDir, "packages", "core", "src", "agents");

const options = readOptions(process.argv.slice(2));
if (options.help) {
  printHelp();
  process.exit(0);
}

const agentId = options.id;
const agentLabel = options.label;
if (!agentId || !agentLabel) {
  printHelp();
  process.exit(1);
}

if (!/^[a-z][a-z0-9-]*$/.test(agentId)) {
  throw new Error(`Invalid agent id: ${agentId}. Use lowercase kebab-case like "gemini".`);
}

const classPrefix = toPascalCase(agentId);
const agentDir = join(agentsDir, agentId);
if (existsSync(agentDir)) {
  throw new Error(`Agent directory already exists: ${agentDir}`);
}

const files = buildFiles({ agentDir, agentId, agentLabel, classPrefix });
for (const file of files) {
  if (options.dryRun) {
    process.stdout.write(`[dry-run] create ${file.path}\n`);
    continue;
  }
  mkdirSync(dirname(file.path), { recursive: true });
  writeFileSync(file.path, file.contents, "utf8");
  process.stdout.write(`created ${file.path}\n`);
}

if (options.dryRun) {
  process.stdout.write(`\nNext step: run without --dry-run, then follow docs/development/add-agent.md.\n`);
  process.exit(0);
}

process.stdout.write(
  `\nScaffolded ${agentLabel} under packages/core/src/agents/${agentId}.\n`
  + "Next step: update docs/development/add-agent.md checklist items for registration and tests.\n",
);

function buildFiles(input) {
  const { agentDir, agentId, agentLabel, classPrefix } = input;
  const constName = `${toConstantCase(agentId)}_AGENT_ID`;

  return [
    {
      path: join(agentDir, "types.ts"),
      contents: `import type { AgentId } from "../../models/agent/Types";
import type { AgentLiveStateValidity, MatchedAgentConnection } from "../../models/agent";
import type { EndpointFamily } from "../../models/endpoint";

export const ${constName}: AgentId = "${agentId}";

export type ${classPrefix}DetectedEndpoint = {
  endpointFamily: EndpointFamily | "unknown";
  endpointIdHint: string;
  labelHint: string;
  baseUrl?: string;
  wireApi?: string;
  envKey?: string;
};

export type ${classPrefix}DetectedAccess = {
  authMode: "unknown";
  labelHint: string;
  identityKey?: string;
};

export type ${classPrefix}DetectedLiveSetup = {
  agentId: AgentId;
  validity: AgentLiveStateValidity;
  issues: string[];
  endpoint: ${classPrefix}DetectedEndpoint | null;
  access: ${classPrefix}DetectedAccess | null;
  matchedConnection: MatchedAgentConnection | null;
};
`,
    },
    {
      path: join(agentDir, "index.ts"),
      contents: `export type {
  ${classPrefix}DetectedAccess,
  ${classPrefix}DetectedEndpoint,
  ${classPrefix}DetectedLiveSetup,
} from "./types";
export { ${constName} } from "./types";
export { ${classPrefix}AgentAdapter } from "./${classPrefix}AgentAdapter";
export { LiveSetupDetector } from "./live-setup/Detector";
export { ImportCurrentConnection } from "./import/ImportCurrentConnection";
export { ApplySelection } from "./apply/ApplySelection";
export { RollbackLatestMutation } from "./rollback/RollbackLatestMutation";
`,
    },
    {
      path: join(agentDir, `${classPrefix}AgentAdapter.ts`),
      contents: `import type { CredentialStore } from "../../services/credential/Store";
import type { AgentAdapter, RollbackLatestAgentResult } from "../../models/agent";
import type { AgentWorkspaceContext } from "../../runtime-local/AgentWorkspaceContext";
import { NileLogger } from "../../services/NileLogger";
import { EnvironmentSource } from "../../services/EnvironmentSource";
import { ApplySelection } from "./apply/ApplySelection";
import { LiveSetupDetector } from "./live-setup/Detector";
import { ImportCurrentConnection } from "./import/ImportCurrentConnection";
import { RollbackLatestMutation } from "./rollback/RollbackLatestMutation";
import { ${constName} } from "./types";

export type ${classPrefix}AgentAdapterOptions = {
  databasePath: string;
  credentialStore: CredentialStore;
  environment?: EnvironmentSource;
  secureSnapshotStore?: import("../../services/history/SecureSnapshotStore").SecureSnapshotStore;
  logger?: NileLogger;
  sharedContext?: AgentWorkspaceContext;
};

export class ${classPrefix}AgentAdapter implements AgentAdapter {
  readonly agentId = ${constName};
  readonly rollbackSupport = "yes" as const;

  constructor(private readonly options: ${classPrefix}AgentAdapterOptions) {}

  detectAgentSelection() {
    const detector = this.openDetector();
    try {
      return detector.detectAgentSelection();
    } finally {
      detector.close();
    }
  }

  applySelection(connectionId: string) {
    const applySelection = this.openApplySelection();
    try {
      return applySelection.apply(connectionId);
    } finally {
      applySelection.close();
    }
  }

  async importCurrentConnection() {
    const importer = this.openImporter();
    try {
      return await importer.importCurrent();
    } finally {
      importer.close();
    }
  }

  rollbackLatestMutation(): RollbackLatestAgentResult {
    const rollback = this.openRollback();
    try {
      return {
        agentId: this.agentId,
        ...rollback.rollback(),
      };
    } finally {
      rollback.close();
    }
  }

  private openDetector(): LiveSetupDetector {
    return this.options.sharedContext
      ? LiveSetupDetector.fromContext(this.options.sharedContext, this.options)
      : LiveSetupDetector.open(this.options.databasePath, this.options);
  }

  private openApplySelection(): ApplySelection {
    return this.options.sharedContext
      ? ApplySelection.fromContext(this.options.sharedContext, this.options)
      : ApplySelection.open(this.options.databasePath, this.options);
  }

  private openImporter(): ImportCurrentConnection {
    return this.options.sharedContext
      ? ImportCurrentConnection.fromContext(this.options.sharedContext, this.options)
      : ImportCurrentConnection.open(this.options.databasePath, this.options);
  }

  private openRollback(): RollbackLatestMutation {
    return this.options.sharedContext
      ? RollbackLatestMutation.fromContext(this.options.sharedContext, this.options)
      : RollbackLatestMutation.open(this.options.databasePath, this.options);
  }
}
`,
    },
    {
      path: join(agentDir, "live-setup", "Detector.ts"),
      contents: `import type { CredentialStore } from "../../../services/credential/Store";
import type { AgentWorkspaceContext } from "../../../runtime-local/AgentWorkspaceContext";
import { NileLogger } from "../../../services/NileLogger";
import type { AgentDetectionResult } from "../../../models/agent";
import { ${constName} } from "../types";

export type LiveSetupDetectorOptions = {
  credentialStore: CredentialStore;
  environment?: import("../../../services/EnvironmentSource").EnvironmentSource;
  logger?: NileLogger;
};

export class LiveSetupDetector {
  static open(_databasePath: string, options: LiveSetupDetectorOptions): LiveSetupDetector {
    return new LiveSetupDetector(options);
  }

  static fromContext(_context: AgentWorkspaceContext, options: LiveSetupDetectorOptions): LiveSetupDetector {
    return new LiveSetupDetector(options);
  }

  constructor(private readonly options: LiveSetupDetectorOptions) {
    void this.options;
  }

  detectAgentSelection(): AgentDetectionResult {
    return {
      agentSelection: null,
      detectedState: {
        agentId: ${constName},
        validity: "invalid_structure",
        issues: ["TODO: implement ${agentLabel} live setup detection"],
        endpoint: null,
        access: null,
        matchedConnection: null,
      },
    };
  }

  close(): void {}
}
`,
    },
    {
      path: join(agentDir, "import", "ImportCurrentConnection.ts"),
      contents: `import type { CredentialStore } from "../../../services/credential/Store";
import type { AgentWorkspaceContext } from "../../../runtime-local/AgentWorkspaceContext";
import { NileLogger } from "../../../services/NileLogger";
import type { ImportCurrentConnectionResult } from "../../../models/agent";

export type ImportCurrentConnectionOptions = {
  credentialStore: CredentialStore;
  environment?: import("../../../services/EnvironmentSource").EnvironmentSource;
  logger?: NileLogger;
};

export class ImportCurrentConnection {
  static open(_databasePath: string, options: ImportCurrentConnectionOptions): ImportCurrentConnection {
    return new ImportCurrentConnection(options);
  }

  static fromContext(_context: AgentWorkspaceContext, options: ImportCurrentConnectionOptions): ImportCurrentConnection {
    return new ImportCurrentConnection(options);
  }

  constructor(private readonly options: ImportCurrentConnectionOptions) {
    void this.options;
  }

  async importCurrent(): Promise<ImportCurrentConnectionResult> {
    throw new Error("TODO: implement ${agentLabel} current-connection import");
  }

  close(): void {}
}
`,
    },
    {
      path: join(agentDir, "apply", "ApplySelection.ts"),
      contents: `import type { CredentialStore } from "../../../services/credential/Store";
import type { AgentWorkspaceContext } from "../../../runtime-local/AgentWorkspaceContext";
import { NileLogger } from "../../../services/NileLogger";
import type { ApplyAgentSelectionResult } from "../../../models/agent";

export type ApplySelectionOptions = {
  credentialStore: CredentialStore;
  environment?: import("../../../services/EnvironmentSource").EnvironmentSource;
  secureSnapshotStore?: import("../../../services/history/SecureSnapshotStore").SecureSnapshotStore;
  logger?: NileLogger;
};

export class ApplySelection {
  static open(_databasePath: string, options: ApplySelectionOptions): ApplySelection {
    return new ApplySelection(options);
  }

  static fromContext(_context: AgentWorkspaceContext, options: ApplySelectionOptions): ApplySelection {
    return new ApplySelection(options);
  }

  constructor(private readonly options: ApplySelectionOptions) {
    void this.options;
  }

  apply(_connectionId: string): ApplyAgentSelectionResult {
    throw new Error("TODO: implement ${agentLabel} apply selection");
  }

  close(): void {}
}
`,
    },
    {
      path: join(agentDir, "rollback", "RollbackLatestMutation.ts"),
      contents: `import type { CredentialStore } from "../../../services/credential/Store";
import type { AgentWorkspaceContext } from "../../../runtime-local/AgentWorkspaceContext";
import { NileLogger } from "../../../services/NileLogger";

export type RollbackLatestMutationOptions = {
  credentialStore: CredentialStore;
  environment?: import("../../../services/EnvironmentSource").EnvironmentSource;
  secureSnapshotStore?: import("../../../services/history/SecureSnapshotStore").SecureSnapshotStore;
  logger?: NileLogger;
};

export class RollbackLatestMutation {
  static open(_databasePath: string, options: RollbackLatestMutationOptions): RollbackLatestMutation {
    return new RollbackLatestMutation(options);
  }

  static fromContext(_context: AgentWorkspaceContext, options: RollbackLatestMutationOptions): RollbackLatestMutation {
    return new RollbackLatestMutation(options);
  }

  constructor(private readonly options: RollbackLatestMutationOptions) {
    void this.options;
  }

  rollback() {
    throw new Error("TODO: implement ${agentLabel} rollback latest mutation");
  }

  close(): void {}
}
`,
    },
  ];
}

function readOptions(args) {
  const options = { dryRun: false, help: false, id: "", label: "" };
  for (let index = 0; index < args.length; index += 1) {
    const value = args[index];
    switch (value) {
      case "--dry-run":
        options.dryRun = true;
        break;
      case "--help":
      case "-h":
        options.help = true;
        break;
      case "--id":
        options.id = args[index + 1] ?? "";
        index += 1;
        break;
      case "--label":
        options.label = args[index + 1] ?? "";
        index += 1;
        break;
      default:
        throw new Error(`Unknown argument: ${value}`);
    }
  }
  return options;
}

function printHelp() {
  process.stdout.write(
    "Usage: npm run scaffold:agent -- --id <agent-id> --label <Agent Label> [--dry-run]\n"
    + "Example: npm run scaffold:agent -- --id gemini --label Gemini --dry-run\n",
  );
}

function toPascalCase(value) {
  return value
    .split("-")
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join("");
}

function toConstantCase(value) {
  return value
    .replace(/-/g, "_")
    .toUpperCase();
}
