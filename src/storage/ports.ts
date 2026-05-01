import type {
  NormalizedPromptEvent,
  RedactionResult,
} from "../shared/schema.js";

export type StorePromptInput = {
  event: NormalizedPromptEvent;
  redaction: RedactionResult;
};

export type StorePromptResult = {
  id: string;
  duplicate: boolean;
};

export type PromptSummary = {
  id: string;
  tool: string;
  source_event: string;
  session_id: string;
  cwd: string;
  created_at: string;
  received_at: string;
  prompt_length: number;
  is_sensitive: boolean;
  excluded_from_analysis: boolean;
  redaction_policy: string;
  adapter_version: string;
  index_status: string;
};

export type PromptDetail = PromptSummary & {
  markdown: string;
};

export type ListPromptsOptions = {
  limit?: number;
  cursor?: string;
};

export type SearchPromptsOptions = {
  limit?: number;
};

export type PromptListResult = {
  items: PromptSummary[];
  nextCursor?: string;
};

export type DeletePromptResult = {
  deleted: boolean;
};

export type PromptStoragePort = {
  storePrompt(input: StorePromptInput): Promise<StorePromptResult>;
};

export type PromptReadStoragePort = {
  listPrompts(options?: ListPromptsOptions): PromptListResult;
  searchPrompts(
    query: string,
    options?: SearchPromptsOptions,
  ): PromptListResult;
  getPrompt(id: string): PromptDetail | undefined;
  deletePrompt(id: string): DeletePromptResult;
};
