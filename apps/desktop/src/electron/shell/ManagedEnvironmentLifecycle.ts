import type { AgentHomes } from "@nile/core/models/agent";
import { NileLogger } from "@nile/core/services/NileLogger";
import type { NileSession } from "@nile/builtins/runtime";

import { ManagedApiKeyEnvironment } from "../connections/ManagedApiKeyEnvironment";
import { DesktopOpenClawEnvironmentReader } from "../environment/OpenClaw";

type ManagedEnvironmentLifecycleOptions = {
  agentHomes: AgentHomes;
  environment: ManagedApiKeyEnvironment;
  logger: NileLogger;
  openSession(): NileSession;
};

export class DesktopManagedEnvironmentLifecycle {
  constructor(private readonly options: ManagedEnvironmentLifecycleOptions) {}

  clearBeforeReset(): void {
    const session = this.options.openSession();
    try {
      const preservedEnvKeys = this.readManagedOpenClawEnvKeys();
      this.options.environment.clearForSession(session, [...preservedEnvKeys]);
    } finally {
      session.close();
    }
  }

  async syncStartup(): Promise<void> {
    const session = this.options.openSession();
    try {
      const preservedEnvKeys = [...this.readManagedOpenClawEnvKeys()];
      for (const failure of this.options.environment.syncForSession(session, preservedEnvKeys)) {
        this.options.logger.warn("desktop.managed_env.sync_failed", {
          connectionId: failure.connectionId,
          error: failure.error.message,
        });
      }
    } finally {
      session.close();
    }
  }

  private readManagedOpenClawEnvKeys(): Set<string> {
    const openclawHome = this.options.agentHomes.openclaw;
    if (!openclawHome) {
      return new Set();
    }
    try {
      return new Set(new DesktopOpenClawEnvironmentReader(openclawHome).readManagedEnvKeys());
    } catch (error) {
      this.options.logger.warn("desktop.openclaw.managed_config_read_failed", {
        error: error instanceof Error ? error.message : String(error),
      });
      return new Set();
    }
  }
}
