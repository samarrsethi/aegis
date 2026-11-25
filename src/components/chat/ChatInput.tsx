'use client';

import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Mic, Send, Square } from 'lucide-react';
import { useAppStore } from '@/lib/store';

interface ChatInputProps {
  onSend: (text: string) => void;
  onMicClick: () => void;
  disabled: boolean;
}

const MAX_TEXTAREA_HEIGHT = 200;

export function ChatInput({ onSend, onMicClick, disabled }: ChatInputProps) {
  const [value, setValue] = useState('');
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const isStreaming = useAppStore((state) => state.isStreaming);
  const abortController = useAppStore((state) => state.abortController);
  const orbState = useAppStore((state) => state.orbState);

  const hasText = value.trim().length > 0;
  const isListening = orbState === 'listening';

  const adjustHeight = useCallback(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = 'auto';
    const nextHeight = Math.min(el.scrollHeight, MAX_TEXTAREA_HEIGHT);
    el.style.height = `${nextHeight}px`;
    el.style.overflowY = el.scrollHeight > MAX_TEXTAREA_HEIGHT ? 'auto' : 'hidden';
  }, []);

  useEffect(() => {
    adjustHeight();
  }, [value, adjustHeight]);

  const handleSend = useCallback(() => {
    const trimmed = value.trim();
    if (!trimmed || disabled || isStreaming) return;
    onSend(trimmed);
    setValue('');
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.overflowY = 'hidden';
    }
  }, [value, disabled, isStreaming, onSend]);

  const handleStop = useCallback(() => {
    if (abortController) {
      abortController.abort();
    }
  }, [abortController]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
      if (e.nativeEvent.isComposing) return;

      if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        handleSend();
        return;
      }

      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        handleSend();
      }
    },
    [handleSend]
  );

  return (
    <div className="w-full">
      <div
        className={`relative flex items-end gap-2 rounded-xl bg-aegis-graphite px-3.5 py-2.5 aegis-border transition-all duration-200 ${
          disabled
            ? 'opacity-50'
            : 'focus-within:border-aegis-cyan/40 focus-within:aegis-glow'
        }`}
      >
        <textarea
          ref={textareaRef}
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={handleKeyDown}
          disabled={disabled}
          rows={1}
          placeholder="Message A.E.G.I.S..."
          aria-label="Message A.E.G.I.S."
          className="max-h-[200px] min-h-[44px] w-full flex-1 resize-none bg-transparent py-2 font-body text-sm leading-relaxed text-aegis-text placeholder:text-aegis-text-secondary/70 focus:outline-none disabled:cursor-not-allowed md:text-[15px]"
        />

        <div className="flex shrink-0 items-center gap-1.5 pb-1">
          <button
            type="button"
            onClick={onMicClick}
            disabled={disabled || isStreaming}
            aria-label={isListening ? 'Stop listening' : 'Voice input'}
            title={isListening ? 'Stop listening' : 'Voice input'}
            className={`inline-flex h-9 w-9 items-center justify-center rounded-lg transition-colors duration-150 disabled:cursor-not-allowed disabled:opacity-40 ${
              isListening
                ? 'bg-aegis-cyan/15 text-aegis-cyan ring-1 ring-aegis-cyan/40'
                : 'text-aegis-text-secondary hover:bg-aegis-titanium/70 hover:text-aegis-ice'
            }`}
          >
            <Mic className="h-4 w-4" />
          </button>

          {isStreaming ? (
            <button
              type="button"
              onClick={handleStop}
              aria-label="Stop generating"
              title="Stop generating"
              className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-aegis-amber/30 bg-aegis-titanium text-aegis-amber transition-colors duration-150 hover:bg-aegis-amber/15"
            >
              <Square className="h-3.5 w-3.5 fill-current" />
            </button>
          ) : (
            <button
              type="button"
              onClick={handleSend}
              disabled={disabled || !hasText}
              aria-label="Send message"
              title="Send message"
              className={`inline-flex h-9 w-9 items-center justify-center rounded-lg transition-all duration-150 ${
                hasText && !disabled
                  ? 'border border-aegis-cyan/30 bg-aegis-cyan/15 text-aegis-cyan hover:bg-aegis-cyan/25'
                  : 'cursor-not-allowed text-aegis-text-secondary/40'
              }`}
            >
              <Send className="h-4 w-4" />
            </button>
          )}
        </div>
      </div>

      <div className="mt-1.5 flex items-center justify-between px-1 font-mono text-[10px] text-aegis-text-secondary/60">
        <span>Enter to send · Shift+Enter for new line</span>
        <span>Cmd/Ctrl+Enter</span>
      </div>
    </div>
  );
}

export default ChatInput;
