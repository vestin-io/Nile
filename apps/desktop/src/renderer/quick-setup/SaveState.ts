export type SavePhase = "idle" | "pending-confirmation";

type SaveStateInput = {
  confirmed: boolean;
  hasLocalSetup: boolean;
  phase: SavePhase;
};

export function shouldKeepPendingSave({
  confirmed,
  hasLocalSetup,
  phase,
}: SaveStateInput): boolean {
  if (phase === "idle") {
    return false;
  }

  return !confirmed && hasLocalSetup;
}
