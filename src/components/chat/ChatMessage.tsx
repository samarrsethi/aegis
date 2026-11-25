'use client';

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { motion } from 'framer-motion';
import { AlertCircle, Check, Copy } from 'lucide-react';
import type { Message } from '@/types';
import { useAppStore } from '@/lib/store';
import { MessageRenderer } from './MessageRenderer';

interface ChatMessageProps {
  message: Message;
  isLatest: boolean;
}

function formatTimestamp(timestamp: number): string {
  try {
    return new Date(timestamp).toLocaleTimeString([], {
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return '';
  }
}

export function ChatMessage({ message, isLatest }: ChatMessageProps) {
  const reducedMotion = useAppStore((state) => state.settings.reducedMotion);
  const [copied, setCopied] = useState(false);
  const copyTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const isUser = message.role === 'user';
  const isError = Boolean(message.error);
  const isStreaming = Boolean(message.isStreaming);

  const formattedTime = useMemo(
    () => formatTimestamp(message.timestamp),
    [message.timestamp]
  );

  useEffect(() => {
    return () => {
      if (copyTimeoutRef.current) {
        clearTimeout(copyTimeoutRef.current);
      }
    };
  }, []);

  const handleCopy = useCallback(async () => {
    if (!message.content) return;
    try {
      await navigator.clipboard.writeText(message.content);
      setCopied(true);
      if (copyTimeoutRef.current) {
        clearTimeout(copyTimeoutRef.current);
      }
      copyTimeoutRef.current = setTimeout(() => {
        setCopied(false);
      }, 2000);
    } catch {
      // Clipboard API unavailable
    }
  }, [message.content]);

  if (isUser) {
    return (
      <motion.div
        data-latest={isLatest}
        initial={reducedMotion ? false : { opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{
          duration: reducedMotion ? 0 : 0.22,
          ease: [0.22, 1, 0.36, 1],
        }}
        className="group flex w-full justify-end"
      >
        <div className="flex max-w-[85%] flex-col items-end gap-1.5 md:max-w-[75%]">
          <div className="flex items-center gap-2 px-1">
            <button
              type="button"
              onClick={handleCopy}
              aria-label={copied ? 'Message copied' : 'Copy message'}
              className="inline-flex items-center gap-1 rounded px-1.5 py-0.5 font-mono text-[11px] text-aegis-text-secondary opacity-0 transition-opacity duration-150 hover:bg-aegis-titanium/60 hover:text-aegis-cyan focus-visible:opacity-100 group-hover:opacity-100"
            >
              {copied ? (
                <Check className="h-3 w-3 text-aegis-cyan" />
              ) : (
                <Copy className="h-3 w-3" />
              )}
            </button>
            <span className="font-mono text-xs text-aegis-text-secondary">
              {formattedTime}
            </span>
            <span
              className="h-2 w-2 rounded-full bg-aegis-graphite ring-1 ring-aegis-text-secondary/60"
              aria-hidden="true"
            />
          </div>

          <div className="rounded-2xl rounded-tr-sm bg-aegis-titanium/80 px-4 py-3 aegis-border">
            <p className="whitespace-pre-wrap break-words font-body text-sm leading-relaxed text-aegis-text md:text-[15px]">
              {message.content}
            </p>
          </div>
        </div>
      </motion.div>
    );
  }

  return (
    <motion.div
      data-latest={isLatest}
      initial={reducedMotion ? false : { opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{
        duration: reducedMotion ? 0 : 0.25,
        ease: [0.22, 1, 0.36, 1],
      }}
      className="group flex w-full justify-start"
    >
      <div className="flex w-full flex-col gap-2 bg-transparent">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <span
              className={`h-2 w-2 rounded-full ${
                isError
                  ? 'bg-aegis-amber'
                  : isStreaming && isLatest
                  ? 'animate-pulse bg-aegis-cyan shadow-[0_0_8px_rgba(83,217,232,0.15)]'
                  : 'bg-aegis-cyan shadow-[0_0_8px_rgba(83,217,232,0.15)]'
              }`}
              aria-hidden="true"
            />
            <span className="font-heading text-xs font-medium uppercase tracking-[0.16em] text-aegis-ice/90">
              A.E.G.I.S.
            </span>
            <span className="font-mono text-xs text-aegis-text-secondary">
              {formattedTime}
            </span>
          </div>

          {!isStreaming && message.content && (
            <button
              type="button"
              onClick={handleCopy}
              aria-label={copied ? 'Message copied' : 'Copy message'}
              className="inline-flex items-center gap-1 rounded px-2 py-1 font-mono text-[11px] text-aegis-text-secondary opacity-0 transition-opacity duration-150 hover:bg-aegis-titanium/60 hover:text-aegis-cyan focus-visible:opacity-100 group-hover:opacity-100"
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
          )}
        </div>

        <div
          className={
            isError
              ? 'flex items-start gap-2.5 rounded-xl border border-aegis-amber/25 bg-aegis-amber/[0.06] px-4 py-3 text-aegis-amber'
              : 'w-full pl-4'
          }
        >
          {isError ? (
            <>
              <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-aegis-amber" />
              <div className="min-w-0 flex-1 font-body text-sm leading-relaxed text-aegis-text">
                {message.content}
              </div>
            </>
          ) : (
            <div className="w-full">
              {message.content ? <MessageRenderer content={message.content} /> : null}
              {isStreaming && (
                <span
                  aria-label="Streaming response"
                  className="mt-1 inline-block h-4 w-1.5 animate-pulse rounded-[1px] bg-aegis-cyan align-middle shadow-[0_0_6px_rgba(83,217,232,0.15)]"
                />
              )}
            </div>
          )}
        </div>
      </div>
    </motion.div>
  );
}

export default ChatMessage;
