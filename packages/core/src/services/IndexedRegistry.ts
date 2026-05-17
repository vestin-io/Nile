export class IndexedRegistry<Id, Entry> {
  private entriesById: Map<Id, Entry> | null = null;

  constructor(
    private readonly entries: readonly Entry[],
    private readonly readId: (entry: Entry) => Id,
    private readonly readMissingMessage: (id: Id) => string,
  ) {}

  list(): Entry[] {
    return [...this.entries];
  }

  read(id: Id): Entry {
    const entry = this.readEntriesById().get(id);
    if (!entry) {
      throw new Error(this.readMissingMessage(id));
    }
    return entry;
  }

  has(id: Id): boolean {
    return this.readEntriesById().has(id);
  }

  private readEntriesById(): Map<Id, Entry> {
    if (!this.entriesById) {
      this.entriesById = new Map(this.entries.map((entry) => [this.readId(entry), entry]));
    }
    return this.entriesById;
  }
}
