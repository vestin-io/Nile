import { describe, expect, it } from "vitest";

import { PortableBundleCodec } from "./PortableBundleCodec";
import {
  PortableBundlePassphraseError,
  PortableBundleValidationError,
  PortableBundleVersionError,
} from "./PortableBundleErrors";

describe("PortableBundleCodec", () => {
  it("round-trips a portable bundle payload", () => {
    const codec = new PortableBundleCodec();

    const envelope = codec.create({
      source: {
        appVersion: "0.16.14",
        platform: "macos",
        storageMode: "system_secure_storage",
      },
      exportedAt: "2026-05-27T00:00:00.000Z",
      connections: [{
        stableKey: "openai|openai|openai_session|acct_123",
        label: "jay.ji@spotto.ai",
        endpointId: "openai",
        endpointFamily: "openai",
        endpointUrl: null,
        authMode: "openai_session",
        enabledAgents: ["codex"],
        configurableAgents: ["codex", "openclaw"],
        selectedByAgents: ["codex"],
        modelSelections: {
          codex: "gpt-5.5",
        },
        credential: {
          kind: "openai_session",
          idToken: "id-token",
          accessToken: "access-token",
          refreshToken: "refresh-token",
          accountId: "acct_123",
        },
      }],
    }, "bundle-passphrase");

    const payload = codec.open(JSON.stringify(envelope), "bundle-passphrase");

    expect(payload).toEqual({
      version: 1,
      exportedAt: "2026-05-27T00:00:00.000Z",
      source: {
        appVersion: "0.16.14",
        platform: "macos",
        storageMode: "system_secure_storage",
      },
      connections: [{
        stableKey: "openai|openai|openai_session|acct_123",
        label: "jay.ji@spotto.ai",
        endpointId: "openai",
        endpointFamily: "openai",
        endpointUrl: null,
        authMode: "openai_session",
        enabledAgents: ["codex"],
        configurableAgents: ["codex", "openclaw"],
        selectedByAgents: ["codex"],
        modelSelections: {
          codex: "gpt-5.5",
        },
        credential: {
          kind: "openai_session",
          idToken: "id-token",
          accessToken: "access-token",
          refreshToken: "refresh-token",
          accountId: "acct_123",
        },
      }],
    });
  });

  it("fails closed on the wrong passphrase", () => {
    const codec = new PortableBundleCodec();
    const envelope = codec.create({
      source: {
        appVersion: "0.16.14",
        platform: "macos",
        storageMode: "encrypted_local_storage",
      },
      connections: [],
    }, "bundle-passphrase");

    expect(() => codec.open(JSON.stringify(envelope), "wrong-passphrase")).toThrow(
      PortableBundlePassphraseError,
    );
  });

  it("rejects unsupported envelope versions", () => {
    const codec = new PortableBundleCodec();

    expect(() => codec.open(JSON.stringify({
      version: 99,
      format: "nile-portable-bundle",
      kdf: {
        algorithm: "scrypt",
        saltBase64: "c2FsdA==",
        cost: 16384,
        blockSize: 8,
        parallelization: 1,
        keyLength: 32,
      },
      cipher: {
        algorithm: "aes-256-gcm",
        nonceBase64: "bm9uY2U=",
        tagBase64: "dGFn",
      },
      ciphertextBase64: "Y2lwaGVydGV4dA==",
    }), "bundle-passphrase")).toThrow(PortableBundleVersionError);
  });

  it("rejects malformed envelopes before decrypting", () => {
    const codec = new PortableBundleCodec();

    expect(() => codec.open("{\"format\":\"nile-portable-bundle\"}", "bundle-passphrase")).toThrow(
      PortableBundleVersionError,
    );
  });

  it("requires a non-empty export passphrase", () => {
    const codec = new PortableBundleCodec();

    expect(() => codec.create({
      source: {
        appVersion: "0.16.14",
        platform: "macos",
        storageMode: "system_secure_storage",
      },
      connections: [],
    }, "")).toThrow(PortableBundleValidationError);
  });
});
