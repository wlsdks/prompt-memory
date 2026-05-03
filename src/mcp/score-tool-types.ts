import type { ArchiveScoreReport } from "../analysis/archive-score.js";
import type { PromptImprovement } from "../analysis/improve.js";
import type {
  PromptAnalysisPreview,
  PromptQualityScore,
} from "../shared/schema.js";
import type { ProjectInstructionReview } from "../storage/ports.js";

export type ScorePromptToolArguments = {
  prompt?: string;
  prompt_id?: string;
  latest?: boolean;
  include_suggestions?: boolean;
};

export type ImprovePromptToolArguments = {
  prompt?: string;
  prompt_id?: string;
  latest?: boolean;
  language?: "en" | "ko";
};

export type ScorePromptToolOptions = {
  dataDir?: string;
  now?: Date;
};

export type ScorePromptArchiveToolArguments = {
  max_prompts?: number;
  low_score_limit?: number;
  tool?: string;
  cwd_prefix?: string;
  received_from?: string;
  received_to?: string;
};

export type ReviewProjectInstructionsToolArguments = {
  project_id?: string;
  latest?: boolean;
  analyze?: boolean;
  include_suggestions?: boolean;
};

export type GetPromptMemoryStatusToolArguments = {
  include_latest?: boolean;
};

export type CoachPromptToolArguments = {
  include_latest_score?: boolean;
  include_improvement?: boolean;
  include_archive?: boolean;
  include_project_rules?: boolean;
  max_prompts?: number;
  low_score_limit?: number;
  language?: "en" | "ko";
};

export type ScorePromptToolResult =
  | {
      source: "text" | "prompt_id" | "latest";
      prompt_id?: string;
      quality_score: PromptQualityScore;
      summary: string;
      checklist: Array<
        PromptAnalysisPreview["checklist"][number] & {
          weight: number;
          earned: number;
        }
      >;
      warnings: string[];
      suggestions?: string[];
      analyzer: string;
      privacy: {
        local_only: true;
        stores_input: false;
        external_calls: false;
        returns_prompt_body: false;
      };
    }
  | {
      is_error: true;
      error_code: "invalid_input" | "not_found" | "storage_unavailable";
      message: string;
    };

export type ScorePromptArchiveToolResult =
  | ArchiveScoreReport
  | {
      is_error: true;
      error_code: "storage_unavailable";
      message: string;
    };

export type ImprovePromptToolResult =
  | (PromptImprovement & {
      source: "text" | "prompt_id" | "latest";
      prompt_id?: string;
      rewrite_source: "direct_prompt" | "redacted_stored_prompt";
      next_action: string;
      privacy: {
        local_only: true;
        stores_input: false;
        external_calls: false;
        returns_stored_prompt_body: false;
      };
    })
  | {
      is_error: true;
      error_code: "invalid_input" | "not_found" | "storage_unavailable";
      message: string;
    };

export type ReviewProjectInstructionsToolResult =
  | {
      source: "project_id" | "latest";
      project_id: string;
      project_label: string;
      generated_fresh: boolean;
      review: ProjectInstructionReview;
      suggestions?: string[];
      next_action: string;
      privacy: ProjectInstructionReview["privacy"];
    }
  | {
      is_error: true;
      error_code: "invalid_input" | "not_found" | "storage_unavailable";
      message: string;
    };

export type GetPromptMemoryStatusToolResult = {
  status: "ready" | "empty" | "setup_needed";
  total_prompts: number;
  scored_prompts: number;
  sensitive_prompts: number;
  project_count: number;
  latest_prompt?: {
    id: string;
    tool: string;
    project: string;
    received_at: string;
    quality_score: number;
    quality_score_band: string;
    is_sensitive: boolean;
  };
  available_tools: string[];
  next_actions: string[];
  privacy: {
    local_only: true;
    external_calls: false;
    returns_prompt_bodies: false;
    returns_raw_paths: false;
  };
};

export type CoachPromptToolResult = {
  mode: "agent_coach";
  generated_at: string;
  status: GetPromptMemoryStatusToolResult;
  latest_score?: ScorePromptToolResult;
  improvement?: ImprovePromptToolResult;
  archive?: ScorePromptArchiveToolResult;
  project_rules?: ReviewProjectInstructionsToolResult;
  agent_brief: {
    headline: string;
    summary: string;
    next_actions: string[];
    suggested_user_response: string;
  };
  privacy: {
    local_only: true;
    external_calls: false;
    returns_prompt_bodies: false;
    returns_raw_paths: false;
    returns_instruction_file_bodies: false;
    auto_submits: false;
  };
};
