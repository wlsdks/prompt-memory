import type { FastifyInstance } from "fastify";
import type { Command } from "commander";

import { loadHookAuth, loadPromptMemoryConfig } from "../../config/config.js";
import { createServer } from "../../server/create-server.js";
import { createSqlitePromptStorage } from "../../storage/sqlite.js";

export type ServerCommandOptions = {
  dataDir?: string;
};

export type StartedServer = {
  url: string;
  server: FastifyInstance;
  close(): Promise<void>;
};

export function registerServerCommand(program: Command): void {
  program
    .command("server")
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
  });
  const server = createServer({
    dataDir: config.data_dir,
    auth: {
      appToken: hookAuth.app_token,
      ingestToken: hookAuth.ingest_token,
    },
    storage,
    redactionMode: config.redaction_mode,
  });
  const url = await server.listen({
    host: config.server.host,
    port: config.server.port,
  });

  return {
    url,
    server,
    async close() {
      await server.close();
      storage.close();
    },
  };
}
