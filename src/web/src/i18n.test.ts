import { afterEach, describe, expect, it, vi } from "vitest";

import { detectInitialLanguage } from "./i18n.js";

afterEach(() => {
  vi.unstubAllGlobals();
});

function stubWindow(
  navigatorLanguage: string | undefined,
  storedLanguage: string | null,
): void {
  vi.stubGlobal("window", {
    localStorage: { getItem: () => storedLanguage },
    navigator: navigatorLanguage ? { language: navigatorLanguage } : undefined,
  });
}

describe("detectInitialLanguage", () => {
  it("prefers the persisted language regardless of navigator", () => {
    stubWindow("ko-KR", "en");
    expect(detectInitialLanguage()).toBe("en");
  });

  it("returns ko when navigator.language starts with ko and nothing is stored", () => {
    stubWindow("ko-KR", null);
    expect(detectInitialLanguage()).toBe("ko");
  });

  it("returns ko for any ko-* locale variant", () => {
    stubWindow("KO", null);
    expect(detectInitialLanguage()).toBe("ko");
  });

  it("falls back to en when navigator.language is missing", () => {
    stubWindow(undefined, null);
    expect(detectInitialLanguage()).toBe("en");
  });

  it("falls back to en for non-Korean locales", () => {
    stubWindow("en-US", null);
    expect(detectInitialLanguage()).toBe("en");
  });
});
