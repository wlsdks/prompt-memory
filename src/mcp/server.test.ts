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
            name: "coach_prompt",
          }),
          expect.objectContaining({
            name: "score_prompt",
          }),
          expect.objectContaining({
            name: "improve_prompt",
          }),
          expect.objectContaining({
            name: "score_prompt_archive",
          }),
          expect.objectContaining({
            name: "review_project_instructions",
          }),
          expect.objectContaining({
            name: "prepare_agent_rewrite",
          }),
          expect.objectContaining({
            name: "record_agent_rewrite",
          }),
          expect.objectContaining({
            name: "prepare_agent_judge_batch",
          }),
          expect.objectContaining({
            name: "record_agent_judgments",
          }),
        ],
      },
    });
  });

  it("declares safe local tool annotations for each tool", () => {
    const response = handleMcpMessage({
      jsonrpc: "2.0",
      id: "tool-contract",
      method: "tools/list",
    });

    const tools = (response?.result as { tools: Array<unknown> }).tools;

    expect(tools).toHaveLength(10);
    for (const tool of tools.filter(
      (tool) =>
        !["record_agent_rewrite", "record_agent_judgments"].includes(
          (tool as { name?: string }).name ?? "",
        ),
    )) {
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
    expect(tools).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          name: "record_agent_rewrite",
          annotations: expect.objectContaining({
            destructiveHint: false,
            idempotentHint: false,
            openWorldHint: false,
            readOnlyHint: false,
          }),
        }),
        expect.objectContaining({
          name: "record_agent_judgments",
          annotations: expect.objectContaining({
            destructiveHint: false,
            idempotentHint: false,
            openWorldHint: false,
            readOnlyHint: false,
          }),
        }),
      ]),
    );
  });

  it("declares output schemas for structured MCP results", () => {
    const response = handleMcpMessage({
      jsonrpc: "2.0",
      id: "tool-output-contract",
      method: "tools/list",
    });

    const tools = (response?.result as { tools: Array<unknown> }).tools;

    for (const tool of tools) {
      expect(tool).toEqual(
        expect.objectContaining({
          outputSchema: expect.objectContaining({
            type: "object",
            properties: expect.any(Object),
          }),
        }),
      );
    }

    expect(tools).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          name: "coach_prompt",
          outputSchema: expect.objectContaining({
            properties: expect.objectContaining({
              status: expect.any(Object),
              latest_score: expect.any(Object),
              improvement: expect.any(Object),
              archive: expect.any(Object),
              agent_brief: expect.any(Object),
              privacy: expect.any(Object),
            }),
          }),
        }),
        expect.objectContaining({
          name: "improve_prompt",
          outputSchema: expect.objectContaining({
            properties: expect.objectContaining({
              improved_prompt: expect.any(Object),
              requires_user_approval: expect.any(Object),
              privacy: expect.any(Object),
            }),
            oneOf: expect.arrayContaining([
              expect.objectContaining({
                required: expect.arrayContaining([
                  "improved_prompt",
                  "requires_user_approval",
                  "privacy",
                ]),
              }),
              expect.objectContaining({
                required: expect.arrayContaining([
                  "is_error",
                  "error_code",
                  "message",
                ]),
              }),
            ]),
          }),
        }),
        expect.objectContaining({
          name: "score_prompt_archive",
          outputSchema: expect.objectContaining({
            properties: expect.objectContaining({
              archive_score: expect.any(Object),
              next_prompt_template: expect.any(Object),
              practice_plan: expect.any(Object),
              top_gaps: expect.any(Object),
              privacy: expect.any(Object),
            }),
          }),
        }),
        expect.objectContaining({
          name: "prepare_agent_rewrite",
          outputSchema: expect.objectContaining({
            properties: expect.objectContaining({
              mode: expect.any(Object),
              prompt: expect.any(Object),
              rewrite_contract: expect.any(Object),
              agent_instructions: expect.any(Object),
              privacy: expect.any(Object),
            }),
          }),
        }),
        expect.objectContaining({
          name: "record_agent_rewrite",
          outputSchema: expect.objectContaining({
            properties: expect.objectContaining({
              recorded: expect.any(Object),
              draft: expect.any(Object),
              privacy: expect.any(Object),
            }),
          }),
        }),
        expect.objectContaining({
          name: "prepare_agent_judge_batch",
          outputSchema: expect.objectContaining({
            properties: expect.objectContaining({
              mode: expect.any(Object),
              rubric: expect.any(Object),
              prompts: expect.any(Object),
              agent_instructions: expect.any(Object),
              privacy: expect.any(Object),
            }),
          }),
        }),
        expect.objectContaining({
          name: "record_agent_judgments",
          outputSchema: expect.objectContaining({
            properties: expect.objectContaining({
              recorded: expect.any(Object),
              judgments: expect.any(Object),
              privacy: expect.any(Object),
            }),
          }),
        }),
      ]),
    );
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

  it("returns structured MCP content for improve_prompt calls", () => {
    const response = handleMcpMessage({
      jsonrpc: "2.0",
      id: "improve-1",
      method: "tools/call",
      params: {
        name: "improve_prompt",
        arguments: {
          prompt:
            "Review src/mcp/server.ts, run pnpm test, and return a Markdown summary.",
        },
      },
    });

    expect(response).toMatchObject({
      jsonrpc: "2.0",
      id: "improve-1",
      result: {
        content: [
          {
            type: "text",
            text: expect.stringContaining('"improved_prompt"'),
          },
        ],
        structuredContent: expect.objectContaining({
          improved_prompt: expect.stringContaining("Please work from"),
          requires_user_approval: true,
          privacy: expect.objectContaining({
            external_calls: false,
            returns_stored_prompt_body: false,
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

  it("returns structured MCP content for coach_prompt setup guidance", () => {
    const response = handleMcpMessage(
      {
        jsonrpc: "2.0",
        id: "coach-1",
        method: "tools/call",
        params: {
          name: "coach_prompt",
          arguments: {},
        },
      },
      {
        dataDir: join(tmpdir(), `prompt-memory-missing-${randomUUID()}`),
      },
    );

    expect(response).toMatchObject({
      jsonrpc: "2.0",
      id: "coach-1",
      result: {
        content: [
          {
            type: "text",
            text: expect.stringContaining('"agent_coach"'),
          },
        ],
        structuredContent: expect.objectContaining({
          mode: "agent_coach",
          status: expect.objectContaining({
            status: "setup_needed",
          }),
          agent_brief: expect.objectContaining({
            next_actions: expect.arrayContaining([
              expect.stringContaining("prompt-memory setup"),
            ]),
          }),
          privacy: expect.objectContaining({
            external_calls: false,
            auto_submits: false,
          }),
        }),
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
