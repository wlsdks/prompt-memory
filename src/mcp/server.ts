import { createInterface } from "node:readline";
import type { Readable, Writable } from "node:stream";

import { VERSION } from "../shared/version.js";
import {
  SCORE_PROMPT_TOOL_DEFINITION,
  scorePromptTool,
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
          "Use score_prompt when the user asks to evaluate a coding prompt or inspect prompt-memory quality score. This server is local-only and does not call external LLMs.",
      });
    case "ping":
      return jsonRpcResult(id, {});
    case "tools/list":
      return jsonRpcResult(id, {
        tools: [SCORE_PROMPT_TOOL_DEFINITION],
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

  if (params.name !== SCORE_PROMPT_TOOL_DEFINITION.name) {
    return jsonRpcError(id, -32602, `Unknown tool: ${params.name}`);
  }

  const result = scorePromptTool(params.arguments, options);
  const isError = "is_error" in result;

  return jsonRpcResult(id, {
    content: [
      {
        type: "text",
        text: JSON.stringify(result, null, 2),
      },
    ],
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
