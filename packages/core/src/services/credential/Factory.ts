import type { CredentialSource } from "./Source";

export type CreateAccessCredentialSourceInput = {
  accessId: string;
};

export type CreateCursorUsageCredentialSourceInput = {
  connectionId: string;
};

export interface CredentialSourceFactory {
  createAccessSource(input: CreateAccessCredentialSourceInput): CredentialSource;
  createCursorUsageSource(input: CreateCursorUsageCredentialSourceInput): CredentialSource;
}

export class LocalCredentialSourceFactory implements CredentialSourceFactory {
  createAccessSource(input: CreateAccessCredentialSourceInput): CredentialSource {
    return {
      kind: "local",
      reference: `access:${input.accessId}`,
      scope: "access",
      allowLocalMaterialization: true,
    };
  }

  createCursorUsageSource(input: CreateCursorUsageCredentialSourceInput): CredentialSource {
    return {
      kind: "local",
      reference: `usage:cursor:${input.connectionId}`,
      scope: "usage",
      allowLocalMaterialization: true,
    };
  }
}
