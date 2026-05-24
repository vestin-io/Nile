import { describe, expect, it } from "vitest";

import { detectDesktopPlatform, readDocumentPlatform, readSystemSecureStorageName } from "./Platform";

describe("Platform", () => {
  it("detects macOS and Windows user agents", () => {
    expect(detectDesktopPlatform("Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)")).toBe("darwin");
    expect(detectDesktopPlatform("Mozilla/5.0 (Windows NT 10.0; Win64; x64)")).toBe("win32");
  });

  it("maps document dataset platform values", () => {
    expect(readDocumentPlatform("Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)")).toBe("mac");
    expect(readDocumentPlatform("Mozilla/5.0 (Windows NT 10.0; Win64; x64)")).toBe("windows");
    expect(readDocumentPlatform("Mozilla/5.0 (X11; Linux x86_64)")).toBe("other");
  });

  it("returns the system secure storage name for each platform", () => {
    const t = (key: string) => key;

    expect(readSystemSecureStorageName(t, "darwin")).toBe("systemSecureStorage.name.appleKeychain");
    expect(readSystemSecureStorageName(t, "win32")).toBe("systemSecureStorage.name.windowsCredentialManager");
    expect(readSystemSecureStorageName(t, "linux")).toBe("systemSecureStorage.name.systemPasswordManager");
  });
});
