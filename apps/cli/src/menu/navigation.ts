export type MenuNavigation = "menu" | "exit";

export type NavigationCallbacks = {
  buildCancelledError: () => Error;
  isBackError: (error: unknown) => boolean;
};
