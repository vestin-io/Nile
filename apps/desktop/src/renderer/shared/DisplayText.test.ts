import { describe, expect, it } from "vitest";

import { createTranslator } from "./I18n";
import { formatLiveIssue, formatUsageValue } from "./DisplayText";

describe("DisplayText", () => {
  it("returns unknown when usage is unavailable in shared formatting", () => {
    const t = createTranslator("zh");

    expect(formatUsageValue(null, t)).toBe("未知");
  });

  it("translates known OpenClaw live issues", () => {
    const t = createTranslator("zh");

    expect(
      formatLiveIssue(
        "OpenClaw config not found at /Users/test/.openclaw/openclaw.json",
        t,
      ),
    ).toBe("未找到 OpenClaw 本地配置文件：`/Users/test/.openclaw/openclaw.json`。");
    expect(formatLiveIssue("OpenClaw config does not define agents.defaults.model.primary", t)).toBe(
      "OpenClaw 配置缺少 `agents.defaults.model.primary`。",
    );
    expect(
      formatLiveIssue(
        "OpenClaw config does not contain provider openai referenced by agents.defaults.model.primary",
        t,
      ),
    ).toBe(
      "OpenClaw 配置在 `agents.defaults.model.primary` 中引用了提供方 `openai`，但该提供方未定义。",
    );
  });

  it("translates known OpenCode live issues", () => {
    const t = createTranslator("zh");

    expect(
      formatLiveIssue(
        "OpenCode config not found at /Users/test/.config/opencode/opencode.json",
        t,
      ),
    ).toBe("未找到 OpenCode 本地配置文件：`/Users/test/.config/opencode/opencode.json`。");
    expect(formatLiveIssue("OpenCode config does not define model", t)).toBe(
      "OpenCode 配置缺少 `agents.defaults.model.primary`。",
    );
    expect(
      formatLiveIssue(
        "OpenCode config does not contain provider openai referenced by model",
        t,
      ),
    ).toBe(
      "OpenCode 配置在 `agents.defaults.model.primary` 中引用了提供方 `openai`，但该提供方未定义。",
    );
  });
});
