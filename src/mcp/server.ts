import { createInterface } from "node:readline";
import type { Readable, Writable } from "node:stream";

import { VERSION } from "../shared/version.js";
import {
  COACH_PROMPT_TOOL_DEFINITION,
  GET_PROMPT_MEMORY_STATUS_TOOL_DEFINITION,
  IMPROVE_PROMPT_TOOL_DEFINITION,
  PREPARE_AGENT_JUDGE_BATCH_TOOL_DEFINITION,
  PROMPT_MEMORY_MCP_TOOL_DEFINITIONS,
  RECORD_AGENT_JUDGMENTS_TOOL_DEFINITION,
  REVIEW_PROJECT_INSTRUCTIONS_TOOL_DEFINITION,
  SCORE_PROMPT_ARCHIVE_TOOL_DEFINITION,
  SCORE_PROMPT_TOOL_DEFINITION,
} from "./score-tool-definitions.js";
import {
  coachPromptTool,
  getPromptMemoryStatusTool,
  improvePromptTool,
  prepareAgentJudgeBatchTool,
  recordAgentJudgmentsTool,
  reviewProjectInstructionsTool,
  scorePromptArchiveTool,
  scorePromptTool,
} from "./score-tool.js";
import type {
  PrepareAgentJudgeBatchToolArguments,
  RecordAgentJudgmentsToolArguments,
} from "./agent-judge-tool-types.js";
import type {
  CoachPromptToolArguments,
  GetPromptMemoryStatusToolArguments,
  ImprovePromptToolArguments,
  ReviewProjectInstructionsToolArguments,
  ScorePromptArchiveToolArguments,
  ScorePromptToolArguments,
  ScorePromptToolOptions,
} from "./score-tool-types.js";

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

type PromptMemoryToolResult =
  | ReturnType<typeof getPromptMemoryStatusTool>
  | ReturnType<typeof coachPromptTool>
  | ReturnType<typeof scorePromptTool>
  | ReturnType<typeof improvePromptTool>
  | ReturnType<typeof scorePromptArchiveTool>
  | ReturnType<typeof reviewProjectInstructionsTool>
  | ReturnType<typeof prepareAgentJudgeBatchTool>
  | ReturnType<typeof recordAgentJudgmentsTool>;

type PromptMemoryToolHandler = (
  args: Record<string, unknown>,
  options: PromptMemoryMcpServerOptions,
) => PromptMemoryToolResult;

const PROMPT_MEMORY_MCP_TOOL_HANDLERS: Record<string, PromptMemoryToolHandler> =
  {
    [GET_PROMPT_MEMORY_STATUS_TOOL_DEFINITION.name]: (args, options) =>
      getPromptMemoryStatusTool(
        args as GetPromptMemoryStatusToolArguments,
        options,
      ),
    [COACH_PROMPT_TOOL_DEFINITION.name]: (args, options) =>
      coachPromptTool(args as CoachPromptToolArguments, options),
    [SCORE_PROMPT_TOOL_DEFINITION.name]: (args, options) =>
      scorePromptTool(args as ScorePromptToolArguments, options),
    [IMPROVE_PROMPT_TOOL_DEFINITION.name]: (args, options) =>
      improvePromptTool(args as ImprovePromptToolArguments, options),
    [SCORE_PROMPT_ARCHIVE_TOOL_DEFINITION.name]: (args, options) =>
      scorePromptArchiveTool(args as ScorePromptArchiveToolArguments, options),
    [REVIEW_PROJECT_INSTRUCTIONS_TOOL_DEFINITION.name]: (args, options) =>
      reviewProjectInstructionsTool(
        args as ReviewProjectInstructionsToolArguments,
        options,
      ),
    [PREPARE_AGENT_JUDGE_BATCH_TOOL_DEFINITION.name]: (args, options) =>
      prepareAgentJudgeBatchTool(
        args as PrepareAgentJudgeBatchToolArguments,
        options,
      ),
    [RECORD_AGENT_JUDGMENTS_TOOL_DEFINITION.name]: (args, options) =>
      recordAgentJudgmentsTool(
        args as RecordAgentJudgmentsToolArguments,
        options,
      ),
  };

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
        tools: PROMPT_MEMORY_MCP_TOOL_DEFINITIONS,
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

  const handler = PROMPT_MEMORY_MCP_TOOL_HANDLERS[params.name];
  const result = handler?.(params.arguments, options);

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
