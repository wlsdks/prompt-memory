import { describe, expect, it } from "vitest";

import { askClarifyingQuestionsTool } from "./ask-clarifying-questions-tool.js";
import type { RpcChannel } from "./rpc-channel.js";
import type { PromptMemoryMcpServerContext } from "./server.js";

function makeChannel(handler: {
  onSendRequest: (method: string, params: unknown) => Promise<unknown>;
}): RpcChannel {
  return {
    sendRequest: <T>(
      method: string,
      params: unknown,
      _options?: { timeoutMs?: number },
    ): Promise<T> => handler.onSendRequest(method, params) as Promise<T>,
    fulfillResponse: () => true,
    isResponseEnvelope: (value): value is never => false,
    pendingCount: () => 0,
    cancelAll: () => {},
  };
}

function makeContext(
  capabilities: Record<string, unknown>,
  channelHandler: {
    onSendRequest: (method: string, params: unknown) => Promise<unknown>;
  },
): PromptMemoryMcpServerContext {
  return {
    channel: makeChannel(channelHandler),
    clientCapabilities: capabilities,
  };
}

describe("askClarifyingQuestionsTool", () => {
  it("rejects empty prompts as invalid_input", async () => {
    const result = await askClarifyingQuestionsTool({ prompt: "  " });
    expect("is_error" in result && result.is_error).toBe(true);
  });

  it("returns no_questions when the prompt is already strong", async () => {
    const result = await askClarifyingQuestionsTool({
      prompt:
        "Because the export review is unclear, inspect src/web/src/App.tsx only, run pnpm test, and return a Markdown summary.",
      language: "en",
    });

    if ("is_error" in result) {
      throw new Error("expected success");
    }
    expect(result.interaction_status).toBe("no_questions");
    expect(result.answers_count).toBe(0);
    expect(result.next_action).toContain("Review the draft");
  });

  it("falls back to unsupported when no server context is available", async () => {
    const result = await askClarifyingQuestionsTool({
      prompt: "Make this better",
      language: "en",
    });

    if ("is_error" in result) {
      throw new Error("expected success");
    }
    expect(result.interaction_status).toBe("unsupported");
    expect(result.next_action).toContain("native ask UI");
  });

  it("falls back to unsupported when the client does not advertise elicitation capability", async () => {
    let sentRequests = 0;
    const ctx = makeContext(
      { tools: {} },
      {
        onSendRequest: async () => {
          sentRequests += 1;
          return { action: "accept", content: {} };
        },
      },
    );

    const result = await askClarifyingQuestionsTool(
      { prompt: "Make this better", language: "en" },
      { ctx },
    );

    if ("is_error" in result) {
      throw new Error("expected success");
    }
    expect(result.interaction_status).toBe("unsupported");
    expect(sentRequests).toBe(0);
  });

  it("composes the final draft from the user's verbatim elicitation answers", async () => {
    const ctx = makeContext(
      { elicitation: {} },
      {
        onSendRequest: async (method, params) => {
          expect(method).toBe("elicitation/create");
          const typed = params as {
            requestedSchema: {
              required: string[];
              properties: Record<string, { description: string }>;
            };
          };
          expect(typed.requestedSchema.required.length).toBeGreaterThan(0);
          const content: Record<string, string> = {};
          for (const axis of typed.requestedSchema.required) {
            content[axis] =
              axis === "goal_clarity"
                ? "Fix the delete API bug in src/server/routes/prompts.ts."
                : axis === "background_context"
                  ? "Current delete returns 500 because of a missing FTS sync."
                  : "stub";
          }
          return { action: "accept", content };
        },
      },
    );

    const result = await askClarifyingQuestionsTool(
      { prompt: "Make this better", language: "en" },
      { ctx },
    );

    if ("is_error" in result) {
      throw new Error("expected success");
    }
    expect(result.interaction_status).toBe("answered");
    expect(result.answers_count).toBeGreaterThan(0);
    expect(result.improved_prompt).toContain("delete API");
    expect(result.analyzer).toBe("clarifications-v1");
  });

  it("preserves the local-rules-v1 analyzer for non-answered fallbacks", async () => {
    const result = await askClarifyingQuestionsTool({
      prompt: "Make this better",
      language: "en",
    });

    if ("is_error" in result) {
      throw new Error("expected success");
    }
    expect(result.interaction_status).toBe("unsupported");
    expect(result.analyzer).toBe("local-rules-v1");
  });

  it("returns declined when the user declines the elicitation", async () => {
    const ctx = makeContext(
      { elicitation: {} },
      {
        onSendRequest: async () => ({ action: "decline" }),
      },
    );

    const result = await askClarifyingQuestionsTool(
      { prompt: "Make this better", language: "en" },
      { ctx },
    );

    if ("is_error" in result) {
      throw new Error("expected success");
    }
    expect(result.interaction_status).toBe("declined");
    expect(result.answers_count).toBe(0);
  });

  it("returns timeout when the elicitation request rejects", async () => {
    const ctx = makeContext(
      { elicitation: {} },
      {
        onSendRequest: async () => {
          throw new Error("server request 'elicitation/create' timed out");
        },
      },
    );

    const result = await askClarifyingQuestionsTool(
      { prompt: "Make this better", language: "en" },
      { ctx },
    );

    if ("is_error" in result) {
      throw new Error("expected success");
    }
    expect(result.interaction_status).toBe("timeout");
    expect(result.next_action).toContain("native ask UI");
  });
});
