const SECRET_ENCODING_PREFIX = "__nile_keychain_v1__:";

export class SecuritySecretCodec {
  encode(secret: string): string {
    return `${SECRET_ENCODING_PREFIX}${Buffer.from(secret, "utf8").toString("base64")}`;
  }

  decode(secret: string): string {
    if (!secret.startsWith(SECRET_ENCODING_PREFIX)) {
      return secret;
    }

    const encoded = secret.slice(SECRET_ENCODING_PREFIX.length);
    return Buffer.from(encoded, "base64").toString("utf8");
  }
}
