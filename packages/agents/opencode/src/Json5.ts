import json5 from "json5";

export class Json5ParseError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "Json5ParseError";
  }
}

export function parseJson5Object(content: string): Record<string, unknown> {
  let parsed: unknown;
  try {
    parsed = json5.parse(content);
  } catch (error) {
    throw new Json5ParseError(error instanceof Error ? error.message : String(error));
  }

  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    throw new Json5ParseError("OpenCode config root must be an object");
  }

  return parsed as Record<string, unknown>;
}
