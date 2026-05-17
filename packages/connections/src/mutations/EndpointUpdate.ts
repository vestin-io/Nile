import type { AccessRecord, AccessRegistry } from "@nile/core/models/access";
import { EndpointShape, type EndpointRecord, type EndpointRegistry, type EndpointRegistryInput } from "@nile/core/models/endpoint";
import { buildEndpointUrl } from "@nile/core/models/connection/EndpointUrl";
import { ConnectionNaming } from "@nile/core/models/connection/Naming";
import type { ConnectionPresetFamily } from "@nile/core/models/connection/preset";

import { ConnectionUpdaterValidationError } from "./Error";

export class ConnectionEndpointUpdateSupport {
  constructor(
    private readonly endpointRegistry: EndpointRegistry,
    private readonly accessRegistry: AccessRegistry,
  ) {}

  readPreparationUrl(endpoint: EndpointRecord): string {
    return buildEndpointUrl(endpoint);
  }

  resolveUpdatablePreset(endpoint: EndpointRecord): ConnectionPresetFamily {
    const family = EndpointShape.readFamily(endpoint);
    if (family === "cursor" || family === "gemini") {
      throw new ConnectionUpdaterValidationError(`${endpoint.label} connections do not support auth updates`);
    }
    return family;
  }

  resolveUpdatedEndpoint(
    current: AccessRecord,
    currentEndpoint: EndpointRecord,
    candidate: EndpointRegistryInput,
  ): EndpointRecord {
    if (EndpointShape.matchesRecord(currentEndpoint, candidate)) {
      return this.endpointRegistry.update(currentEndpoint.id, {
        label: candidate.label,
        rootUrl: candidate.rootUrl,
        profile: candidate.profile ?? null,
        protocols: candidate.protocols,
      });
    }

    const existingMergeable = this.endpointRegistry
      .list()
      .find((endpoint) => endpoint.id !== currentEndpoint.id && EndpointShape.matchesIdentity(endpoint, candidate));
    if (existingMergeable) {
      return this.endpointRegistry.update(existingMergeable.id, {
        label: candidate.label,
        rootUrl: candidate.rootUrl,
        profile: candidate.profile ?? null,
        protocols: EndpointShape.mergeProtocols(existingMergeable.protocols, candidate.protocols),
      });
    }

    const sharedEndpoint = this.accessRegistry
      .list()
      .some((access) => access.id !== current.id && access.endpointId === currentEndpoint.id);
    if (!sharedEndpoint) {
      const protocols = EndpointShape.matchesIdentity(currentEndpoint, candidate)
        ? EndpointShape.mergeProtocols(currentEndpoint.protocols, candidate.protocols)
        : candidate.protocols;
      return this.endpointRegistry.update(currentEndpoint.id, {
        label: candidate.label,
        rootUrl: candidate.rootUrl,
        profile: candidate.profile ?? null,
        protocols,
      });
    }

    const hinted = this.endpointRegistry.get(candidate.id);
    if (hinted && EndpointShape.matchesIdentity(hinted, candidate)) {
      return this.endpointRegistry.update(hinted.id, {
        label: candidate.label,
        rootUrl: candidate.rootUrl,
        profile: candidate.profile ?? null,
        protocols: EndpointShape.mergeProtocols(hinted.protocols, candidate.protocols),
      });
    }

    const endpointId = hinted
      ? ConnectionNaming.createUniqueId(candidate.id, this.endpointRegistry.list().map((entry) => entry.id))
      : candidate.id;
    return this.endpointRegistry.add({
      ...candidate,
      id: endpointId,
    });
  }

  removeIfOrphaned(endpointId: string): void {
    const stillReferenced = this.accessRegistry.list().some((access) => access.endpointId === endpointId);
    if (!stillReferenced) {
      this.endpointRegistry.remove(endpointId);
    }
  }
}
