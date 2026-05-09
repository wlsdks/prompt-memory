import { spawnSync } from "node:child_process";

import type { Command } from "commander";

import { resolveCliEntryPath } from "../entry-path.js";
import { UserError } from "../user-error.js";

import type { BuddyStyle } from "./buddy.js";

export type Multiplexer = "tmux" | "cmux" | "none";

export type PanePosition = "right" | "left" | "top" | "bottom";

const PANE_POSITIONS: readonly PanePosition[] = [
  "right",
  "left",
  "top",
  "bottom",
];

const HUD_STYLES: readonly BuddyStyle[] = ["block", "line"];

export type DetectMultiplexerInput = {
  env?: NodeJS.ProcessEnv;
  hasCmux?: boolean;
};

export function detectMultiplexer({
  env = process.env,
  hasCmux,
}: DetectMultiplexerInput): Multiplexer {
  if (env.TMUX) {
    return "tmux";
  }
  if (hasCmux ?? false) {
    return "cmux";
  }
  return "none";
}

export type BuildBuddyArgvInput = {
  nodePath: string;
  cliEntryPath: string;
  style: BuddyStyle;
  interval: number;
  dataDir?: string;
};

export function buildBuddyArgv(input: BuildBuddyArgvInput): string[] {
  const argv: string[] = [
    input.nodePath,
    input.cliEntryPath,
    "buddy",
    "--style",
    input.style,
    "--interval",
    String(input.interval),
  ];
  if (input.dataDir) {
    argv.push("--data-dir", input.dataDir);
  }
  return argv;
}

export type BuildTmuxSplitArgvInput = {
  pane: PanePosition;
  buddyArgv: string[];
};

export function buildTmuxSplitArgv({
  pane,
  buddyArgv,
}: BuildTmuxSplitArgvInput): string[] {
  const argv: string[] = ["tmux", "split-window"];

  switch (pane) {
    case "right":
      argv.push("-h");
      break;
    case "left":
      argv.push("-h", "-b");
      break;
    case "top":
      argv.push("-v", "-b");
      break;
    case "bottom":
      argv.push("-v");
      break;
    default:
      throw new UserError(
        `Unsupported --pane value: ${String(pane)}. Use one of: ${PANE_POSITIONS.join(", ")}.`,
      );
  }

  argv.push(...buddyArgv);
  return argv;
}

export type CodexHudOptions = {
  multiplexer: Multiplexer;
  pane: PanePosition;
  style: BuddyStyle;
  interval: number;
  nodePath: string;
  cliEntryPath: string;
  dataDir?: string;
  dryRun?: boolean;
  json?: boolean;
};

export type CodexHudRenderResult = {
  text: string;
  executed: boolean;
  multiplexer: Multiplexer;
  command?: string[];
};

export function renderCodexHudInstall(
  options: CodexHudOptions,
): CodexHudRenderResult {
  validateOptions(options);

  const buddyArgv = buildBuddyArgv({
    nodePath: options.nodePath,
    cliEntryPath: options.cliEntryPath,
    style: options.style,
    interval: options.interval,
    dataDir: options.dataDir,
  });

  if (options.multiplexer === "tmux") {
    const command = buildTmuxSplitArgv({
      pane: options.pane,
      buddyArgv,
    });
    const text = options.json
      ? JSON.stringify(
          {
            multiplexer: "tmux",
            executed: false,
            command,
            pane: options.pane,
            style: options.style,
            interval: options.interval,
          },
          null,
          2,
        )
      : formatTmuxDryRun(command);
    return {
      text,
      executed: false,
      multiplexer: "tmux",
      command,
    };
  }

  if (options.multiplexer === "cmux") {
    const text = options.json
      ? JSON.stringify(
          {
            multiplexer: "cmux",
            executed: false,
            instructions: cmuxInstructions(buddyArgv, options),
          },
          null,
          2,
        )
      : formatCmuxInstructions(buddyArgv, options);
    return { text, executed: false, multiplexer: "cmux" };
  }

  const text = options.json
    ? JSON.stringify(
        {
          multiplexer: "none",
          executed: false,
          instructions: noneInstructions(buddyArgv, options),
        },
        null,
        2,
      )
    : formatNoneInstructions(buddyArgv, options);
  return { text, executed: false, multiplexer: "none" };
}

function validateOptions(options: CodexHudOptions): void {
  if (!PANE_POSITIONS.includes(options.pane)) {
    throw new UserError(
      `Unsupported --pane value: ${String(options.pane)}. Use one of: ${PANE_POSITIONS.join(", ")}.`,
    );
  }
  if (!HUD_STYLES.includes(options.style)) {
    throw new UserError(
      `Unsupported --style value: ${String(options.style)}. Use one of: ${HUD_STYLES.join(", ")}.`,
    );
  }
  if (!Number.isFinite(options.interval) || options.interval <= 0) {
    throw new UserError(
      `--interval must be a positive number of seconds (got ${String(options.interval)}).`,
    );
  }
}

function formatTmuxDryRun(command: string[]): string {
  const lines = [
    "Codex HUD via tmux (dry-run)",
    "",
    "  $ " + command.map(quoteForShell).join(" "),
    "",
    "Run without --dry-run to execute the split inside the current tmux session.",
  ];
  return lines.join("\n");
}

