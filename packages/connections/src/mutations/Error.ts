export class ConnectionUpdaterValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ConnectionUpdaterValidationError";
  }
}
