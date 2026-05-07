import type { FastifyInstance } from "fastify";
import type { Command } from "commander";
import { fileURLToPath } from "node:url";

import { loadHookAuth, loadPromptMemoryConfig } from "../../config/config.js";
import {
  createJudgeWorker,
  type JudgeWorker,
} from "../../judge/judge-worker.js";
import { createServer } from "../../server/create-server.js";
import { createSqlitePromptStorage } from "../../storage/sqlite.js";

export type ServerCommandOptions = {
  dataDir?: string;
};

export type StartedServer = {
  url: string;
  server: FastifyInstance;
  judgeWorker: JudgeWorker;
  close(): Promise<void>;
};

export function registerServerCommand(program: Command): void {
  program
    .command("server")
    .description(
      "Run the local prompt-memory HTTP server (web UI, capture, MCP routes).",
    )
    .option("--data-dir <path>", "Override the prompt-memory data directory.")
    .action(async (options: ServerCommandOptions) => {
      const started = await startPromptMemoryServer(options);
      console.log(started.url);
    });
}

export async function startPromptMemoryServer(
  options: ServerCommandOptions = {},
): Promise<StartedServer> {
  const config = loadPromptMemoryConfig(options.dataDir);
  const hookAuth = loadHookAuth(options.dataDir);
  const storage = createSqlitePromptStorage({
    dataDir: config.data_dir,
    hmacSecret: hookAuth.web_session_secret,
    experimentalRules: config.experimental_rules,
  });
  const server = createServer({
    dataDir: config.data_dir,
    auth: {
      appToken: hookAuth.app_token,
      ingestToken: hookAuth.ingest_token,
      webSessionSecret: hookAuth.web_session_secret,
    },
    storage,
    redactionMode: config.redaction_mode,
    serverConfig: config.server,
    autoJudge: config.auto_judge,
    webRoot: fileURLToPath(new URL("../../web", import.meta.url)),
  });
  const url = await server.listen({
    host: config.server.host,
    port: config.server.port,
  });

  const judgeWorker = createJudgeWorker({
    storage,
    getSettings: () => loadPromptMemoryConfig(options.dataDir).auto_judge,
  });
  judgeWorker.start();

  return {
    url,
    server,
    judgeWorker,
    async close() {
      judgeWorker.stop();
      await server.close();
      storage.close();
    },
  };
}
