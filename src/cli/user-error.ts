export class UserError extends Error {
  readonly isUserError = true as const;
  constructor(message: string) {
    super(message);
    this.name = "UserError";
  }
}

export function isUserError(value: unknown): value is UserError {
  return (
    value instanceof Error &&
    (value as { isUserError?: unknown }).isUserError === true
  );
}
