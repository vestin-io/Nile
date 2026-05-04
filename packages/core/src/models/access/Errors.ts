export class AccessRegistryValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "AccessRegistryValidationError";
  }
}

export class DuplicateAccessIdError extends Error {
  constructor(accessId: string) {
    super(`Access already exists: ${accessId}`);
    this.name = "DuplicateAccessIdError";
  }
}

export class AccessNotFoundError extends Error {
  constructor(accessId: string) {
    super(`Access not found: ${accessId}`);
    this.name = "AccessNotFoundError";
  }
}

export class AccessRegistryConsistencyError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "AccessRegistryConsistencyError";
  }
}
