import type { PromptQualityScore } from "../shared/schema.js";
import type {
  AgentJudgeProvider,
  AgentPromptJudgment,
} from "../storage/ports.js";

export type PrepareAgentJudgeBatchToolArguments = {
  max_prompts?: number;
  selection?: "latest" | "low_score";
  tool?: string;
  cwd_prefix?: string;
  include_redacted_prompt?: boolean;
};

export type RecordAgentJudgmentsToolArguments = {
  provider: AgentJudgeProvider;
  judge_model?: string;
  judgments: Array<{
    prompt_id: string;
    score: number;
    confidence: number;
    summary: string;
    strengths?: string[];
    risks?: string[];
    suggestions?: string[];
  }>;
};

export type PrepareAgentJudgeBatchToolResult =
  | {
      mode: "agent_judge_packet";
      generated_at: string;
      selection: "latest" | "low_score";
      rubric: {
        scale: "0-100";
        criteria: Array<{
          key: string;
          label: string;
          weight: number;
          guidance: string;
        }>;
      };
      prompts: Array<{
        prompt_id: string;
        tool: string;
        project: string;
        received_at: string;
        local_score: PromptQualityScore;
        quality_gaps: string[];
        redacted_prompt?: string;
      }>;
      agent_instructions: string;
      privacy: {
        local_only: true;
        external_calls_by_prompt_coach: false;
        intended_external_evaluator: "current_agent_session";
        returns_redacted_prompt_bodies: boolean;
        returns_raw_prompt_bodies: false;
        returns_raw_paths: false;
        stores_judgment_results: false;
        auto_submits: false;
      };
    }
  | {
      is_error: true;
      error_code: "invalid_input" | "not_found" | "storage_unavailable";
      message: string;
    };

export type RecordAgentJudgmentsToolResult =
  | {
      recorded: number;
      judgments: AgentPromptJudgment[];
      failed_prompt_ids: string[];
      next_action: string;
      privacy: {
        local_only: true;
        external_calls_by_prompt_coach: false;
        stores_prompt_bodies: false;
        stores_raw_paths: false;
        stores_judgment_results: true;
      };
    }
  | {
      is_error: true;
      error_code: "invalid_input" | "storage_unavailable";
      message: string;
    };
