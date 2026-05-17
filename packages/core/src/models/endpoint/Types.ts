export const SUPPORTED_ENDPOINT_PROFILES = [
  "anthropic-official",
  "azure-openai",
  "cursor-backend",
  "gemini-cli",
  "generic-gateway",
  "openai-official",
] as const;

export const SUPPORTED_ENDPOINT_PROTOCOLS = [
  "anthropic",
  "cursor",
  "gemini",
  "openai",
] as const;

export const SUPPORTED_ENDPOINT_AUTH_SCHEMES = [
  "bearer",
  "x_api_key",
] as const;

export const SUPPORTED_OPENAI_WIRE_APIS = [
  "chat",
  "responses",
] as const;

export type EndpointProfile = (typeof SUPPORTED_ENDPOINT_PROFILES)[number];
export type EndpointProtocol = (typeof SUPPORTED_ENDPOINT_PROTOCOLS)[number];
export type EndpointAuthScheme = (typeof SUPPORTED_ENDPOINT_AUTH_SCHEMES)[number];
export type OpenAiWireApi = (typeof SUPPORTED_OPENAI_WIRE_APIS)[number];

export type EndpointOpenAiProtocol = {
  basePath?: string;
  wireApis: OpenAiWireApi[];
  authSchemes: Array<"bearer">;
  envKeyOverride?: string;
};

export type EndpointAnthropicProtocol = {
  basePath?: string;
  authSchemes: EndpointAuthScheme[];
  envKeyOverride?: "ANTHROPIC_API_KEY" | "ANTHROPIC_AUTH_TOKEN";
  versionHeader?: string;
};

export type EndpointCursorProtocol = {
  backendPath?: string;
};

export type EndpointGeminiProtocol = {
  authTypes: Array<"oauth-personal">;
};

export type EndpointProtocols = {
  openai?: EndpointOpenAiProtocol;
  anthropic?: EndpointAnthropicProtocol;
  cursor?: EndpointCursorProtocol;
  gemini?: EndpointGeminiProtocol;
};

export type EndpointRegistryInput = {
  id: string;
  label: string;
  rootUrl: string;
  profile?: EndpointProfile;
  protocols: EndpointProtocols;
};

export type EndpointRegistryUpdate = {
  label?: string;
  rootUrl?: string;
  profile?: EndpointProfile | null;
  protocols?: EndpointProtocols;
};

export type EndpointRecord = {
  id: string;
  label: string;
  rootUrl: string;
  profile?: EndpointProfile;
  protocols: EndpointProtocols;
  createdAt: string;
  updatedAt: string;
};
