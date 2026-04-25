import { homedir } from "node:os";
import { join } from "node:path";

import type { StoredCredential } from "../../../services/credential/Types";
import { EnvironmentSource } from "../../../services/EnvironmentSource";
import { CurrentStateReader } from "./Reader";
import { CursorConfigStore } from "../stores/CursorConfigStore";
import { CursorCredentialStore } from "../stores/CursorCredentialStore";

export class CurrentCredentialReader {
  static open(options?: {
    cursorHome?: string;
    environment?: EnvironmentSource;
  }): CurrentCredentialReader {
    const cursorHome = options?.cursorHome ?? join(homedir(), ".cursor");
    const environment = options?.environment ?? EnvironmentSource.from(process.env);

    return new CurrentCredentialReader(
      new CurrentStateReader(
        new CursorConfigStore(cursorHome),
        new CursorCredentialStore(),
        environment,
      ),
    );
  }

  constructor(private readonly reader: CurrentStateReader) {}

  read(): StoredCredential {
    const result = this.reader.read();
    if (result.kind !== "resolved") {
      throw new Error(result.issues.join("; ") || "No supported credential found in current Cursor state");
    }
    return result.value.credential;
  }
}
