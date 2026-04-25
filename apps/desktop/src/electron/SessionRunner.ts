import { NileSession } from "@nile/core/runtime-local";

type OpenSession = {
  openSession(): NileSession;
};

export class SessionRunner {
  constructor(private readonly sessions: OpenSession) {}

  run<TResult>(work: (session: NileSession) => TResult): TResult {
    const session = this.sessions.openSession();
    try {
      return work(session);
    } finally {
      session.close();
    }
  }

  async runAsync<TResult>(work: (session: NileSession) => Promise<TResult>): Promise<TResult> {
    const session = this.sessions.openSession();
    try {
      return await work(session);
    } finally {
      session.close();
    }
  }
}
