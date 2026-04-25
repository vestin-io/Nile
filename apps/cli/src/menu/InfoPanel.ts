import type { InteractivePrompt } from "../InteractivePrompt";
import type { MenuNavigation } from "./navigation";

export class InfoPanel {
  constructor(private readonly prompt: InteractivePrompt) {}

  async run(
    title: string,
    body: string,
  ): Promise<MenuNavigation> {
    this.prompt.showNote(body, title);
    const selection = await this.prompt.select(
      "What would you like to do?",
      [{ value: "back", label: "Back" }],
      { allowCancel: true },
    );

    if (selection.type === "cancel") {
      return "exit";
    }
    return "menu";
  }

  async runResult(
    title: string,
    body: string,
  ): Promise<MenuNavigation> {
    this.prompt.showNote(body, title);
    const selection = await this.prompt.select(
      "What would you like to do next?",
      [
        { value: "back", label: "Back to main menu" },
        { value: "done", label: "Done" },
      ],
      { allowCancel: true },
    );

    if (selection.type === "selected" && selection.value === "done") {
      return "exit";
    }
    if (selection.type === "cancel") {
      return "exit";
    }
    return "menu";
  }
}
