import { describe, expect, it } from "vitest";

import { UserError, isUserError } from "./user-error.js";

describe("UserError", () => {
  it("is an Error subclass with the isUserError discriminator", () => {
    const error = new UserError("boom");
    expect(error).toBeInstanceOf(Error);
    expect(error.message).toBe("boom");
    expect(error.name).toBe("UserError");
    expect(error.isUserError).toBe(true);
  });

  it("isUserError narrows tagged Error instances", () => {
    expect(isUserError(new UserError("nope"))).toBe(true);
    expect(isUserError(new Error("plain"))).toBe(false);
    expect(isUserError(undefined)).toBe(false);
    expect(isUserError({ isUserError: true })).toBe(false);
  });
});
