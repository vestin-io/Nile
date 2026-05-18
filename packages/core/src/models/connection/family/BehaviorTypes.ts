import type { AccessRecord } from "../../access";
import type { EndpointRecord } from "../../endpoint";
import type { StoredCredential } from "../../../services/credential/Types";

export type ConnectionFamilyBehaviorSet = {
  identityKeyReader?: ConnectionIdentityKeyReader;
  accessLabelReader?: ConnectionAccessLabelReader;
  sessionFallbackLabel?: string;
  openAiSessionModelCatalogReader?: OpenAiSessionModelCatalogReader;
  sessionModelCatalogReader?: SessionModelCatalogReader;
  accessMatcher?: ConnectionAccessMatcher;
};

export type ConnectionIdentityKeyReader = {
  resolve(credential: StoredCredential): string | null;
};

export type ConnectionAccessLabelReader = {
  read(credential: StoredCredential): string | null;
};

export type OpenAiSessionModelCatalogReader = {
  readAuthorization(credential: StoredCredential): { token: string; accountId?: string } | null;
  shouldUseCodexModelCatalog(endpoint: EndpointRecord, credential: StoredCredential): boolean;
};

export type SessionModelCatalogResult = {
  status: "available" | "unavailable" | "error";
  models: string[];
  message?: string;
};

export type SessionModelCatalogReader = {
  read(
    endpoint: EndpointRecord,
    credential: StoredCredential,
    fetchFn?: typeof fetch,
  ): Promise<SessionModelCatalogResult | null>;
};

export type ConnectionAccessMatcher = {
  matches(
    access: AccessRecord,
    stored: StoredCredential,
    incoming: StoredCredential,
    identityKey: string | null,
  ): boolean;
};
