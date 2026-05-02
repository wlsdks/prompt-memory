import { describe, expect, it } from "vitest";

import { handleMcpMessage } from "./server.js";

describe("MCP stdio server", () => {
  it("declares score_prompt through tools/list", () => {
    const response = handleMcpMessage({
      jsonrpc: "2.0",
      id: 1,
      method: "tools/list",
    });

    expect(response).toMatchObject({
      jsonrpc: "2.0",
      id: 1,
      result: {
        tools: [
          expect.objectContaining({
            name: "score_prompt",
          }),
        ],
      },
    });
  });

  it("returns text MCP content for score_prompt calls", () => {
    const response = handleMcpMessage({
      jsonrpc: "2.0",
      id: "score-1",
      method: "tools/call",
      params: {
        name: "score_prompt",
        arguments: {
          prompt:
            "Review src/web/src/App.tsx export flow, run pnpm test, and return a Markdown summary.",
        },
      },
    });

    expect(response).toMatchObject({
      jsonrpc: "2.0",
      id: "score-1",
      result: {
        content: [
          {
            type: "text",
            text: expect.stringContaining('"quality_score"'),
          },
        ],
        isError: false,
      },
    });
  });

  it("does not respond to initialized notifications", () => {
    expect(
      handleMcpMessage({
        jsonrpc: "2.0",
        method: "notifications/initialized",
      }),
    ).toBeUndefined();
  });
});
