export class ApplySelectionValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ApplySelectionValidationError";
  }
}
