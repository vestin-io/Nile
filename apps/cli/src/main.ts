#!/usr/bin/env -S node --import tsx

import { homedir } from "node:os";
import { join } from "node:path";

import { defaultAgentHomes } from "@nile/core/models/agent";
import { EnvironmentSource } from "@nile/core/services/EnvironmentSource";

import { NileCli } from "./NileCli";

const cli = new NileCli({
  databasePath: join(homedir(), ".nile-switcher", "switcher.sqlite"),
  agentHomes: defaultAgentHomes(),
  environment: EnvironmentSource.from(process.env),
});

const result = await cli.run(process.argv.slice(2));

if (result.stdout) {
  process.stdout.write(result.stdout);
}
if (result.stderr) {
  process.stderr.write(`${result.stderr}\n`);
}

process.exitCode = result.exitCode;
