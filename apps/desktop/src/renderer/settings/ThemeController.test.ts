import { beforeEach, describe, expect, it, vi } from "vitest";

import { ThemeController } from "./ThemeController";

describe("ThemeController", () => {
  beforeEach(() => {
    (globalThis as { window?: unknown }).window = {
      matchMedia: vi.fn((query: string) => ({
        matches: query === "(prefers-color-scheme: dark)",
        media: query,
        onchange: null,
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
        addListener: vi.fn(),
        removeListener: vi.fn(),
        dispatchEvent: vi.fn(),
      })),
    } as unknown;
  });

  it("applies the resolved dark theme for system mode", () => {
    const root = createRootElement();
    const controller = new ThemeController(root as unknown as HTMLElement);

    controller.apply("system");

    expect(root.dataset.theme).toBe("system");
    expect(root.classList.contains("dark")).toBe(true);
    expect(root.style.colorScheme).toBe("dark");
  });

  it("applies explicit light mode without the dark class", () => {
    const root = createRootElement();
    root.classList.add("dark");
    const controller = new ThemeController(root as unknown as HTMLElement);

    controller.apply("light");

    expect(root.dataset.theme).toBe("light");
    expect(root.classList.contains("dark")).toBe(false);
    expect(root.style.colorScheme).toBe("light");
  });
});

function createRootElement() {
  const classes = new Set<string>();
  return {
    dataset: {} as Record<string, string>,
    style: {
      colorScheme: "",
    },
    classList: {
      add: (value: string) => {
        classes.add(value);
      },
      remove: (value: string) => {
        classes.delete(value);
      },
      toggle: (value: string, force?: boolean) => {
        if (force === undefined) {
          if (classes.has(value)) {
            classes.delete(value);
            return false;
          }
          classes.add(value);
          return true;
        }
        if (force) {
          classes.add(value);
          return true;
        }
        classes.delete(value);
        return false;
      },
      contains: (value: string) => classes.has(value),
    },
  };
}
