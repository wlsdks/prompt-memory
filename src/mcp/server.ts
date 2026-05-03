import { createInterface } from "node:readline";
import type { Readable, Writable } from "node:stream";

import { VERSION } from "../shared/version.js";
import {
  COACH_PROMPT_TOOL_DEFINITION,
  GET_PROMPT_MEMORY_STATUS_TOOL_DEFINITION,
  IMPROVE_PROMPT_TOOL_DEFINITION,
  SCORE_PROMPT_ARCHIVE_TOOL_DEFINITION,
  SCORE_PROMPT_TOOL_DEFINITION,
  REVIEW_PROJECT_INSTRUCTIONS_TOOL_DEFINITION,
  coachPromptTool,
  getPromptMemoryStatusTool,
  improvePromptTool,
  reviewProjectInstructionsTool,
  scorePromptArchiveTool,
  scorePromptTool,
  type CoachPromptToolArguments,
  type GetPromptMemoryStatusToolArguments,
  type ImprovePromptToolArguments,
  type ReviewProjectInstructionsToolArguments,
  type ScorePromptArchiveToolArguments,
  type ScorePromptToolArguments,
  type ScorePromptToolOptions,
} from "./score-tool.js";

type JsonRpcId = string | number | null;

type JsonRpcRequest = {
  jsonrpc: "2.0";
  id?: JsonRpcId;
  method?: string;
  params?: unknown;
};

type JsonRpcResponse =
  | {
      jsonrpc: "2.0";
      id: JsonRpcId;
      result: unknown;
    }
  | {
      jsonrpc: "2.0";
      id: JsonRpcId;
      error: {
        code: number;
        message: string;
      };
    };

export type PromptMemoryMcpServerOptions = ScorePromptToolOptions;

export async function runPromptMemoryMcpServer(
  options: PromptMemoryMcpServerOptions = {},
  input: Readable = process.stdin,
  output: Writable = process.stdout,
): Promise<void> {
  const lines = createInterface({
    input,
    crlfDelay: Number.POSITIVE_INFINITY,
  });

  for await (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) {
      continue;
    }

    for (const response of handleMcpLine(trimmed, options)) {
      output.write(`${JSON.stringify(response)}\n`);
    }
  }
}

export function handleMcpLine(
  line: string,
  options: PromptMemoryMcpServerOptions = {},
): JsonRpcResponse[] {
  try {
    const parsed = JSON.parse(line) as unknown;
    const messages = Array.isArray(parsed) ? parsed : [parsed];

    return messages.flatMap((message) => {
      const response = handleMcpMessage(message, options);
      return response ? [response] : [];
    });
  } catch {
    return [
      jsonRpcError(
        null,
        -32700,
        "Parse error. Expected one JSON-RPC message per line.",
      ),
    ];
  }
}

export function handleMcpMessage(
  message: unknown,
  options: PromptMemoryMcpServerOptions = {},
): JsonRpcResponse | undefined {
  if (!isJsonRpcRequest(message)) {
    return jsonRpcError(null, -32600, "Invalid JSON-RPC request.");
  }

  if (message.id === undefined && isNotification(message.method)) {
    return undefined;
  }

  const id = message.id ?? null;

  switch (message.method) {
    case "initialize":
      return jsonRpcResult(id, {
        protocolVersion: readRequestedProtocolVersion(message.params),
        capabilities: {
          tools: {
            listChanged: false,
          },
        },
        serverInfo: {
          name: "prompt-memory",
          version: VERSION,
        },
        instructions:
          "Use coach_prompt for the default one-call Claude Code/Codex coaching workflow: status, latest prompt score, approval-ready rewrite, habit review, project instruction review, and next request guidance. Use get_prompt_memory_status only for readiness checks, score_prompt for one prompt, improve_prompt for one rewrite, score_prompt_archive for habit-only review, and review_project_instructions for AGENTS.md/CLAUDE.md-only checks. This server is local-only and does not call external LLMs.",
      });
    case "ping":
      return jsonRpcResult(id, {});
    case "tools/list":
      return jsonRpcResult(id, {
        tools: [
          GET_PROMPT_MEMORY_STATUS_TOOL_DEFINITION,
          COACH_PROMPT_TOOL_DEFINITION,
          SCORE_PROMPT_TOOL_DEFINITION,
          IMPROVE_PROMPT_TOOL_DEFINITION,
          SCORE_PROMPT_ARCHIVE_TOOL_DEFINITION,
          REVIEW_PROJECT_INSTRUCTIONS_TOOL_DEFINITION,
        ],
      });
    case "tools/call":
      return handleToolCall(id, message.params, options);
    default:
      return jsonRpcError(id, -32601, `Method not found: ${message.method}`);
  }
}

