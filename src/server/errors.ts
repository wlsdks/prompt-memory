export type ProblemDetails = {
  type: string;
  title: string;
  status: number;
  detail: string;
  instance?: string;
  errors?: Array<{ field: string; message: string }>;
};

export class HttpProblem extends Error {
  readonly problem: ProblemDetails;

  constructor(problem: ProblemDetails) {
    super(problem.detail);
    this.problem = problem;
  }
}

export function problem(
  status: number,
  title: string,
  detail: string,
  instance?: string,
  errors?: Array<{ field: string; message: string }>,
): HttpProblem {
  return new HttpProblem({
    type: `https://prompt-coach.local/errors/${toKebabCase(title)}`,
    title,
    status,
    detail,
    instance,
    errors,
  });
}

function toKebabCase(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}
