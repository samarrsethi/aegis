'use client';

import { useState, useCallback, useRef, useEffect } from 'react';
import { v4 as uuidv4 } from 'uuid';
import { useAppStore } from '@/lib/store';
import { sendChatMessage } from '@/lib/chat';
import type { Message } from '@/types';

const CONVERSATIONS_STORAGE_KEY = 'aegis-conversations';

function isAbortError(err: unknown, signal: AbortSignal): boolean {
  if (signal.aborted) return true;
  if (err instanceof DOMException && err.name === 'AbortError') return true;
  if (err instanceof Error && err.name === 'AbortError') return true;
  return false;
}

function removeMessageFromConversation(conversationId: string, messageId: string) {
  useAppStore.setState((state) => {
    const conversations = state.conversations.map((c) => {
      if (c.id !== conversationId) return c;
      return {
        ...c,
        messages: c.messages.filter((m) => m.id !== messageId),
        updatedAt: Date.now(),
      };
    });
    if (typeof window !== 'undefined') {
      try {
        localStorage.setItem(CONVERSATIONS_STORAGE_KEY, JSON.stringify(conversations));
      } catch {
        // Storage full or unavailable
      }
    }
    return { conversations };
  });
}

export interface UseChatReturn {
  sendMessage: (content: string) => Promise<void>;
  isStreaming: boolean;
  error: string | null;
  retryLastMessage: () => Promise<void>;
}

export function useChat(): UseChatReturn {
  const isStreaming = useAppStore((s) => s.isStreaming);
  const [error, setError] = useState<string | null>(null);
  const errorResetTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const clearErrorTimeout = useCallback(() => {
    if (errorResetTimeoutRef.current) {
      clearTimeout(errorResetTimeoutRef.current);
      errorResetTimeoutRef.current = null;
    }
  }, []);

  useEffect(() => {
    return () => {
      clearErrorTimeout();
    };
  }, [clearErrorTimeout]);

  const streamAssistantResponse = useCallback(
    async (conversationId: string) => {
      clearErrorTimeout();
      setError(null);

      const store = useAppStore.getState();
      store.setOrbState('thinking');
      store.setIsStreaming(true);

      const controller = new AbortController();
      store.setAbortController(controller);

      let assistantMessageId: string | null = null;
      let accumulatedContent = '';
      let reader: ReadableStreamDefaultReader<string> | null = null;

      try {
        const latestState = useAppStore.getState();
        const conversation = latestState.conversations.find(
          (c) => c.id === conversationId
        );
        const contextMessages = (conversation?.messages ?? []).filter(
          (m) => !m.error && m.content.trim().length > 0
        );

        const stream = await sendChatMessage(
          contextMessages,
          latestState.settings.model,
          controller.signal
        );

        if (controller.signal.aborted) {
          stream.cancel().catch(() => {});
          throw new DOMException('Aborted', 'AbortError');
        }

        // Create assistant placeholder message with isStreaming: true
        assistantMessageId = uuidv4();
        const assistantMessage: Message = {
          id: assistantMessageId,
          role: 'assistant',
          content: '',
          timestamp: Date.now(),
          isStreaming: true,
        };
        useAppStore.getState().addMessage(conversationId, assistantMessage);

        reader = stream.getReader();

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          if (controller.signal.aborted) {
            throw new DOMException('Aborted', 'AbortError');
          }

          if (value) {
            accumulatedContent += value;
            useAppStore
              .getState()
              .updateMessage(conversationId, assistantMessageId, accumulatedContent);
          }
        }

        // Ensure final message state is synced when stream ends
        useAppStore
          .getState()
          .updateMessage(conversationId, assistantMessageId, accumulatedContent);

        const finishStore = useAppStore.getState();
        finishStore.setIsStreaming(false);
        if (finishStore.abortController === controller) {
          finishStore.setAbortController(null);
        }
        finishStore.setOrbState('idle');
      } catch (err) {
        if (reader) {
          reader.cancel().catch(() => {});
        }

        const currentStore = useAppStore.getState();
        currentStore.setIsStreaming(false);
        if (currentStore.abortController === controller) {
          currentStore.setAbortController(null);
        }

        // Handle user-initiated abort gracefully without error state
        if (isAbortError(err, controller.signal)) {
          if (assistantMessageId && accumulatedContent.length === 0) {
            removeMessageFromConversation(conversationId, assistantMessageId);
          } else if (assistantMessageId) {
            currentStore.updateMessage(
              conversationId,
              assistantMessageId,
              accumulatedContent
            );
          }
          if (useAppStore.getState().orbState !== 'idle') {
            currentStore.setOrbState('idle');
          }
          return;
        }

        const errorMessage =
          err instanceof Error
            ? err.message
            : 'An unexpected error occurred while generating a response.';

        setError(errorMessage);
        currentStore.setOrbState('error');

        if (assistantMessageId && accumulatedContent.length === 0) {
          removeMessageFromConversation(conversationId, assistantMessageId);
        }

        const errorMsg: Message = {
          id: uuidv4(),
          role: 'assistant',
          content: errorMessage,
          timestamp: Date.now(),
          error: true,
        };
        useAppStore.getState().addMessage(conversationId, errorMsg);

        errorResetTimeoutRef.current = setTimeout(() => {
          if (useAppStore.getState().orbState === 'error') {
            useAppStore.getState().setOrbState('idle');
          }
          errorResetTimeoutRef.current = null;
        }, 3000);
      } finally {
        if (reader) {
          try {
            reader.releaseLock();
          } catch {
            // Reader may already be released or closed
          }
        }
      }
    },
    [clearErrorTimeout]
  );

  const sendMessage = useCallback(
    async (content: string) => {
      const trimmed = content.trim();
      if (!trimmed) return;

      const store = useAppStore.getState();
      if (store.isStreaming) return;

      let conversationId = store.activeConversationId;
      const existingConversation = conversationId
        ? store.conversations.find((c) => c.id === conversationId)
        : null;

      if (!conversationId || !existingConversation) {
        conversationId = store.createConversation();
      }

      const userMessage: Message = {
        id: uuidv4(),
        role: 'user',
        content: trimmed,
        timestamp: Date.now(),
      };
      useAppStore.getState().addMessage(conversationId, userMessage);

      await streamAssistantResponse(conversationId);
    },
    [streamAssistantResponse]
  );

  const retryLastMessage = useCallback(async () => {
    const store = useAppStore.getState();
    if (store.isStreaming) return;

    const activeConversation = store.getActiveConversation();
    if (!activeConversation || activeConversation.messages.length === 0) {
      return;
    }

    const hasUserMessage = activeConversation.messages.some(
      (m) => m.role === 'user'
    );
    if (!hasUserMessage) return;

    const lastMessage =
      activeConversation.messages[activeConversation.messages.length - 1];

    if (lastMessage && lastMessage.role === 'assistant' && lastMessage.error) {
      removeMessageFromConversation(activeConversation.id, lastMessage.id);
    }

    await streamAssistantResponse(activeConversation.id);
  }, [streamAssistantResponse]);

  return {
    sendMessage,
    isStreaming,
    error,
    retryLastMessage,
  };
}

export default useChat;
