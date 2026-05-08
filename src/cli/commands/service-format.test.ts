import { describe, expect, it } from "vitest";

import {
  classifyLaunchctlError,
  explainLaunchctlError,
  formatServiceCommandPlain,
  formatServiceCommandJson,
  formatServiceInstallPlain,
  formatServiceInstallJson,
} from "./service-format.js";

describe("classifyLaunchctlError", () => {
  it("maps Bootstrap failed: 5 to already_loaded", () => {
    expect(
      classifyLaunchctlError("Bootstrap failed: 5: Input/output error"),
    ).toBe("already_loaded");
    expect(classifyLaunchctlError("service already bootstrapped")).toBe(
      "already_loaded",
    );
  });

  it("maps not-found stderr to not_loaded", () => {
    expect(
      classifyLaunchctlError(
        "Could not find specified service: gui/501/com.prompt-memory.server",
      ),
    ).toBe("not_loaded");
    expect(classifyLaunchctlError("service not loaded")).toBe("not_loaded");
    expect(
      classifyLaunchctlError("Bootout failed: 36: Operation now in progress"),
    ).toBe("not_loaded");
  });

  it("maps permission errors to denied", () => {
    expect(
      classifyLaunchctlError("Bootstrap failed: 1: Operation not permitted"),
    ).toBe("denied");
    expect(
      classifyLaunchctlError("Load failed: 5: Operation not permitted"),
    ).toBe("denied");
  });

  it("maps the explicit unsupported_platform sentinel", () => {
    expect(classifyLaunchctlError("unsupported_platform")).toBe(
      "unsupported_platform",
    );
  });

  it("falls back to unknown for unrecognized stderr", () => {
    expect(classifyLaunchctlError(undefined)).toBe("unknown");
    expect(classifyLaunchctlError("")).toBe("unknown");
    expect(classifyLaunchctlError("totally novel launchctl complaint")).toBe(
      "unknown",
    );
  });
});

describe("explainLaunchctlError", () => {
  it("returns a next-step hint per code", () => {
    expect(explainLaunchctlError("already_loaded")).toMatch(/already loaded/i);
    expect(explainLaunchctlError("already_loaded")).toMatch(
      /prompt-memory service stop/,
    );
    expect(explainLaunchctlError("not_loaded")).toMatch(
      /prompt-memory service install/,
    );
    expect(explainLaunchctlError("denied")).toMatch(/Full Disk Access/);
    expect(explainLaunchctlError("unsupported_platform")).toMatch(/macOS/);
    expect(explainLaunchctlError("unknown")).toMatch(/launchctl/);
  });
});

describe("formatServiceCommandPlain", () => {
  it("renders an ok start as a single confirmation line", () => {
    const text = formatServiceCommandPlain("start", {
      ok: true,
      supported: true,
    });
    expect(text).toBe("service started");
  });

  it("renders a friendly hint for already_loaded errors and does not echo the raw stderr", () => {
    const text = formatServiceCommandPlain("start", {
      ok: false,
      supported: true,
      error: "Bootstrap failed: 5: Input/output error",
    });
    expect(text).toMatch(/already loaded/i);
    expect(text).toMatch(/prompt-memory service stop/);
    expect(text).not.toContain("Bootstrap failed: 5");
  });

  it("appends raw launchctl stderr only when the error code is unknown", () => {
    const text = formatServiceCommandPlain("status", {
      ok: false,
      supported: true,
      error: "totally novel launchctl complaint",
    });
    expect(text).toMatch(
      /launchctl reported: totally novel launchctl complaint/,
    );
  });

  it("renders unsupported_platform without leaking the sentinel", () => {
    const text = formatServiceCommandPlain("status", {
      ok: false,
      supported: false,
      error: "unsupported_platform",
    });
    expect(text).not.toContain("unsupported_platform");
    expect(text).toMatch(/macOS/);
  });
});

describe("formatServiceCommandJson", () => {
  it("preserves the existing JSON contract and adds error_code/error_hint", () => {
    const json = formatServiceCommandJson({
      ok: false,
      supported: true,
      error:
        "Could not find specified service: gui/501/com.prompt-memory.server",
    });
    const parsed = JSON.parse(json);
    expect(parsed.ok).toBe(false);
    expect(parsed.supported).toBe(true);
    expect(parsed.error).toBe(
      "Could not find specified service: gui/501/com.prompt-memory.server",
    );
    expect(parsed.error_code).toBe("not_loaded");
    expect(parsed.error_hint).toMatch(/prompt-memory service install/);
  });

  it("omits error fields when ok is true", () => {
    const json = formatServiceCommandJson({ ok: true, supported: true });
    const parsed = JSON.parse(json);
    expect(parsed.ok).toBe(true);
    expect(parsed.error).toBeUndefined();
    expect(parsed.error_code).toBeUndefined();
    expect(parsed.error_hint).toBeUndefined();
  });
});

describe("formatServiceInstallPlain / Json", () => {
  it("plain summary lists what changed and which plist was written", () => {
    const text = formatServiceInstallPlain({
      supported: true,
      changed: true,
      dryRun: false,
      plistPath:
        "/Users/me/Library/LaunchAgents/com.prompt-memory.server.plist",
      backupPath: undefined,
      started: true,
    });
    expect(text).toMatch(/installed/);
    expect(text).toContain(
      "/Users/me/Library/LaunchAgents/com.prompt-memory.server.plist",
    );
    expect(text).toMatch(/started/);
  });

  it("plain summary surfaces start failures with the friendly hint", () => {
    const text = formatServiceInstallPlain({
      supported: true,
      changed: true,
      dryRun: false,
      plistPath: "/tmp/p.plist",
      started: false,
      startError: "Bootstrap failed: 1: Operation not permitted",
    });
    expect(text).toMatch(/Full Disk Access/);
    expect(text).not.toContain("Bootstrap failed: 1");
  });

  it("json summary keeps the snake_case wire shape", () => {
    const json = formatServiceInstallJson({
      supported: true,
      changed: false,
      dryRun: true,
      plistPath: "/tmp/p.plist",
      started: false,
    });
    const parsed = JSON.parse(json);
    expect(parsed).toEqual({
      supported: true,
      changed: false,
      dry_run: true,
      plist_path: "/tmp/p.plist",
      backup_path: undefined,
      started: false,
      start_error: undefined,
      start_error_code: undefined,
      start_error_hint: undefined,
    });
  });
});
