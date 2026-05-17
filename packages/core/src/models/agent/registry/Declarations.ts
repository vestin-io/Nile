import { IndexedRegistry } from "../../../services/IndexedRegistry";
import type { AgentId } from "../Ids";
import type { AgentDeclarationDefinition } from "./Types";

export type AgentDeclaration = AgentDeclarationDefinition;

export class AgentDeclarationRegistry {
  private declarations: IndexedRegistry<AgentId, AgentDeclaration>;

  constructor(declarations: readonly AgentDeclaration[]) {
    this.declarations = this.buildIndex(declarations);
  }

  register(declarations: readonly AgentDeclaration[]): void {
    this.declarations = this.buildIndex(declarations);
  }

  list(): AgentDeclaration[] {
    return this.declarations.list();
  }

  read(agentId: AgentId): AgentDeclaration {
    return this.declarations.read(agentId);
  }

  has(agentId: AgentId): boolean {
    return this.declarations.has(agentId);
  }

  formatLabel(agentId: string): string {
    if (this.has(agentId as AgentId)) {
      return this.read(agentId as AgentId).label;
    }
    return agentId ? agentId.charAt(0).toUpperCase() + agentId.slice(1) : agentId;
  }

  private buildIndex(declarations: readonly AgentDeclaration[]) {
    return new IndexedRegistry<AgentId, AgentDeclaration>(
      declarations,
      (declaration) => declaration.id,
      (agentId) => `Unsupported agent declaration: ${agentId}`,
    );
  }
}

export const AGENT_DECLARATION_REGISTRY = new AgentDeclarationRegistry([]);

export function listAgentDeclarations(): AgentDeclaration[] {
  return AGENT_DECLARATION_REGISTRY.list();
}

export function readAgentDeclaration(agentId: AgentId): AgentDeclaration {
  return AGENT_DECLARATION_REGISTRY.read(agentId);
}

export function formatAgentDeclarationLabel(agentId: string): string {
  return AGENT_DECLARATION_REGISTRY.formatLabel(agentId);
}
