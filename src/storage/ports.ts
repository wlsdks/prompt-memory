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

export type PromptStoragePort = {
  storePrompt(input: StorePromptInput): Promise<StorePromptResult>;
};
