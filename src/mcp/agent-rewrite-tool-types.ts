import type { PromptQualityCriterion } from "../shared/schema.js";
import type { AgentJudgeProvider } from "../storage/ports.js";

export type PrepareAgentRewriteToolArguments = {
  prompt_id?: string;
  latest?: boolean;
  language?: "en" | "ko";
  include_local_baseline?: boolean;
};

export type RecordAgentRewriteToolArguments = {
  provider: AgentJudgeProvider;
  prompt_id: string;
  improved_prompt: string;
  judge_model?: string;
  confidence?: number;
  summary?: string;
  changed_sections?: PromptQualityCriterion[];
  safety_notes?: string[];
  copied?: boolean;
  accepted?: boolean;
};

export type PrepareAgentRewriteToolResult =
  | {
      mode: "agent_rewrite_packet";
      generated_at: string;
      prompt: {
        prompt_id: string;
        tool: string;
        project: string;
        received_at: string;
        local_score: {
          value: number;
          max: 100;
          band: string;
        };
        quality_gaps: string[];
        redacted_prompt: string;
      };
      local_baseline?: {
        analyzer: string;
        improved_prompt: string;
        changed_sections: PromptQualityCriterion[];
      };
      rewrite_contract: {
        required_sections: string[];
        constraints: string[];
        success_criteria: string[];
      };
      agent_instructions: string;
      privacy: {
        local_only: true;
        external_calls_by_prompt_memory: false;
        intended_external_rewriter: "current_agent_session";
        returns_redacted_prompt_body: true;
        returns_raw_prompt_body: false;
        returns_raw_paths: false;
        stores_rewrite_result: false;
        auto_submits: false;
      };
    }
  | {
      is_error: true;
      error_code: "invalid_input" | "not_found" | "storage_unavailable";
      message: string;
    };

export type RecordAgentRewriteToolResult =
  | {
      recorded: true;
      draft: {
        id: string;
        prompt_id: string;
        analyzer: string;
        changed_sections: PromptQualityCriterion[];
        safety_notes: string[];
        is_sensitive: boolean;
        redaction_policy: "mask";
        created_at: string;
        copied_at?: string;
        accepted_at?: string;
      };
      agent_metadata: {
        provider: AgentJudgeProvider;
        judge_model?: string;
        confidence?: number;
        summary?: string;
      };
      next_action: string;
      privacy: {
        local_only: true;
        external_calls_by_prompt_memory: false;
        stores_original_prompt_body: false;
        stores_rewrite_draft: true;
        returns_rewrite_draft: false;
        stores_raw_paths: false;
      };
    }
  | {
      is_error: true;
      error_code: "invalid_input" | "not_found" | "storage_unavailable";
      message: string;
    };
