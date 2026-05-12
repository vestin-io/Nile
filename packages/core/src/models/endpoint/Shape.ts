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
    return EndpointShape.matchesIdentity(record, candidate)
      && EndpointShape.protocolsEqual(record.protocols, candidate.protocols);
  }

  static matchesRecordCandidateSubset(record: EndpointRecord, candidate: EndpointRegistryInput): boolean {
    return EndpointShape.matchesIdentity(record, candidate)
      && EndpointShape.protocolsContain(record.protocols, candidate.protocols);
  }

  static matchesIdentity(
    record: Pick<EndpointRecord, "rootUrl" | "profile">,
    candidate: Pick<EndpointRegistryInput, "rootUrl" | "profile">,
  ): boolean {
    return record.rootUrl === candidate.rootUrl && record.profile === candidate.profile;
  }

  static mergeProtocols(current: EndpointProtocols, next: EndpointProtocols): EndpointProtocols {
    return {
      ...(current.openai || next.openai
        ? { openai: EndpointShape.mergeOpenAi(current.openai, next.openai) }
        : {}),
      ...(current.anthropic || next.anthropic
        ? { anthropic: EndpointShape.mergeAnthropic(current.anthropic, next.anthropic) }
        : {}),
      ...(current.cursor || next.cursor
        ? { cursor: next.cursor ?? current.cursor }
        : {}),
    };
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
    return (right.basePath === undefined || left.basePath === right.basePath)
      && right.authSchemes.every((scheme) => leftAuthSchemes.has(scheme))
      && right.wireApis.every((wireApi) => leftWireApis.has(wireApi));
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
    return (right.basePath === undefined || left.basePath === right.basePath)
      && left.versionHeader === right.versionHeader
      && right.authSchemes.every((scheme) => leftAuthSchemes.has(scheme));
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

  private static mergeOpenAi(
    current: EndpointProtocols["openai"],
    next: EndpointProtocols["openai"],
  ): EndpointProtocols["openai"] {
    if (!current || !next) {
      return next ?? current;
    }

    return {
      basePath: next.basePath ?? current.basePath,
      wireApis: EndpointShape.mergeUnique(current.wireApis, next.wireApis),
      authSchemes: EndpointShape.mergeUnique(current.authSchemes, next.authSchemes),
      envKeyOverride: next.envKeyOverride ?? current.envKeyOverride,
    };
  }

  private static mergeAnthropic(
    current: EndpointProtocols["anthropic"],
    next: EndpointProtocols["anthropic"],
  ): EndpointProtocols["anthropic"] {
    if (!current || !next) {
      return next ?? current;
    }

    return {
      basePath: next.basePath ?? current.basePath,
      authSchemes: EndpointShape.mergeUnique(current.authSchemes, next.authSchemes),
      envKeyOverride: next.envKeyOverride ?? current.envKeyOverride,
      versionHeader: next.versionHeader ?? current.versionHeader,
    };
  }

  private static mergeUnique<T>(current: T[], next: T[]): T[] {
    return [...new Set([...current, ...next])];
  }
}
