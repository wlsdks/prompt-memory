import { describe, expect, it } from "vitest";

import {
  diagnoseIngestFailure,
  type IngestFailureCause,
} from "./doctor-diagnose-ingest.js";
import type { DoctorCommandRunner } from "./doctor.js";

describe("diagnoseIngestFailure", () => {
  it("returns 'server_owner_mismatch' when the process bound to 17373 uses a different data-dir", () => {
    const runner = staticRunner({
      lsofStdout: "p99999\ncnode\n",
      psStdout:
        "/Users/x/.nvm/.../node /path/cli.js server --data-dir /tmp/pm-temp/data\n",
    });

    const diagnosis = diagnoseIngestFailure({
      tool: "claude-code",
      status: 401,
      configuredDataDir: "/Users/x/.prompt-coach",
      commandRunner: runner,
      readFile: () => undefined,
    });

    expect(diagnosis.cause).toBe<IngestFailureCause>("server_owner_mismatch");
    expect(diagnosis.hint).toContain("/tmp/pm-temp/data");
    expect(diagnosis.hint).toContain("/Users/x/.prompt-coach");
    expect(diagnosis.hint).toContain("prompt-coach service install");
  });

  it("returns 'node_abi_mismatch' when server.err.log contains a NODE_MODULE_VERSION error", () => {
    const runner = staticRunner({
      lsofStdout: "p99999\n",
      psStdout:
        "/path/node /path/cli.js server --data-dir /Users/x/.prompt-coach\n",
    });

    const diagnosis = diagnoseIngestFailure({
      tool: "claude-code",
      status: 401,
      configuredDataDir: "/Users/x/.prompt-coach",
      commandRunner: runner,
      readFile: () =>
        "Error: The module ... was compiled against a different Node.js version using NODE_MODULE_VERSION 115. This version of Node.js requires NODE_MODULE_VERSION 127.",
    });

    expect(diagnosis.cause).toBe<IngestFailureCause>("node_abi_mismatch");
    expect(diagnosis.hint).toContain("prompt-coach service install");
  });

  it("falls back to 'token_stale' when the bound server matches and no ABI error is logged", () => {
    const runner = staticRunner({
      lsofStdout: "p99999\n",
      psStdout:
        "/path/node /path/cli.js server --data-dir /Users/x/.prompt-coach\n",
    });

    const diagnosis = diagnoseIngestFailure({
      tool: "claude-code",
      status: 401,
      configuredDataDir: "/Users/x/.prompt-coach",
      commandRunner: runner,
      readFile: () => "",
    });

    expect(diagnosis.cause).toBe<IngestFailureCause>("token_stale");
    expect(diagnosis.hint).toContain("install-hook claude-code");
  });

  it("returns 'token_stale' when no command runner is wired (best-effort fallback)", () => {
    const diagnosis = diagnoseIngestFailure({
      tool: "claude-code",
      status: 401,
      configuredDataDir: "/Users/x/.prompt-coach",
      readFile: () => undefined,
    });

    expect(diagnosis.cause).toBe<IngestFailureCause>("token_stale");
  });

  it("returns 'unknown' when the failure status is not 401", () => {
    const diagnosis = diagnoseIngestFailure({
      tool: "claude-code",
      status: 500,
      configuredDataDir: "/Users/x/.prompt-coach",
      readFile: () => undefined,
    });

    expect(diagnosis.cause).toBe<IngestFailureCause>("unknown");
    expect(diagnosis.hint).toContain("buddy --once");
  });

  it("normalizes trailing slashes when comparing data dirs", () => {
    const runner = staticRunner({
      lsofStdout: "p99999\n",
      psStdout:
        "/path/node /path/cli.js server --data-dir /Users/x/.prompt-coach/\n",
    });

    const diagnosis = diagnoseIngestFailure({
      tool: "claude-code",
      status: 401,
      configuredDataDir: "/Users/x/.prompt-coach",
      commandRunner: runner,
      readFile: () => "",
    });

    expect(diagnosis.cause).toBe<IngestFailureCause>("token_stale");
  });
});

function staticRunner({
  lsofStdout,
  psStdout,
}: {
  lsofStdout: string;
  psStdout: string;
}): DoctorCommandRunner {
  return (command, _args) => {
    if (command === "lsof") {
      return { status: 0, stdout: lsofStdout };
    }
    if (command === "ps") {
      return { status: 0, stdout: psStdout };
    }
    return { status: 1 };
  };
}
