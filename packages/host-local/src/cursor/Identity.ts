export class CursorLocalIdentity {
  static parseWorkosUserId(authId: string): string | null {
    const trimmed = authId.trim();
    const match = trimmed.match(/user_[A-Za-z0-9]+$/);
    return match ? match[0] : null;
  }
}
