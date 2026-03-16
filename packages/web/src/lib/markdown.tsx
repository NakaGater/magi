import { type ReactNode } from "react";

// Inline parser: **bold**, `code`, _italic_
function parseInline(text: string): ReactNode[] {
  const INLINE_RE = /\*\*(.+?)\*\*|`([^`]+)`|(?<![a-zA-Z0-9])_(.+?)_(?![a-zA-Z0-9])/g;
  const nodes: ReactNode[] = [];
  let cursor = 0;
  let key = 0;

  for (const m of text.matchAll(INLINE_RE)) {
    const start = m.index!;
    if (start > cursor) nodes.push(text.slice(cursor, start));

    if (m[1] != null) {
      nodes.push(
        <strong key={key++} className="font-semibold">
          {m[1]}
        </strong>,
      );
    } else if (m[2] != null) {
      nodes.push(
        <code
          key={key++}
          className="bg-surface-2 rounded px-1.5 py-0.5 font-mono text-xs"
        >
          {m[2]}
        </code>,
      );
    } else if (m[3] != null) {
      nodes.push(
        <em key={key++} className="italic">
          {m[3]}
        </em>,
      );
    }
    cursor = start + m[0].length;
  }

  if (cursor < text.length) nodes.push(text.slice(cursor));
  return nodes.length > 0 ? nodes : [text];
}

type Block =
  | { type: "heading"; level: number; text: string }
  | { type: "code"; lines: string[] }
  | { type: "ul"; items: string[] }
  | { type: "ol"; items: string[] }
  | { type: "text"; text: string };

function parseBlocks(text: string): Block[] {
  const lines = text.split("\n");
  const blocks: Block[] = [];
  let i = 0;

  while (i < lines.length) {
    const line = lines[i];

    // Fenced code block
    if (line.startsWith("```")) {
      const codeLines: string[] = [];
      i++;
      while (i < lines.length && !lines[i].startsWith("```")) {
        codeLines.push(lines[i]);
        i++;
      }
      if (i < lines.length) i++; // skip closing ```
      blocks.push({ type: "code", lines: codeLines });
      continue;
    }

    // Heading
    const headingMatch = line.match(/^(#{1,4}) (.+)/);
    if (headingMatch) {
      blocks.push({
        type: "heading",
        level: headingMatch[1].length,
        text: headingMatch[2],
      });
      i++;
      continue;
    }

    // Unordered list
    const ulMatch = line.match(/^[-*+] (.+)/);
    if (ulMatch) {
      const items: string[] = [ulMatch[1]];
      i++;
      while (i < lines.length) {
        const m = lines[i].match(/^[-*+] (.+)/);
        if (!m) break;
        items.push(m[1]);
        i++;
      }
      blocks.push({ type: "ul", items });
      continue;
    }

    // Ordered list
    const olMatch = line.match(/^\d+\. (.+)/);
    if (olMatch) {
      const items: string[] = [olMatch[1]];
      i++;
      while (i < lines.length) {
        const m = lines[i].match(/^\d+\. (.+)/);
        if (!m) break;
        items.push(m[1]);
        i++;
      }
      blocks.push({ type: "ol", items });
      continue;
    }

    // Empty line — skip
    if (line.trim() === "") {
      i++;
      continue;
    }

    // Plain text
    blocks.push({ type: "text", text: line });
    i++;
  }

  return blocks;
}

export function renderMarkdown(text: string): ReactNode {
  try {
    const blocks = parseBlocks(text);
    let key = 0;

    return (
      <div className="space-y-2">
        {blocks.map((block) => {
          const k = key++;
          switch (block.type) {
            case "heading": {
              const cls =
                block.level === 1
                  ? "text-lg font-bold mt-4 mb-2"
                  : block.level === 2
                    ? "text-base font-semibold mt-3 mb-1"
                    : "text-sm font-semibold mt-2 mb-1";
              const Tag =
                block.level === 1
                  ? "h2"
                  : block.level === 2
                    ? "h3"
                    : "h4";
              return (
                <Tag key={k} className={cls}>
                  {parseInline(block.text)}
                </Tag>
              );
            }
            case "code":
              return (
                <pre
                  key={k}
                  className="bg-surface-2 rounded p-3 font-mono text-xs overflow-x-auto"
                >
                  <code>{block.lines.join("\n")}</code>
                </pre>
              );
            case "ul":
              return (
                <ul key={k} className="pl-4 space-y-1">
                  {block.items.map((item, j) => (
                    <li key={j} className="flex gap-2">
                      <span className="text-text-dim select-none">•</span>
                      <span>{parseInline(item)}</span>
                    </li>
                  ))}
                </ul>
              );
            case "ol":
              return (
                <ol key={k} className="pl-4 space-y-1">
                  {block.items.map((item, j) => (
                    <li key={j} className="flex gap-2">
                      <span className="text-text-dim select-none">
                        {j + 1}.
                      </span>
                      <span>{parseInline(item)}</span>
                    </li>
                  ))}
                </ol>
              );
            case "text":
              return (
                <span key={k} className="whitespace-pre-wrap block">
                  {parseInline(block.text)}
                </span>
              );
          }
        })}
      </div>
    );
  } catch {
    return <span className="whitespace-pre-wrap">{text}</span>;
  }
}
