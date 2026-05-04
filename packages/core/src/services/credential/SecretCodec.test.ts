import { describe, expect, it } from "vitest";

import { SecuritySecretCodec } from "./SecretCodec";

describe("SecuritySecretCodec", () => {
  it("decodes the standard prefixed payload format", () => {
    const codec = new SecuritySecretCodec();
    const encoded = codec.encode('{"kind":"api_key","apiKey":"secret"}');

    expect(codec.decode(encoded)).toBe('{"kind":"api_key","apiKey":"secret"}');
  });
});
