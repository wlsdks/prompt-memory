import { spawn } from "node:child_process";
import { platform as osPlatform } from "node:os";

export type NativeElicitInputPrompt = {
  axis: string;
  ask: string;
  example?: string;
};

export type NativeElicitInputResult = {
  action: "accept" | "decline" | "cancel" | "unsupported";
  content?: Record<string, string>;
};

export type NativeElicitInputOptions = {
  prompts: readonly NativeElicitInputPrompt[];
  /** Per-question timeout in seconds. Default 60. */
  timeoutSeconds?: number;
  /** Override platform detection (test injection). */
  platform?: NodeJS.Platform;
  /** Override the runner (test injection). Should resolve with stdout/exitCode. */
  runner?: NativeRunner;
};

export type NativeRunner = (
  command: string,
  args: readonly string[],
  options: { timeoutMs: number },
) => Promise<{ stdout: string; exitCode: number | null }>;

const DEFAULT_TIMEOUT_S = 60;

export async function nativeElicitInput(
  options: NativeElicitInputOptions,
): Promise<NativeElicitInputResult> {
  if (options.prompts.length === 0) {
    return { action: "accept", content: {} };
  }
  const platform = options.platform ?? osPlatform();
  if (platform === "darwin") {
    return runWithOsascript(options);
  }
  if (platform === "linux") {
    return runWithZenity(options);
  }
  if (platform === "win32") {
    return runWithPowershell(options);
  }
  return { action: "unsupported" };
}

async function runWithOsascript(
  options: NativeElicitInputOptions,
): Promise<NativeElicitInputResult> {
  const timeoutS = options.timeoutSeconds ?? DEFAULT_TIMEOUT_S;
  const runner = options.runner ?? defaultRunner;
  const collected: Record<string, string> = {};

  for (const prompt of options.prompts) {
    const dialogText = formatDialogText(prompt);
    const exampleDefault = prompt.example ?? "";
    const script = [
      `set theResult to display dialog ${quoteOsascript(dialogText)}`,
      `default answer ${quoteOsascript(exampleDefault)}`,
      `with title "prompt-memory"`,
      `buttons {"Cancel", "Submit"}`,
      `default button "Submit"`,
      `cancel button "Cancel"`,
      `giving up after ${timeoutS}`,
      `return (text returned of theResult) & ":::" & (gave up of theResult)`,
    ].join(" ");

    const result = await runner("osascript", ["-e", script], {
      timeoutMs: (timeoutS + 5) * 1000,
    });
    if (result.exitCode !== 0) {
      // osascript exits non-zero when the user clicks Cancel (-128).
      return { action: "cancel" };
    }
    const [text, gaveUp] = result.stdout.trim().split(":::");
    if (gaveUp === "true") {
      return { action: "cancel" };
    }
    if (typeof text !== "string" || text.trim().length === 0) {
      return { action: "decline" };
    }
    collected[prompt.axis] = text;
  }

  return { action: "accept", content: collected };
}

async function runWithZenity(
  options: NativeElicitInputOptions,
): Promise<NativeElicitInputResult> {
  const timeoutS = options.timeoutSeconds ?? DEFAULT_TIMEOUT_S;
  const runner = options.runner ?? defaultRunner;
  const collected: Record<string, string> = {};

  for (const prompt of options.prompts) {
    const text = formatDialogText(prompt);
    const args = [
      "--entry",
      `--title=prompt-memory`,
      `--text=${text}`,
      `--timeout=${timeoutS}`,
    ];
    if (prompt.example) {
      args.push(`--entry-text=${prompt.example}`);
    }
    const result = await runner("zenity", args, {
      timeoutMs: (timeoutS + 5) * 1000,
    });
    if (result.exitCode === 5) {
      // Zenity exit code 5 means timeout.
      return { action: "cancel" };
    }
    if (result.exitCode !== 0) {
      return { action: "cancel" };
    }
    const answer = result.stdout.replace(/\n+$/, "");
    if (answer.trim().length === 0) {
      return { action: "decline" };
    }
    collected[prompt.axis] = answer;
  }

  return { action: "accept", content: collected };
}

async function runWithPowershell(
  options: NativeElicitInputOptions,
): Promise<NativeElicitInputResult> {
  const timeoutS = options.timeoutSeconds ?? DEFAULT_TIMEOUT_S;
  const runner = options.runner ?? defaultRunner;
  const collected: Record<string, string> = {};

  for (const prompt of options.prompts) {
    const text = formatDialogText(prompt);
    const exampleDefault = prompt.example ?? "";
    // WinForms InputBox: returns empty string when the user clicks Cancel,
    // so empty input maps to "decline" downstream. Our timer wraps the
    // process lifetime since PowerShell offers no native dialog timeout.
    const script =
      `Add-Type -AssemblyName Microsoft.VisualBasic;` +
      `[Microsoft.VisualBasic.Interaction]::InputBox(` +
      `'${quotePowershell(text)}','prompt-memory','${quotePowershell(exampleDefault)}'` +
      `)`;
    const result = await runner(
      "powershell",
      ["-NoProfile", "-NonInteractive", "-Command", script],
      { timeoutMs: (timeoutS + 5) * 1000 },
    );
    if (result.exitCode === 124) {
      // Our timer kicked in before the user answered.
      return { action: "cancel" };
    }
    if (result.exitCode !== 0) {
      return { action: "cancel" };
    }
    const answer = result.stdout.replace(/\r?\n+$/, "");
    if (answer.trim().length === 0) {
      return { action: "decline" };
    }
    collected[prompt.axis] = answer;
  }

  return { action: "accept", content: collected };
}

function formatDialogText(prompt: NativeElicitInputPrompt): string {
  return `[${prompt.axis}] ${prompt.ask}`;
}

function quotePowershell(value: string): string {
  // PowerShell single-quoted strings escape ' by doubling it.
  return value.replaceAll("'", "''");
}

function quoteOsascript(value: string): string {
  // Wrap in double quotes and escape backslashes / double quotes the way
  // AppleScript expects in source-level strings.
  return `"${value.replaceAll("\\", "\\\\").replaceAll('"', '\\"')}"`;
}

const defaultRunner: NativeRunner = (command, args, runOptions) =>
  new Promise((resolve) => {
    const child = spawn(command, args, {
      stdio: ["ignore", "pipe", "pipe"],
    });
    let stdout = "";
    let stderr = "";
    let resolved = false;

    const finish = (exitCode: number | null): void => {
      if (resolved) return;
      resolved = true;
      // Surface stderr in stdout when the dialog reports an internal error.
      const merged = stdout || stderr;
      resolve({ stdout: merged, exitCode });
    };

    child.stdout?.on("data", (chunk: Buffer) => {
      stdout += chunk.toString("utf8");
    });
    child.stderr?.on("data", (chunk: Buffer) => {
      stderr += chunk.toString("utf8");
    });
    child.on("error", () => finish(null));
    child.on("close", (code) => finish(code));

    const timer = setTimeout(() => {
      child.kill();
      finish(124);
    }, runOptions.timeoutMs);
    child.on("close", () => clearTimeout(timer));
  });
