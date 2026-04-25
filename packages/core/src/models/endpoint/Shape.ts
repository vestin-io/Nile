import type { EndpointProfile, EndpointProtocols, EndpointRecord, EndpointRegistryInput } from "./Types";

export type EndpointFamily = "openai" | "gateway" | "azure-openai" | "cursor" | "anthropic";

export class EndpointShape {
  static readFamily(
    endpoint: Pick<EndpointRecord, "profile" | "protocols"> | Pick<EndpointRegistryInput, "profile" | "protocols">,
  ): EndpointFamily {
    if (endpoint.protocols.cursor) {
      return "cursor";
    }
    if (endpoint.profile === "azure-openai") {
      return "azure-openai";
    }
    if (endpoint.profile === "generic-gateway" && endpoint.protocols.openai) {
      return "gateway";
    }
    if (endpoint.protocols.anthropic) {
      return "anthropic";
    }
    return "openai";
  }

  static matchesRecord(record: EndpointRecord, candidate: EndpointRegistryInput): boolean {
    return record.rootUrl === candidate.rootUrl
      && record.profile === candidate.profile
      && EndpointShape.protocolsEqual(record.protocols, candidate.protocols);
  }

  static matchesRecordCandidateSubset(record: EndpointRecord, candidate: EndpointRegistryInput): boolean {
    return record.rootUrl === candidate.rootUrl
      && record.profile === candidate.profile
      && EndpointShape.protocolsContain(record.protocols, candidate.protocols);
  }

  static protocolsEqual(left: EndpointProtocols, right: EndpointProtocols): boolean {
    return EndpointShape.openAiEqual(left.openai, right.openai)
      && EndpointShape.anthropicEqual(left.anthropic, right.anthropic)
      && EndpointShape.cursorEqual(left.cursor, right.cursor);
  }

  static protocolsContain(left: EndpointProtocols, right: EndpointProtocols): boolean {
    return (!right.openai || EndpointShape.openAiContains(left.openai, right.openai))
      && (!right.anthropic || EndpointShape.anthropicContains(left.anthropic, right.anthropic))
      && (!right.cursor || EndpointShape.cursorEqual(left.cursor, right.cursor));
  }

  private static openAiEqual(
    left: EndpointProtocols["openai"],
    right: EndpointProtocols["openai"],
  ): boolean {
    if (!left || !right) {
      return left === right;
    }

    return left.basePath === right.basePath
      && left.authSchemes.join("|") === right.authSchemes.join("|")
      && left.wireApis.join("|") === right.wireApis.join("|");
  }

  private static openAiContains(
    left: EndpointProtocols["openai"],
    right: EndpointProtocols["openai"],
  ): boolean {
    if (!left || !right) {
      return left === right;
    }

    const leftAuthSchemes = new Set(left.authSchemes);
    const leftWireApis = new Set(left.wireApis);
    return left.basePath === right.basePath
      && right.authSchemes.every((scheme) => leftAuthSchemes.has(scheme))
      && right.wireApis.every((wireApi) => leftWireApis.has(wireApi))
      && (right.envKeyOverride === undefined || left.envKeyOverride === right.envKeyOverride);
  }

  private static anthropicEqual(
    left: EndpointProtocols["anthropic"],
    right: EndpointProtocols["anthropic"],
  ): boolean {
    if (!left || !right) {
      return left === right;
    }

    return left.basePath === right.basePath
      && left.versionHeader === right.versionHeader
      && left.authSchemes.join("|") === right.authSchemes.join("|");
  }

  private static anthropicContains(
    left: EndpointProtocols["anthropic"],
    right: EndpointProtocols["anthropic"],
  ): boolean {
    if (!left || !right) {
      return left === right;
    }

    const leftAuthSchemes = new Set(left.authSchemes);
    return left.basePath === right.basePath
      && left.versionHeader === right.versionHeader
      && right.authSchemes.every((scheme) => leftAuthSchemes.has(scheme))
      && (right.envKeyOverride === undefined || left.envKeyOverride === right.envKeyOverride);
  }

  private static cursorEqual(
    left: EndpointProtocols["cursor"],
    right: EndpointProtocols["cursor"],
  ): boolean {
    if (!left || !right) {
      return left === right;
    }

    return left.backendPath === right.backendPath;
  }
}
