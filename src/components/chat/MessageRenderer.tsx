'use client';

import React, { memo, useCallback, useEffect, useRef, useState } from 'react';
import ReactMarkdown, { type Components } from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { oneDark } from 'react-syntax-highlighter/dist/esm/styles/prism';
import { Check, Copy } from 'lucide-react';

interface MessageRendererProps {
  content: string;
}

interface CodeBlockProps {
  language: string;
  code: string;
}

function extractTextContent(node: React.ReactNode): string {
  if (typeof node === 'string' || typeof node === 'number') {
    return String(node);
  }
  if (Array.isArray(node)) {
    return node.map(extractTextContent).join('');
  }
  if (React.isValidElement<{ children?: React.ReactNode }>(node)) {
    return extractTextContent(node.props.children);
  }
  return '';
}

function CodeBlock({ language, code }: CodeBlockProps) {
  const [copied, setCopied] = useState(false);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, []);

  const handleCopy = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
      timeoutRef.current = setTimeout(() => {
        setCopied(false);
      }, 2000);
    } catch {
      // Clipboard API unavailable
    }
  }, [code]);

  return (
    <div className="my-3 overflow-hidden rounded-lg bg-aegis-graphite aegis-border">
      <div className="flex items-center justify-between border-b border-aegis-cyan/10 bg-aegis-obsidian/40 px-3.5 py-2">
        <span className="font-mono text-[11px] uppercase tracking-wider text-aegis-text-secondary">
          {language || 'text'}
        </span>
        <button
          type="button"
          onClick={handleCopy}
          aria-label={copied ? 'Code copied' : 'Copy code'}
          className="inline-flex items-center gap-1.5 rounded px-2 py-1 font-mono text-[11px] text-aegis-text-secondary transition-colors hover:bg-aegis-titanium/60 hover:text-aegis-cyan"
        >
          {copied ? (
            <>
              <Check className="h-3.5 w-3.5 text-aegis-cyan" />
              <span className="text-aegis-cyan">Copied</span>
            </>
          ) : (
            <>
              <Copy className="h-3.5 w-3.5" />
              <span>Copy</span>
            </>
          )}
        </button>
      </div>
      <div className="overflow-x-auto [&_pre]:!m-0 [&_pre]:!rounded-none [&_pre]:!border-0 [&_pre]:!bg-transparent">
        <SyntaxHighlighter
          language={language || 'text'}
          style={oneDark}
          PreTag="pre"
          customStyle={{
            margin: 0,
            padding: '0.875rem 1rem',
            background: 'transparent',
            border: 'none',
            borderRadius: 0,
            fontSize: '0.85rem',
            lineHeight: '1.6',
            fontFamily: "'JetBrains Mono', monospace",
          }}
          codeTagProps={{
            style: {
              background: 'transparent',
              fontFamily: "'JetBrains Mono', monospace",
              textShadow: 'none',
            },
          }}
        >
          {code}
        </SyntaxHighlighter>
      </div>
    </div>
  );
}

const markdownComponents: Components = {
  pre({ children }) {
    const childArray = React.Children.toArray(children);
    const firstChild = childArray[0];

    if (React.isValidElement<{ className?: string; children?: React.ReactNode }>(firstChild)) {
      const className = firstChild.props.className ?? '';
      const match = /language-([^\s]+)/.exec(className);
      const rawCode = extractTextContent(firstChild.props.children);
      const codeString = rawCode.replace(/\n$/, '');
      const language = match ? match[1] : 'text';

      return <CodeBlock language={language} code={codeString} />;
    }

    return <pre>{children}</pre>;
  },

  code({ className, children, ...props }) {
    return (
      <code className={className} {...props}>
        {children}
      </code>
    );
  },

  a({ href, children, ...props }) {
    return (
      <a
        href={href}
        target="_blank"
        rel="noopener noreferrer"
        className="text-aegis-cyan transition-colors hover:text-aegis-ice hover:underline"
        {...props}
      >
        {children}
      </a>
    );
  },

  blockquote({ children, ...props }) {
    return (
      <blockquote
        className="my-3 rounded-r-md border-l-2 border-aegis-cyan bg-aegis-cyan/[0.03] py-1.5 pl-4 pr-3 text-aegis-text-secondary"
        {...props}
      >
        {children}
      </blockquote>
    );
  },

  table({ children, ...props }) {
    return (
      <div className="my-3 w-full overflow-x-auto rounded-lg aegis-border">
        <table className="w-full border-collapse text-left text-sm" {...props}>
          {children}
        </table>
      </div>
    );
  },

  th({ children, ...props }) {
    return (
      <th
        className="border border-aegis-cyan/10 bg-aegis-cyan/[0.06] px-3 py-2 font-heading text-xs font-medium uppercase tracking-wider text-aegis-ice"
        {...props}
      >
        {children}
      </th>
    );
  },

  td({ children, ...props }) {
    return (
      <td className="border border-aegis-cyan/10 px-3 py-2 text-aegis-text" {...props}>
        {children}
      </td>
    );
  },
};

function MessageRendererComponent({ content }: MessageRendererProps) {
  return (
    <div className="aegis-markdown break-words font-body text-sm leading-relaxed text-aegis-text md:text-[15px]">
      <ReactMarkdown remarkPlugins={[remarkGfm]} components={markdownComponents}>
        {content}
      </ReactMarkdown>
    </div>
  );
}

export const MessageRenderer = memo(MessageRendererComponent);
export default MessageRenderer;
