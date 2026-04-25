export type CredentialScope = "access" | "usage" | "workspace";

type BaseCredentialSource = {
  reference: string;
  scope: CredentialScope;
  allowLocalMaterialization: boolean;
};

export type LocalCredentialSource = BaseCredentialSource & {
  kind: "local";
};

export type HostedCredentialSource = BaseCredentialSource & {
  kind: "hosted";
  provider: "nile";
};

export type ExternalCredentialSource = BaseCredentialSource & {
  kind: "external";
  provider: string;
};

export type CredentialSource =
  | LocalCredentialSource
  | HostedCredentialSource
  | ExternalCredentialSource;