function handleToolCall(
  id: JsonRpcId,
  params: unknown,
  options: PromptMemoryMcpServerOptions,
): JsonRpcResponse {
  if (!isToolCallParams(params)) {
    return jsonRpcError(
      id,
      -32602,
      "`tools/call` requires params.name and params.arguments.",
    );
  }

  const result =
    params.name === GET_PROMPT_MEMORY_STATUS_TOOL_DEFINITION.name
      ? getPromptMemoryStatusTool(
          params.arguments as GetPromptMemoryStatusToolArguments,
          options,
        )
      : params.name === COACH_PROMPT_TOOL_DEFINITION.name
        ? coachPromptTool(params.arguments as CoachPromptToolArguments, options)
        : params.name === SCORE_PROMPT_TOOL_DEFINITION.name
          ? scorePromptTool(
              params.arguments as ScorePromptToolArguments,
              options,
            )
          : params.name === IMPROVE_PROMPT_TOOL_DEFINITION.name
            ? improvePromptTool(
                params.arguments as ImprovePromptToolArguments,
                options,
              )
            : params.name === SCORE_PROMPT_ARCHIVE_TOOL_DEFINITION.name
              ? scorePromptArchiveTool(
                  params.arguments as ScorePromptArchiveToolArguments,
                  options,
                )
              : params.name === REVIEW_PROJECT_INSTRUCTIONS_TOOL_DEFINITION.name
                ? reviewProjectInstructionsTool(
                    params.arguments as ReviewProjectInstructionsToolArguments,
                    options,
                  )
                : undefined;

  if (!result) {
    return jsonRpcError(id, -32602, `Unknown tool: ${params.name}`);
  }

  const isError = "is_error" in result;

  return jsonRpcResult(id, {
    content: [
      {
        type: "text",
        text: JSON.stringify(result, null, 2),
      },
    ],
    structuredContent: result,
    isError,
  });
}

function isJsonRpcRequest(value: unknown): value is JsonRpcRequest {
  return (
    Boolean(value) &&
    typeof value === "object" &&
    (value as JsonRpcRequest).jsonrpc === "2.0" &&
    typeof (value as JsonRpcRequest).method === "string"
  );
}

function isToolCallParams(
  value: unknown,
): value is { name: string; arguments: Record<string, unknown> } {
  return (
    Boolean(value) &&
    typeof value === "object" &&
    typeof (value as { name?: unknown }).name === "string" &&
    Boolean((value as { arguments?: unknown }).arguments) &&
    typeof (value as { arguments?: unknown }).arguments === "object" &&
    !Array.isArray((value as { arguments?: unknown }).arguments)
  );
}

function isNotification(method: string | undefined): boolean {
  return (
    method === "notifications/initialized" ||
    method === "notifications/cancelled"
  );
}

function readRequestedProtocolVersion(params: unknown): string {
  if (
    params &&
    typeof params === "object" &&
    typeof (params as { protocolVersion?: unknown }).protocolVersion ===
      "string"
  ) {
    return (params as { protocolVersion: string }).protocolVersion;
  }

  return "2025-03-26";
}

function jsonRpcResult(id: JsonRpcId, result: unknown): JsonRpcResponse {
  return {
    jsonrpc: "2.0",
    id,
    result,
  };
}

function jsonRpcError(
  id: JsonRpcId,
  code: number,
  message: string,
): JsonRpcResponse {
  return {
    jsonrpc: "2.0",
    id,
    error: {
      code,
      message,
    },
  };
}
