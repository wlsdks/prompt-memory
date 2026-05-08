import {
  chmodSync,
  existsSync,
  mkdirSync,
  readFileSync,
  writeFileSync,
} from "node:fs";
import { dirname } from "node:path";

import { z } from "zod";

import { getPromptMemoryPaths, supportsPosixMode } from "../storage/paths.js";
import {
  generateAppToken,
  generateIngestToken,
  generateWebSessionSecret,
} from "./tokens.js";

export const ServerConfigSchema = z.object({
  host: z.string().default("127.0.0.1"),
  port: z.number().int().positive().max(65535).default(17373),
});

export type ServerConfig = z.infer<typeof ServerConfigSchema>;

export const DEFAULT_SERVER_CONFIG: ServerConfig = {
  host: "127.0.0.1",
  port: 17373,
};

export const AutoJudgeSettingsSchema = z.object({
  enabled: z.boolean().default(false),
  tool: z.enum(["claude", "codex"]).default("claude"),
  daily_limit: z.number().int().nonnegative().max(10_000).default(50),
  per_minute_limit: z.number().int().nonnegative().max(60).default(5),
});

export type AutoJudgeSettings = z.infer<typeof AutoJudgeSettingsSchema>;

export const DEFAULT_AUTO_JUDGE_SETTINGS: AutoJudgeSettings = {
  enabled: false,
  tool: "claude",
  daily_limit: 50,
  per_minute_limit: 5,
};

export const ExperimentalRulesSchema = z
  .array(z.enum(["verification_v2"]))
  .max(20)
  .default([]);

export type ExperimentalRulesSetting = z.infer<typeof ExperimentalRulesSchema>;

export const PromptMemoryConfigSchema = z.object({
  schema_version: z.literal(1),
  data_dir: z.string().min(1),
  database_path: z.string().min(1),
  prompts_dir: z.string().min(1),
  logs_dir: z.string().min(1),
  spool_dir: z.string().min(1),
  quarantine_dir: z.string().min(1),
  redaction_mode: z.enum(["mask", "raw", "reject"]).default("mask"),
  server: ServerConfigSchema,
  auto_judge: AutoJudgeSettingsSchema.default(DEFAULT_AUTO_JUDGE_SETTINGS),
  experimental_rules: ExperimentalRulesSchema,
  excluded_project_roots: z.array(z.string()).default([]),
});

export const HookAuthSchema = z.object({
  schema_version: z.literal(1),
  app_token: z.string().min(1),
  ingest_token: z.string().min(1),
  web_session_secret: z.string().min(1),
  created_at: z.string().min(1),
});

export type PromptMemoryConfig = z.infer<typeof PromptMemoryConfigSchema>;
export type HookAuth = z.infer<typeof HookAuthSchema>;

export type InitOptions = {
  dataDir?: string;
  now?: Date;
};

export type InitResult = {
  config: PromptMemoryConfig;
  hookAuth: HookAuth;
  created: {
    config: boolean;
    hookAuth: boolean;
  };
};

const OWNER_ONLY_DIR_MODE = 0o700;
const OWNER_ONLY_FILE_MODE = 0o600;

export function initializePromptMemory(options: InitOptions = {}): InitResult {
  const paths = getPromptMemoryPaths(options.dataDir);
  const createdAt = (options.now ?? new Date()).toISOString();

  ensureOwnerOnlyDir(paths.dataDir);
  ensureOwnerOnlyDir(paths.promptsDir);
  ensureOwnerOnlyDir(paths.logsDir);
  ensureOwnerOnlyDir(paths.spoolDir);
  ensureOwnerOnlyDir(paths.quarantineDir);

  const existingConfig = readJsonIfExists(
    paths.configPath,
    PromptMemoryConfigSchema,
  );
  const config =
    existingConfig ??
    PromptMemoryConfigSchema.parse({
      schema_version: 1,
      data_dir: paths.dataDir,
      database_path: paths.databasePath,
      prompts_dir: paths.promptsDir,
      logs_dir: paths.logsDir,
      spool_dir: paths.spoolDir,
      quarantine_dir: paths.quarantineDir,
      redaction_mode: "mask",
      server: DEFAULT_SERVER_CONFIG,
    });

  const existingHookAuth = readJsonIfExists(paths.hookAuthPath, HookAuthSchema);
  const hookAuth =
    existingHookAuth ??
    HookAuthSchema.parse({
      schema_version: 1,
      app_token: generateAppToken(),
      ingest_token: generateIngestToken(),
      web_session_secret: generateWebSessionSecret(),
      created_at: createdAt,
    });

  writeOwnerOnlyJson(paths.configPath, config);
  writeOwnerOnlyJson(paths.hookAuthPath, hookAuth);

  return {
    config,
    hookAuth,
    created: {
      config: !existingConfig,
      hookAuth: !existingHookAuth,
    },
  };
}

export function loadPromptMemoryConfig(dataDir?: string): PromptMemoryConfig {
  const paths = getPromptMemoryPaths(dataDir);
  return PromptMemoryConfigSchema.parse(
    JSON.parse(readFileSync(paths.configPath, "utf8")),
  );
}

export function loadHookAuth(dataDir?: string): HookAuth {
  const paths = getPromptMemoryPaths(dataDir);
  return HookAuthSchema.parse(
    JSON.parse(readFileSync(paths.hookAuthPath, "utf8")),
  );
}

export function writeHookAuth(
  dataDir: string | undefined,
  hookAuth: HookAuth,
): void {
  const paths = getPromptMemoryPaths(dataDir);
  writeOwnerOnlyJson(paths.hookAuthPath, HookAuthSchema.parse(hookAuth));
}

export function updateAutoJudgeSettings(
  dataDir: string | undefined,
  patch: Partial<AutoJudgeSettings>,
): AutoJudgeSettings {
  const paths = getPromptMemoryPaths(dataDir);
  const current = loadPromptMemoryConfig(dataDir);
  const next = AutoJudgeSettingsSchema.parse({
    ...current.auto_judge,
    ...patch,
  });
  const updatedConfig = PromptMemoryConfigSchema.parse({
    ...current,
    auto_judge: next,
  });
  writeOwnerOnlyJson(paths.configPath, updatedConfig);
  return next;
}

export function revokeIngestToken(dataDir?: string): HookAuth {
  const hookAuth = loadHookAuth(dataDir);
  const next = HookAuthSchema.parse({
    ...hookAuth,
    ingest_token: generateIngestToken(),
  });

  writeHookAuth(dataDir, next);
  return next;
}

function readJsonIfExists<TSchema extends z.ZodType>(
  path: string,
  schema: TSchema,
): z.infer<TSchema> | undefined {
  if (!existsSync(path)) {
    return undefined;
  }

  return schema.parse(JSON.parse(readFileSync(path, "utf8")));
}

function ensureOwnerOnlyDir(path: string): void {
  mkdirSync(path, { recursive: true, mode: OWNER_ONLY_DIR_MODE });

  if (supportsPosixMode()) {
    chmodSync(path, OWNER_ONLY_DIR_MODE);
  }
}

function writeOwnerOnlyJson(path: string, value: unknown): void {
  mkdirSync(dirname(path), { recursive: true, mode: OWNER_ONLY_DIR_MODE });
  writeFileSync(path, `${JSON.stringify(value, null, 2)}\n`, {
    mode: OWNER_ONLY_FILE_MODE,
  });

  if (supportsPosixMode()) {
    chmodSync(path, OWNER_ONLY_FILE_MODE);
  }
}
