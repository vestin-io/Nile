import { NileSession, runWithSession, runWithSessionAsync } from "@nile/builtins/runtime";

type OpenSession = {
  openSession(): NileSession;
};

export class SessionRunner {
  constructor(private readonly sessions: OpenSession) {}

  run<TResult>(work: (session: NileSession) => TResult): TResult {
    return runWithSession(() => this.sessions.openSession(), work);
  }

  async runAsync<TResult>(work: (session: NileSession) => Promise<TResult>): Promise<TResult> {
    return await runWithSessionAsync(() => this.sessions.openSession(), work);
  }
}
