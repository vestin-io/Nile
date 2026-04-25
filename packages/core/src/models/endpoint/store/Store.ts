import type { EndpointRecord } from "../Types";

export interface EndpointStore {
  insert(record: EndpointRecord): void;
  update(record: EndpointRecord): void;
  get(endpointId: string): EndpointRecord | null;
  list(): EndpointRecord[];
  remove(endpointId: string): void;
}
