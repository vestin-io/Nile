import { intro, isCancel, multiselect, note, password, select, spinner, text } from "@clack/prompts";

export type CliSelectOption<T extends string> = {
  value: T;
  label: string;
};

export type CliSelectResult<T extends string> =
  | { type: "selected"; value: T }
  | { type: "back" }
  | { type: "cancel" };

export type CliInputResult =
  | { type: "value"; value: string }
  | { type: "back" }
  | { type: "cancel" };

export type CliMultiSelectResult<T extends string> =
  | { type: "selected"; values: T[] }
  | { type: "back" }
  | { type: "cancel" };

const DONE_VALUE = "__done__";
const BACK_VALUE = "__back__";
const CANCEL_VALUE = "__cancel__";

export class InteractivePrompt {
  isInteractive(): boolean {
    return Boolean(process.stdin.isTTY && process.stdout.isTTY);
  }

  async select<T extends string>(
    message: string,
    options: CliSelectOption<T>[],
    choices?: { allowBack?: boolean; allowCancel?: boolean },
  ): Promise<CliSelectResult<T>> {
    if (!this.isInteractive()) {
      throw new Error("Interactive prompt requires a TTY");
    }

    const items: Array<CliSelectOption<string>> = [...options];
    if (choices?.allowBack) {
      items.push({ value: BACK_VALUE, label: "Back" });
    }
    if (choices?.allowCancel ?? true) {
      items.push({ value: CANCEL_VALUE, label: "Cancel" });
    }

    const selection = await select({
      message,
      options: items.map((item) => ({
        value: item.value,
        label: item.label,
      })),
    });

    if (isCancel(selection)) {
      return { type: "cancel" };
    }
    if (selection === BACK_VALUE) {
      return { type: "back" };
    }
    if (selection === CANCEL_VALUE) {
      return { type: "cancel" };
    }
    return {
      type: "selected",
      value: selection as T,
    };
  }

  async input(
    message: string,
    choices?: {
      allowBack?: boolean;
      allowCancel?: boolean;
      secret?: boolean;
      defaultValue?: string;
    },
  ): Promise<CliInputResult> {
    if (!this.isInteractive()) {
      throw new Error("Interactive prompt requires a TTY");
    }

    const suffixParts: string[] = [];
    if (choices?.allowBack) {
      suffixParts.push(":back");
    }
    if (choices?.allowCancel ?? true) {
      suffixParts.push(":cancel");
    }

    const suffix = suffixParts.length > 0 ? ` (${suffixParts.join(", ")})` : "";
    const promptMessage = `${message}${suffix}`;
    const value = choices?.secret
      ? await password({ message: promptMessage, mask: "*" })
      : await text({
          message: promptMessage,
          defaultValue: choices?.defaultValue,
        });

    if (typeof value !== "string" || isCancel(value)) {
      return { type: "cancel" };
    }

    const trimmed = value.trim();
    if (choices?.allowBack && trimmed === ":back") {
      return { type: "back" };
    }
    if ((choices?.allowCancel ?? true) && trimmed === ":cancel") {
      return { type: "cancel" };
    }
    return { type: "value", value: trimmed };
  }

  async multiSelect<T extends string>(
    message: string,
    options: CliSelectOption<T>[],
    choices?: {
      allowDone?: boolean;
      doneLabel?: string;
      allowBack?: boolean;
      allowCancel?: boolean;
      initialValues?: T[];
    },
  ): Promise<CliMultiSelectResult<T>> {
    if (!this.isInteractive()) {
      throw new Error("Interactive prompt requires a TTY");
    }

    const items: Array<CliSelectOption<string>> = [...options];
    if (choices?.allowDone) {
      items.push({ value: DONE_VALUE, label: choices.doneLabel ?? "Done" });
    }
    if (choices?.allowBack) {
      items.push({ value: BACK_VALUE, label: "Back" });
    }
    if (choices?.allowCancel ?? true) {
      items.push({ value: CANCEL_VALUE, label: "Cancel" });
    }

    const selection = await multiselect({
      message,
      options: items.map((item) => ({
        value: item.value,
        label: item.label,
      })),
      initialValues: choices?.initialValues,
      required: false,
    });

    if (isCancel(selection)) {
      return { type: "cancel" };
    }

    const values = selection as string[];
    if (values.includes(DONE_VALUE)) {
      return {
        type: "selected",
        values: values
          .filter((value) => value !== DONE_VALUE && value !== BACK_VALUE && value !== CANCEL_VALUE) as T[],
      };
    }
    if (values.includes(BACK_VALUE)) {
      return { type: "back" };
    }
    if (values.includes(CANCEL_VALUE)) {
      return { type: "cancel" };
    }
    return { type: "selected", values: values as T[] };
  }

  showIntro(message: string): void {
    if (!this.isInteractive()) {
      return;
    }
    intro(message);
  }

  showNote(message: string, title?: string): void {
    if (!this.isInteractive()) {
      return;
    }
    note(message, title);
  }

  async withLoading<TResult>(message: string, work: () => Promise<TResult>): Promise<TResult> {
    if (!this.isInteractive()) {
      return await work();
    }

    const loading = spinner();
    loading.start(message);
    try {
      const result = await work();
      loading.stop("Usage loaded");
      return result;
    } catch (error) {
      loading.stop("Usage fetch failed");
      throw error;
    }
  }
}
