import { mkdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";
import YAML from "yaml";

export type MarkdownWriteResult = {
  path: string;
  size: number;
  mtimeMs: number;
};

export function writePromptMarkdown(
  path: string,
  frontmatter: Record<string, unknown>,
  body: string,
): MarkdownWriteResult {
  mkdirSync(dirname(path), { recursive: true, mode: 0o700 });

  const document = `---\n${YAML.stringify(frontmatter)}---\n\n${body}\n`;
  writeFileSync(path, document, { mode: 0o600, flag: "wx" });

  const stat = statSync(path);
  return {
    path,
    size: stat.size,
    mtimeMs: stat.mtimeMs,
  };
}

export function readPromptMarkdown(path: string): string {
  return readFileSync(path, "utf8");
}

export function parsePromptMarkdown(path: string): {
  frontmatter: Record<string, unknown>;
  body: string;
} {
  const markdown = readPromptMarkdown(path);

  if (!markdown.startsWith("---\n")) {
    return { frontmatter: {}, body: markdown };
  }

  const delimiter = markdown.indexOf("\n---\n", 4);

  if (delimiter === -1) {
    return { frontmatter: {}, body: markdown };
  }

  const body = markdown.slice(delimiter + "\n---\n".length).trimStart();
  const frontmatter = parseFrontmatter(markdown.slice(4, delimiter));

  return { frontmatter, body };
}

function parseFrontmatter(yaml: string): Record<string, unknown> {
  let value: unknown;
  try {
    value = YAML.parse(yaml);
  } catch {
    return {};
  }
  return typeof value === "object" && value !== null
    ? (value as Record<string, unknown>)
    : {};
}
