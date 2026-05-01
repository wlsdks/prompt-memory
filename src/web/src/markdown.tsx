import type { ReactElement } from "react";

const SAFE_LINK_PROTOCOLS = new Set(["http:", "https:"]);

export function SafeMarkdown({ markdown }: { markdown: string }): ReactElement {
  return (
    <div className="markdown">
      {markdown.split(/\n{2,}/).map((block, index) => (
        <MarkdownBlock block={block} key={`${index}-${block.slice(0, 12)}`} />
      ))}
    </div>
  );
}

function MarkdownBlock({ block }: { block: string }): ReactElement {
  if (block.startsWith("```")) {
    return <pre>{stripFence(block)}</pre>;
  }

  if (block.startsWith("# ")) {
    return <h1>{renderInline(block.slice(2))}</h1>;
  }

  if (block.startsWith("## ")) {
    return <h2>{renderInline(block.slice(3))}</h2>;
  }

  if (block.startsWith("- ")) {
    return (
      <ul>
        {block.split("\n").map((line) => (
          <li key={line}>{renderInline(line.replace(/^- /, ""))}</li>
        ))}
      </ul>
    );
  }

  return <p>{renderInline(block)}</p>;
}

function renderInline(text: string): Array<string | ReactElement> {
  const nodes: Array<string | ReactElement> = [];
  const linkPattern = /(?<!!)\[([^\]]+)\]\(([^)]+)\)/g;
  let lastIndex = 0;
  let match;

  while ((match = linkPattern.exec(text))) {
    nodes.push(text.slice(lastIndex, match.index));
    const label = match[1] ?? "";
    const href = sanitizeHref(match[2] ?? "");
    nodes.push(
      href ? (
        <a href={href} key={`${label}-${href}`} rel="noreferrer">
          {label}
        </a>
      ) : (
        label
      ),
    );
    lastIndex = match.index + match[0].length;
  }

  nodes.push(text.slice(lastIndex));
  return nodes;
}

function sanitizeHref(href: string): string | undefined {
  if (href.startsWith("/") && !href.startsWith("//")) {
    return href;
  }

  try {
    const url = new URL(href);
    return SAFE_LINK_PROTOCOLS.has(url.protocol) ? href : undefined;
  } catch {
    return undefined;
  }
}

function stripFence(block: string): string {
  return block.replace(/^```[^\n]*\n?/, "").replace(/\n?```$/, "");
}
