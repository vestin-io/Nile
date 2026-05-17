import { describe, expect, test } from "vitest";

import { GatewayProbe } from "./GatewayProbe";

describe("GatewayProbe", () => {
  test("does not report OpenAI support when semantic probes fail", async () => {
    const probe = new GatewayProbe(async (input) => {
      const url = input instanceof Request ? input.url : String(input);
      if (url.endsWith("/v1/models")) {
        return jsonResponse(200, {
          object: "list",
          data: [{ id: "gpt-5.4" }],
        });
      }
      if (url.endsWith("/v1/responses")) {
        return jsonResponse(400, {
          error: {
            message: "Unknown parameter: stream_options.include_usage",
          },
        });
      }
      if (url.endsWith("/v1/chat/completions")) {
        return jsonResponse(400, {
          error: {
            message: "stream_options only allowed with stream",
          },
        });
      }
      if (url.endsWith("/v1/messages")) {
        return jsonResponse(404, {});
      }
      return jsonResponse(404, {});
    });

    await expect(
      probe.probe("https://gateway.example.test/v1", "secret"),
    ).rejects.toThrow("Unable to detect supported gateway protocols");
  });

  test("keeps only the OpenAI wire APIs that pass semantic probes", async () => {
    const probe = new GatewayProbe(async (input) => {
      const url = input instanceof Request ? input.url : String(input);
      if (url.endsWith("/v1/models")) {
        return jsonResponse(200, {
          object: "list",
          data: [{ id: "gpt-4.1" }],
        });
      }
      if (url.endsWith("/v1/responses")) {
        return jsonResponse(200, { id: "resp_123" });
      }
      if (url.endsWith("/v1/chat/completions")) {
        return jsonResponse(400, {
          error: {
            message: "chat unsupported",
          },
        });
      }
      if (url.endsWith("/v1/messages")) {
        return jsonResponse(404, {});
      }
      return jsonResponse(404, {});
    });

    const result = await probe.probe("https://gateway.example.test/v1", "secret");

    expect(result).toEqual({
      openai: {
        basePath: "/v1",
        wireApis: ["responses"],
        authSchemes: ["bearer"],
        envKeyOverride: "OPENAI_API_KEY",
      },
      anthropic: null,
    });
  });

  test("falls back to an alternate OpenAI model when the preferred model fails", async () => {
    const probe = new GatewayProbe(async (input, init) => {
      const url = input instanceof Request ? input.url : String(input);
      if (url.endsWith("/v1/models")) {
        return jsonResponse(200, {
          object: "list",
          data: [{ id: "gpt-5.4" }, { id: "gpt-5.3-codex" }],
        });
      }
      if (url.endsWith("/v1/responses")) {
        return jsonResponse(400, {
          error: {
            message: "responses unsupported",
          },
        });
      }
      if (url.endsWith("/v1/chat/completions")) {
        const body = parseBody(init);
        return body?.model === "gpt-5.3-codex"
          ? jsonResponse(200, { id: "chatcmpl_123" })
          : jsonResponse(400, {
            error: {
              message: "preferred model unsupported",
            },
          });
      }
      if (url.endsWith("/v1/messages")) {
        return jsonResponse(404, {});
      }
      return jsonResponse(404, {});
    });

    const result = await probe.probe("https://gateway.example.test/v1", "secret");

    expect(result).toEqual({
      openai: {
        basePath: "/v1",
        wireApis: ["chat"],
        authSchemes: ["bearer"],
        envKeyOverride: "OPENAI_API_KEY",
      },
      anthropic: null,
    });
  });
});

function jsonResponse(status: number, payload: unknown): Response {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { "content-type": "application/json" },
  });
}

function parseBody(init: RequestInit | undefined): Record<string, unknown> | null {
  const body = init?.body;
  if (typeof body !== "string") {
    return null;
  }
  return JSON.parse(body) as Record<string, unknown>;
}
