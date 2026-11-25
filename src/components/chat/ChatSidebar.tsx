'use client';

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { Plus, Search, Settings, Trash, Trash2, X } from 'lucide-react';
import type { Conversation } from '@/types';
import { useAppStore } from '@/lib/store';

interface ChatSidebarProps {
  isMobile: boolean;
}

function formatConversationDate(timestamp: number): string {
  const date = new Date(timestamp);
  const now = new Date();

  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  const startOfDate = new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime();
  const diffDays = Math.round((startOfToday - startOfDate) / 86_400_000);

  if (diffDays === 0) {
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  }
  if (diffDays === 1) {
    return 'Yesterday';
  }
  if (diffDays > 1 && diffDays < 7) {
    return date.toLocaleDateString([], { weekday: 'short' });
  }
  return date.toLocaleDateString([], { month: 'short', day: 'numeric' });
}

export function ChatSidebar({ isMobile }: ChatSidebarProps) {
  const conversations = useAppStore((state) => state.conversations);
  const activeConversationId = useAppStore((state) => state.activeConversationId);
  const createConversation = useAppStore((state) => state.createConversation);
  const deleteConversation = useAppStore((state) => state.deleteConversation);
  const renameConversation = useAppStore((state) => state.renameConversation);
  const setActiveConversation = useAppStore((state) => state.setActiveConversation);
  const clearHistory = useAppStore((state) => state.clearHistory);
  const sidebarOpen = useAppStore((state) => state.sidebarOpen);
  const setSidebarOpen = useAppStore((state) => state.setSidebarOpen);
  const toggleSettings = useAppStore((state) => state.toggleSettings);
  const abortController = useAppStore((state) => state.abortController);
  const reducedMotion = useAppStore((state) => state.settings.reducedMotion);

  const [searchQuery, setSearchQuery] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingTitle, setEditingTitle] = useState('');
  const editInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (editingId && editInputRef.current) {
      editInputRef.current.focus();
      editInputRef.current.select();
    }
  }, [editingId]);

  const filteredConversations = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    if (!query) return conversations;
    return conversations.filter((conv) => conv.title.toLowerCase().includes(query));
  }, [conversations, searchQuery]);

  const handleNewChat = useCallback(() => {
    if (abortController) {
      abortController.abort();
    }
    createConversation();
    if (isMobile) {
      setSidebarOpen(false);
    }
  }, [abortController, createConversation, isMobile, setSidebarOpen]);

  const handleSelectConversation = useCallback(
    (id: string) => {
      if (editingId === id) return;
      if (activeConversationId !== id && abortController) {
        abortController.abort();
      }
      setActiveConversation(id);
      if (isMobile) {
        setSidebarOpen(false);
      }
    },
    [abortController, activeConversationId, editingId, isMobile, setActiveConversation, setSidebarOpen]
  );

  const handleDeleteConversation = useCallback(
    (e: React.MouseEvent, id: string) => {
      e.stopPropagation();
      if (activeConversationId === id && abortController) {
        abortController.abort();
      }
      if (editingId === id) {
        setEditingId(null);
      }
      deleteConversation(id);
    },
    [abortController, activeConversationId, deleteConversation, editingId]
  );

  const startEditing = useCallback((conv: Conversation) => {
    setEditingId(conv.id);
    setEditingTitle(conv.title);
  }, []);

  const commitRename = useCallback(
    (conv: Conversation) => {
      const trimmed = editingTitle.trim();
      if (trimmed && trimmed !== conv.title) {
        renameConversation(conv.id, trimmed);
      }
      setEditingId(null);
      setEditingTitle('');
    },
    [editingTitle, renameConversation]
  );

  const cancelRename = useCallback(() => {
    setEditingId(null);
    setEditingTitle('');
  }, []);

  const handleOpenSettings = useCallback(() => {
    toggleSettings();
    if (isMobile) {
      setSidebarOpen(false);
    }
  }, [isMobile, setSidebarOpen, toggleSettings]);

  const handleClearHistory = useCallback(() => {
    if (abortController) {
      abortController.abort();
    }
    setEditingId(null);
    clearHistory();
    if (isMobile) {
      setSidebarOpen(false);
    }
  }, [abortController, clearHistory, isMobile, setSidebarOpen]);

  const sidebarContent = (
    <div className="flex h-full w-full flex-col bg-aegis-graphite/95 text-aegis-text backdrop-blur-md">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-aegis-cyan/10 px-4 py-4">
        <div className="flex flex-col">
          <span className="font-heading text-sm font-semibold uppercase tracking-widest text-aegis-text aegis-glow-text">
            A.E.G.I.S.
          </span>
          <span className="font-mono text-[10px] tracking-wider text-aegis-text-secondary">
            INTELLIGENCE SYSTEM
          </span>
        </div>

        {isMobile && (
          <button
            type="button"
            onClick={() => setSidebarOpen(false)}
            aria-label="Close sidebar"
            className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-aegis-text-secondary transition-colors hover:bg-aegis-titanium/60 hover:text-aegis-text"
          >
            <X className="h-4 w-4" />
          </button>
        )}
      </div>

      {/* New Chat & Search */}
      <div className="flex flex-col gap-2.5 px-3 pt-3 pb-2">
        <button
          type="button"
          onClick={handleNewChat}
          className="flex w-full items-center justify-center gap-2 rounded-lg bg-aegis-cyan/10 px-3 py-2 font-heading text-xs font-medium uppercase tracking-wider text-aegis-cyan aegis-border transition-colors hover:bg-aegis-cyan/20"
        >
          <Plus className="h-4 w-4" />
          <span>New Chat</span>
        </button>

        <div className="relative flex items-center">
          <Search className="pointer-events-none absolute left-2.5 h-3.5 w-3.5 text-aegis-text-secondary" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search conversations..."
            aria-label="Search conversations"
            className="w-full rounded-lg bg-aegis-obsidian/60 py-1.5 pl-8 pr-7 font-body text-xs text-aegis-text placeholder:text-aegis-text-secondary/60 aegis-border focus:border-aegis-cyan/40 focus:outline-none"
          />
          {searchQuery && (
            <button
              type="button"
              onClick={() => setSearchQuery('')}
              aria-label="Clear search"
              className="absolute right-2 text-aegis-text-secondary hover:text-aegis-text"
            >
              <X className="h-3 w-3" />
            </button>
          )}
        </div>
      </div>

      {/* Conversation List */}
      <div className="flex-1 overflow-y-auto px-2 py-2">
        {filteredConversations.length === 0 ? (
          <div className="px-3 py-8 text-center font-mono text-xs text-aegis-text-secondary/70">
            {conversations.length === 0 ? 'No conversations yet' : 'No matching conversations'}
          </div>
        ) : (
          <ul className="space-y-1">
            {filteredConversations.map((conv) => {
              const isActive = conv.id === activeConversationId;
              const isEditing = editingId === conv.id;

              return (
                <li key={conv.id}>
                  <div
                    role="button"
                    tabIndex={0}
                    onClick={() => handleSelectConversation(conv.id)}
                    onDoubleClick={() => startEditing(conv)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && !isEditing) {
                        handleSelectConversation(conv.id);
                      }
                    }}
                    className={`group flex cursor-pointer items-center justify-between gap-2 rounded-r-lg border-l-2 px-3 py-2.5 transition-colors duration-150 ${
                      isActive
                        ? 'border-aegis-cyan bg-aegis-titanium/60 text-aegis-text'
                        : 'border-transparent text-aegis-text-secondary hover:bg-aegis-titanium/30 hover:text-aegis-text'
                    }`}
                  >
                    <div className="min-w-0 flex-1">
                      {isEditing ? (
                        <input
                          ref={editInputRef}
                          type="text"
                          value={editingTitle}
                          onChange={(e) => setEditingTitle(e.target.value)}
                          onClick={(e) => e.stopPropagation()}
                          onDoubleClick={(e) => e.stopPropagation()}
                          onBlur={() => commitRename(conv)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') {
                              e.preventDefault();
                              commitRename(conv);
                            } else if (e.key === 'Escape') {
                              e.preventDefault();
                              cancelRename();
                            }
                          }}
                          aria-label="Edit conversation title"
                          className="w-full rounded bg-aegis-obsidian px-1.5 py-0.5 font-body text-xs text-aegis-text aegis-border focus:border-aegis-cyan focus:outline-none"
                        />
                      ) : (
                        <p className="truncate font-body text-xs font-medium leading-snug">
                          {conv.title}
                        </p>
                      )}
                      <span className="mt-0.5 block font-mono text-[10px] text-aegis-text-secondary/80">
                        {formatConversationDate(conv.updatedAt)}
                      </span>
                    </div>

                    {!isEditing && (
                      <button
                        type="button"
                        onClick={(e) => handleDeleteConversation(e, conv.id)}
                        aria-label={`Delete ${conv.title}`}
                        title="Delete conversation"
                        className="shrink-0 rounded p-1 text-aegis-text-secondary opacity-0 transition-opacity duration-150 hover:bg-aegis-obsidian/60 hover:text-aegis-amber focus-visible:opacity-100 group-hover:opacity-100"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </div>

      {/* Bottom Actions */}
      <div className="flex flex-col gap-1 border-t border-aegis-cyan/10 p-3">
        <button
          type="button"
          onClick={handleOpenSettings}
          className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2 font-body text-xs text-aegis-text-secondary transition-colors hover:bg-aegis-titanium/50 hover:text-aegis-text"
        >
          <Settings className="h-4 w-4 text-aegis-cyan/80" />
          <span>Settings</span>
        </button>

        <button
          type="button"
          onClick={handleClearHistory}
          disabled={conversations.length === 0}
          className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2 font-body text-xs text-aegis-text-secondary transition-colors hover:bg-aegis-titanium/50 hover:text-aegis-amber disabled:cursor-not-allowed disabled:opacity-40"
        >
          <Trash className="h-4 w-4" />
          <span>Clear History</span>
        </button>
      </div>
    </div>
  );

  if (isMobile) {
    return (
      <AnimatePresence>
        {sidebarOpen && (
          <>
            <motion.div
              key="sidebar-backdrop"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: reducedMotion ? 0 : 0.2 }}
              onClick={() => setSidebarOpen(false)}
              className="fixed inset-0 z-40 bg-aegis-obsidian/80 backdrop-blur-sm"
              aria-hidden="true"
            />
            <motion.aside
              key="sidebar-drawer"
              initial={{ x: '-100%' }}
              animate={{ x: 0 }}
              exit={{ x: '-100%' }}
              transition={{
                type: 'tween',
                duration: reducedMotion ? 0 : 0.25,
                ease: [0.22, 1, 0.36, 1],
              }}
              aria-label="Conversation history"
              className="fixed inset-y-0 left-0 z-50 w-72 border-r border-aegis-cyan/15 shadow-2xl"
            >
              {sidebarContent}
            </motion.aside>
          </>
        )}
      </AnimatePresence>
    );
  }

  return (
    <aside
      aria-label="Conversation history"
      className="h-full w-72 shrink-0 border-r border-aegis-cyan/10"
    >
      {sidebarContent}
    </aside>
  );
}

export default ChatSidebar;
