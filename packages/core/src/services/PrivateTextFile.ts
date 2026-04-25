import { chmodSync, mkdirSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";

export function writePrivateTextFile(path: string, content: string): void {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, content, { encoding: "utf8", mode: 0o600 });
  chmodSync(path, 0o600);
}
