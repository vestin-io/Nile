import type { AgentWorkspaceContext } from "./AgentWorkspaceContext";

type ClosableOperation = { close(): void };

type AgentOperationFactory<TOperation extends ClosableOperation, TOptions> = {
  open(databasePath: string, options: TOptions): TOperation;
  fromContext(context: AgentWorkspaceContext, options: TOptions): TOperation;
};

export class AgentOperationRuntime {
  static run<TOperation extends ClosableOperation, TResult>(
    openOperation: () => TOperation,
    work: (operation: TOperation) => TResult,
  ): TResult {
    const operation = openOperation();
    try {
      return work(operation);
    } finally {
      operation.close();
    }
  }

  static async runAsync<TOperation extends ClosableOperation, TResult>(
    openOperation: () => TOperation,
    work: (operation: TOperation) => Promise<TResult>,
  ): Promise<TResult> {
    const operation = openOperation();
    try {
      return await work(operation);
    } finally {
      operation.close();
    }
  }

  constructor(
    private readonly databasePath: string,
    private readonly sharedContext?: AgentWorkspaceContext,
  ) {}

  build<TOperation extends ClosableOperation, TOptions>(
    factory: AgentOperationFactory<TOperation, TOptions>,
    options: TOptions,
  ): () => TOperation {
    return () => this.sharedContext
      ? factory.fromContext(this.sharedContext, options)
      : factory.open(this.databasePath, options);
  }
}
