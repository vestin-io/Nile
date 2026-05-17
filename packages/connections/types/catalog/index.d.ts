export type ConnectionModelCatalogResult = {
  connectionId: string;
  status: "available" | "unavailable" | "error";
  models: string[];
  message?: string;
};

export declare class ConnectionModelCatalog {
  constructor(
    endpointRegistry: unknown,
    accessRegistry: unknown,
    environment: { read(envKey: string): string | null },
    localModelCatalogSources?: readonly unknown[],
    fetchFn?: typeof fetch,
  );
  read(connectionId: string): Promise<ConnectionModelCatalogResult>;
}
