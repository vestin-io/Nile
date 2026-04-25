import type { AccessRecord } from "../Types";

export interface AccessStore {
  insert(record: AccessRecord): void;
  update(record: AccessRecord): void;
  get(accessId: string): AccessRecord | null;
  list(): AccessRecord[];
  remove(accessId: string): void;
}
