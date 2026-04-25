export class AgentProjectionError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "AgentProjectionError";
  }
}
