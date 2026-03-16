"use client";

import { type ReactNode } from "react";
import ReactMarkdown, { type Components } from "react-markdown";
import remarkGfm from "remark-gfm";

const magiComponents: Components = {
  h1: ({ children }) => (
    <h2 className="text-lg font-bold mt-4 mb-2 text-accent magi-glow">
      {children}
    </h2>
  ),
  h2: ({ children }) => (
    <h3 className="text-base font-semibold mt-3 mb-1 text-accent">
      {children}
    </h3>
  ),
  h3: ({ children }) => (
    <h4 className="text-sm font-semibold mt-2 mb-1 text-accent">{children}</h4>
  ),
  h4: ({ children }) => (
    <h5 className="text-sm font-semibold mt-2 mb-1 text-accent">{children}</h5>
  ),
  code: ({ children, className }) => {
    const isBlock = className?.startsWith("language-");
    if (isBlock) {
      return <code className={className}>{children}</code>;
    }
    return (
      <code className="bg-surface-2 px-1.5 py-0.5 font-mono text-xs text-accent">
        {children}
      </code>
    );
  },
  pre: ({ children }) => (
    <pre className="bg-surface-2 border border-accent/20 p-3 font-mono text-xs text-accent overflow-x-auto">
      {children}
    </pre>
  ),
  ul: ({ children }) => <ul className="pl-4 space-y-1">{children}</ul>,
  li: ({ children }) => <li className="flex gap-2">{children}</li>,
  ol: ({ children }) => <ol className="pl-4 space-y-1">{children}</ol>,
  table: ({ children }) => (
    <div className="overflow-x-auto my-2">
      <table className="border-collapse border border-accent/20 text-xs w-full">
        {children}
      </table>
    </div>
  ),
  thead: ({ children }) => (
    <thead className="bg-surface-2 text-accent uppercase text-[10px] tracking-wider">
      {children}
    </thead>
  ),
  th: ({ children }) => (
    <th className="border border-accent/20 px-3 py-1.5 text-left">
      {children}
    </th>
  ),
  td: ({ children }) => (
    <td className="border border-accent/20 px-3 py-1.5">{children}</td>
  ),
  blockquote: ({ children }) => (
    <blockquote className="border-l-2 border-accent/40 pl-3 text-text-dim italic my-2">
      {children}
    </blockquote>
  ),
  a: ({ href, children }) => (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className="text-accent underline"
    >
      {children}
    </a>
  ),
  del: ({ children }) => (
    <del className="line-through text-text-dim">{children}</del>
  ),
  hr: () => <hr className="border-accent/20 my-3" />,
  input: ({ checked }) => (
    <span className="text-accent mr-1 select-none">
      {checked ? "[x]" : "[ ]"}
    </span>
  ),
  p: ({ children }) => (
    <span className="whitespace-pre-wrap block">{children}</span>
  ),
};

export function renderMarkdown(text: string): ReactNode {
  try {
    return (
      <div className="magi-markdown space-y-2">
        <ReactMarkdown remarkPlugins={[remarkGfm]} components={magiComponents}>
          {text}
        </ReactMarkdown>
      </div>
    );
  } catch {
    return <span className="whitespace-pre-wrap">{text}</span>;
  }
}
