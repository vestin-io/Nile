import type { EndpointProtocols } from "../endpoint";

export function buildEndpointUrl(endpoint: {
  rootUrl: string;
  protocols: EndpointProtocols;
}): string {
  if (endpoint.protocols.openai?.basePath) {
    return `${endpoint.rootUrl}${endpoint.protocols.openai.basePath}`;
  }
  if (endpoint.protocols.anthropic?.basePath) {
    return `${endpoint.rootUrl}${endpoint.protocols.anthropic.basePath}`;
  }
  return endpoint.rootUrl;
}
