export class JwtPayloadDecoder {
  decode(token: string): Record<string, unknown> | null {
    const parts = token.split(".");
    if (parts.length < 2) {
      return null;
    }

    try {
      const encoded = parts[1]
        .replace(/-/g, "+")
        .replace(/_/g, "/")
        .padEnd(Math.ceil(parts[1].length / 4) * 4, "=");
      const payload = Buffer.from(encoded, "base64").toString("utf8");
      const parsed = JSON.parse(payload);
      return parsed && typeof parsed === "object" ? (parsed as Record<string, unknown>) : null;
    } catch {
      return null;
    }
  }
}

export const JWT_PAYLOAD_DECODER = new JwtPayloadDecoder();
