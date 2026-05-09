import { describe, expect, it } from "vitest";

import { askClarifyingQuestionsTool } from "./ask-clarifying-questions-tool.js";
import type { RpcChannel } from "./rpc-channel.js";
import type { PromptCoachMcpServerContext } from "./server.js";

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
): PromptCoachMcpServerContext {
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

  it("uses the native dialog fallback when allow_native_dialog is true and the client lacks elicitation", async () => {
    const calls: Array<{ command: string; args: readonly string[] }> = [];
    const result = await askClarifyingQuestionsTool({
      prompt: "Make this better",
      language: "en",
      allow_native_dialog: true,
      __nativeRunner: async (command, args) => {
        calls.push({ command, args });
        // Simulate the user typing an answer for whichever axis the dialog
        // is asking about. osascript stdout shape: text:::gaveUp.
        const axis = args
          .find((value) => /\[(.*?)\]/.test(value))
          ?.match(/\[(.*?)\]/)?.[1];
        const answer =
          axis === "goal_clarity"
            ? "Fix the delete API bug in src/server/routes/prompts.ts."
            : "Run pnpm test and confirm 0 failures.";
        return { stdout: `${answer}:::false`, exitCode: 0 };
      },
    });

    if ("is_error" in result) {
      throw new Error("expected success");
    }
    expect(calls.length).toBeGreaterThan(0);
    expect(result.interaction_status).toBe("answered");
    expect(result.analyzer).toBe("clarifications-v1");
    expect(result.improved_prompt).toContain("delete API");
  });

  it("returns timeout when the native dialog reports gave up:true", async () => {
    const result = await askClarifyingQuestionsTool({
      prompt: "Make this better",
      allow_native_dialog: true,
      __nativePlatform: "darwin",
      __nativeRunner: async () => ({
        stdout: ":::true",
        exitCode: 0,
      }),
    });

    if ("is_error" in result) {
      throw new Error("expected success");
    }
    expect(result.interaction_status).toBe("timeout");
  });

  it("respects allow_native_dialog=false even when env is set", async () => {
    const previous = process.env.PROMPT_COACH_NATIVE_DIALOG;
    process.env.PROMPT_COACH_NATIVE_DIALOG = "1";
    try {
      const result = await askClarifyingQuestionsTool({
        prompt: "Make this better",
        allow_native_dialog: false,
      });

      if ("is_error" in result) {
        throw new Error("expected success");
      }
      expect(result.interaction_status).toBe("unsupported");
    } finally {
      process.env.PROMPT_COACH_NATIVE_DIALOG = previous;
    }
  });

  it("uses powershell on win32 when allow_native_dialog is true", async () => {
    const { nativeElicitInput } = await import("./native-elicitation.js");
    const calls: Array<{ command: string; args: readonly string[] }> = [];
    const result = await nativeElicitInput({
      platform: "win32",
      prompts: [
        { axis: "goal_clarity", ask: "what to fix?", example: "fix delete" },
      ],
      timeoutSeconds: 5,
      runner: async (command, args) => {
        calls.push({ command, args });
        return { stdout: "Fix the delete API\r\n", exitCode: 0 };
      },
    });
    expect(calls[0]?.command).toBe("powershell");
    expect(calls[0]?.args.join(" ")).toContain("Microsoft.VisualBasic");
    expect(result).toEqual({
      action: "accept",
      content: { goal_clarity: "Fix the delete API" },
    });
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
