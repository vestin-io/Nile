export type SavePhase =
  | "idle"
  | "saving";

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

export function readPendingSaveMessageKey(phase: SavePhase): string | null {
  switch (phase) {
    case "saving":
      return "quickSetup.saveProgress.saving";
    default:
      return null;
  }
}
