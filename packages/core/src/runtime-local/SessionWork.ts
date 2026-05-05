import type { NileSession } from "./NileSession";

export function runWithSession<TResult>(
  openSession: () => NileSession,
  work: (session: NileSession) => TResult,
): TResult {
  const session = openSession();
  try {
    return work(session);
  } finally {
    session.close();
  }
}

export async function runWithSessionAsync<TResult>(
  openSession: () => NileSession,
  work: (session: NileSession) => Promise<TResult>,
): Promise<TResult> {
  const session = openSession();
  try {
    return await work(session);
  } finally {
    session.close();
  }
}