function formatCmuxInstructions(
  buddyArgv: string[],
  options: CodexHudOptions,
): string {
  const buddyCommand = buddyArgv.map(quoteForShell).join(" ");
  return [
    "Codex HUD via cmux",
    "",
    "  cmux does not expose a CLI split-pane command, so open a new pane",
    "  via cmux's split shortcut (default Cmd+D / Cmd+Shift+D) and run:",
    "",
    `    $ prompt-memory buddy --style ${options.style} --interval ${options.interval}`,
    "",
    "  If prompt-memory is not on PATH, use the absolute form:",
    `    $ ${buddyCommand}`,
  ].join("\n");
}

function formatNoneInstructions(
  buddyArgv: string[],
  options: CodexHudOptions,
): string {
  const buddyCommand = buddyArgv.map(quoteForShell).join(" ");
  return [
    "Codex HUD: no multiplexer detected",
    "",
    "  Open a separate terminal window or pane and run:",
    "",
    `    $ prompt-memory buddy --style ${options.style} --interval ${options.interval}`,
    "",
    "  If prompt-memory is not on PATH, use the absolute form:",
    `    $ ${buddyCommand}`,
  ].join("\n");
}

function cmuxInstructions(
  buddyArgv: string[],
  options: CodexHudOptions,
): { shortcut: string; buddy_command_pretty: string; buddy_argv: string[] } {
  return {
    shortcut: "cmux split shortcut (default Cmd+D / Cmd+Shift+D)",
    buddy_command_pretty: `prompt-memory buddy --style ${options.style} --interval ${options.interval}`,
    buddy_argv: buddyArgv,
  };
}

function noneInstructions(
  buddyArgv: string[],
  options: CodexHudOptions,
): { buddy_command_pretty: string; buddy_argv: string[] } {
  return {
    buddy_command_pretty: `prompt-memory buddy --style ${options.style} --interval ${options.interval}`,
    buddy_argv: buddyArgv,
  };
}

function quoteForShell(value: string): string {
  if (/^[A-Za-z0-9_./@:=+-]+$/.test(value)) {
    return value;
  }
  return `'${value.replace(/'/g, "'\\''")}'`;
}

export function registerInstallCodexHudCommand(program: Command): void {
  program
    .command("install-codex-hud")
    .description(
      "Install a side-pane HUD for Codex by spawning prompt-memory buddy in a tmux split (or printing instructions for cmux/no multiplexer).",
    )
    .option("--data-dir <path>", "Override the prompt-memory data directory.")
    .option(
      "--pane <position>",
      "Where to place the buddy pane (right, left, top, bottom).",
      "right",
    )
    .option("--style <style>", "Buddy output style (block or line).", "block")
    .option("--interval <seconds>", "Buddy refresh interval in seconds.", "5")
    .option(
      "--target <multiplexer>",
      "Force a multiplexer (auto, tmux, cmux, none).",
      "auto",
    )
    .option(
      "--dry-run",
      "Print the command that would be executed without spawning anything.",
    )
    .option("--json", "Print machine-readable JSON.")
    .action((cliOptions: Record<string, unknown>) => {
      const target = String(cliOptions.target ?? "auto") as
        | "auto"
        | Multiplexer;
      const multiplexer =
        target === "auto"
          ? detectMultiplexer({ hasCmux: hasCmuxOnPath() })
          : (target as Multiplexer);

      const options: CodexHudOptions = {
        multiplexer,
        pane: String(cliOptions.pane ?? "right") as PanePosition,
        style: String(cliOptions.style ?? "block") as BuddyStyle,
        interval: Number.parseFloat(String(cliOptions.interval ?? "5")),
        nodePath: process.execPath,
        cliEntryPath: resolveCliEntryPath(import.meta.url, "../index.js"),
        dataDir:
          typeof cliOptions.dataDir === "string"
            ? cliOptions.dataDir
            : undefined,
        dryRun: Boolean(cliOptions.dryRun),
        json: Boolean(cliOptions.json),
      };

      const result = renderCodexHudInstall(options);

      if (result.multiplexer === "tmux" && result.command && !options.dryRun) {
        const spawned = spawnSync(result.command[0], result.command.slice(1), {
          stdio: "inherit",
        });
        if (spawned.status === 0) {
          const message = options.json
            ? JSON.stringify(
                {
                  multiplexer: "tmux",
                  executed: true,
                  command: result.command,
                  pane: options.pane,
                  style: options.style,
                  interval: options.interval,
                },
                null,
                2,
              )
            : `Codex HUD launched in a tmux ${options.pane} pane.`;
          console.log(message);
          return;
        }
        throw new UserError(
          `Failed to spawn tmux split (status ${String(spawned.status)}). Re-run with --dry-run to inspect the command.`,
        );
      }

      console.log(result.text);
    });
}

function hasCmuxOnPath(): boolean {
  const probe = spawnSync("command", ["-v", "cmux"], {
    shell: true,
    stdio: ["ignore", "pipe", "ignore"],
  });
  if (probe.status === 0 && probe.stdout && probe.stdout.toString().trim()) {
    return true;
  }
  return false;
}
