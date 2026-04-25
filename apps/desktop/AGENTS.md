# Desktop Agent Guide

This file applies to `apps/desktop/`.

## UI Rules

- Prefer shadcn/ui official components from `https://ui.shadcn.com/docs/components` for renderer UI.
- When a matching shadcn component exists, use that component pattern instead of building a custom styled control.
- Tailwind is allowed for composition, spacing, responsive layout, and token-driven glue code, but not for inventing bespoke visual primitives when shadcn already has a matching component.
- Do not hand-roll new visual component styles unless the user explicitly asks for a custom treatment.
- Do not keep parallel custom versions of controls such as select, checkbox, dialog, separator, sidebar, table, or input when the desktop renderer can use the shadcn open-code version instead.
- Do not hardcode user-visible renderer copy in page/component code when the text belongs to the product UI. Route it through the desktop translation layer so language switching remains complete and consistent.
- Treat button labels, headings, empty states, menu labels, form labels, status copy, and settings copy as translatable UI text by default.
- Keep desktop theming aligned with shadcn recommendations:
  - semantic CSS variables
  - `.dark` token overrides
  - system theme driven by `prefers-color-scheme`
- If a component is needed and not yet present in `src/renderer/ui/`, add the shadcn-style open-code component there first, then consume it from feature code.

## Settings Surface

- Treat the settings renderer as a product settings surface, not a marketing page.
- Prefer section/list layouts over decorative card-heavy compositions unless the user explicitly asks for richer visual treatment.
