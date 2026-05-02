import { randomUUID } from "node:crypto";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

import { handleMcpMessage } from "./server.js";

describe("MCP stdio server", () => {
  it("declares prompt scoring tools through tools/list", () => {
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
            name: "get_prompt_memory_status",
          }),
          expect.objectContaining({
            name: "score_prompt",
          }),
          expect.objectContaining({
            name: "score_prompt_archive",
          }),
          expect.objectContaining({
            name: "review_project_instructions",
          }),
        ],
      },
    });
  });

  it("declares read-only local tool annotations for each tool", () => {
    const response = handleMcpMessage({
      jsonrpc: "2.0",
      id: "tool-contract",
      method: "tools/list",
    });

    const tools = (response?.result as { tools: Array<unknown> }).tools;

    expect(tools).toHaveLength(4);
    for (const tool of tools) {
      expect(tool).toEqual(
        expect.objectContaining({
          annotations: expect.objectContaining({
            destructiveHint: false,
            idempotentHint: true,
            openWorldHint: false,
            readOnlyHint: true,
          }),
        }),
      );
    }
  });

  it("returns text MCP content for score_prompt_archive calls", () => {
    const response = handleMcpMessage(
      {
        jsonrpc: "2.0",
        id: "archive-score-1",
        method: "tools/call",
        params: {
          name: "score_prompt_archive",
          arguments: {
            max_prompts: 100,
          },
        },
      },
      {
        dataDir: join(tmpdir(), `prompt-memory-missing-${randomUUID()}`),
      },
    );

    expect(response).toMatchObject({
      jsonrpc: "2.0",
      id: "archive-score-1",
      result: {
        content: [
          {
            type: "text",
            text: expect.stringContaining('"error_code"'),
          },
        ],
        isError: true,
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
        structuredContent: expect.objectContaining({
          quality_score: expect.any(Object),
          privacy: expect.objectContaining({
            external_calls: false,
            returns_prompt_body: false,
          }),
        }),
        isError: false,
      },
    });
  });

  it("returns text MCP content for review_project_instructions calls", () => {
    const response = handleMcpMessage(
      {
        jsonrpc: "2.0",
        id: "project-review-1",
        method: "tools/call",
        params: {
          name: "review_project_instructions",
          arguments: {
            latest: true,
          },
        },
      },
      {
        dataDir: join(tmpdir(), `prompt-memory-missing-${randomUUID()}`),
      },
    );

    expect(response).toMatchObject({
      jsonrpc: "2.0",
      id: "project-review-1",
      result: {
        content: [
          {
            type: "text",
            text: expect.stringContaining('"error_code"'),
          },
        ],
        isError: true,
      },
    });
  });

  it("returns text MCP content for get_prompt_memory_status calls", () => {
    const response = handleMcpMessage(
      {
        jsonrpc: "2.0",
        id: "status-1",
        method: "tools/call",
        params: {
          name: "get_prompt_memory_status",
          arguments: {},
        },
      },
      {
        dataDir: join(tmpdir(), `prompt-memory-missing-${randomUUID()}`),
      },
    );

    expect(response).toMatchObject({
      jsonrpc: "2.0",
      id: "status-1",
      result: {
        content: [
          {
            type: "text",
            text: expect.stringContaining('"setup_needed"'),
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
