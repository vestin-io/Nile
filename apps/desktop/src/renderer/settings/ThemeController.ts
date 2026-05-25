import type { ThemePreference } from "../../state/UiPreferences";

export class ThemeController {
  constructor(private readonly root: HTMLElement) {}

  apply(theme: ThemePreference): void {
    const prefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
    const resolvedTheme = theme === "system" ? (prefersDark ? "dark" : "light") : theme;
    this.root.dataset.theme = theme;
    this.root.classList.toggle("dark", resolvedTheme === "dark");
    this.root.style.colorScheme = resolvedTheme;
  }
}
