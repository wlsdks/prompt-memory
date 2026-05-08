import { redactPrompt } from "../redaction/redact.js";
import type {
  NormalizedPromptEvent,
  RedactionPolicy,
} from "../shared/schema.js";
import type { ProjectPolicyStoragePort, PromptStoragePort } from "./ports.js";

export type IngestPromptStorage = PromptStoragePort &
  Partial<ProjectPolicyStoragePort>;

export type IngestPromptOptions = {
  redactionMode: RedactionPolicy;
};

export type IngestPromptResult =
  | {
      stored: true;
      id: string;
      duplicate: boolean;
      sensitive: boolean;
    }
  | {
      stored: false;
      reason: "project_policy" | "policy_lookup_failed" | "redaction_rejected";
    };

export async function ingestPrompt(
  storage: IngestPromptStorage,
  event: NormalizedPromptEvent,
  options: IngestPromptOptions,
): Promise<IngestPromptResult> {
  const policy = readProjectPolicy(storage, event);
  if (policy === "lookup_failed") {
    return { stored: false, reason: "policy_lookup_failed" };
  }
  if (policy?.capture_disabled) {
    return { stored: false, reason: "project_policy" };
  }

  const redaction = redactPrompt(event.prompt, options.redactionMode);
  if (options.redactionMode === "reject" && redaction.is_sensitive) {
    return { stored: false, reason: "redaction_rejected" };
  }

  const stored = await storage.storePrompt({ event, redaction });
  return {
    stored: true,
    id: stored.id,
    duplicate: stored.duplicate,
    sensitive: redaction.is_sensitive,
  };
}

function readProjectPolicy(
  storage: IngestPromptStorage,
  event: NormalizedPromptEvent,
):
  | ReturnType<ProjectPolicyStoragePort["getProjectPolicyForEvent"]>
  | "lookup_failed" {
  if (!storage.getProjectPolicyForEvent) {
    return undefined;
  }
  try {
    return storage.getProjectPolicyForEvent({
      cwd: event.cwd,
      project_root: event.project_root,
    });
  } catch {
    return "lookup_failed";
  }
}
