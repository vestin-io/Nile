export class DesktopStateErrorNormalizer {
  normalize(error: unknown): Error {
    const message = error instanceof Error ? error.message : String(error);
    if (
      message.includes("no such column:")
      || message.includes("Unhandled connection support input:")
    ) {
      return new Error(
        "Local Nile state is incompatible with this app version. Reset Nile state from Settings or run `nile reset --yes`, then restart Nile.",
      );
    }
    return error instanceof Error ? error : new Error(message);
  }
}
