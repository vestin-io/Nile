import type { AgentModule } from "./Types";

export class AgentModuleRegistry {
  private modules: readonly AgentModule[];
  private revision = 0;

  constructor(modules: readonly AgentModule[]) {
    this.modules = modules;
  }

  register(modules: readonly AgentModule[]): void {
    this.modules = modules;
    this.revision += 1;
  }

  list(): AgentModule[] {
    return [...this.modules];
  }

  readRevision(): number {
    return this.revision;
  }
}

export const AGENT_MODULE_REGISTRY = new AgentModuleRegistry([]);
