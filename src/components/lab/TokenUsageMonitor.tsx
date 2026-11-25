'use client';

import React from 'react';
import { Gauge } from 'lucide-react';
import { useAppStore } from '@/lib/store';

export function TokenUsageMonitor() {
  const lastTokenUsage = useAppStore((s) => s.lastTokenUsage);
  const llmConfig = useAppStore((s) => s.llmConfig);
  const availableModels = useAppStore((s) => s.availableModels);
  const settings = useAppStore((s) => s.settings);

  const activeCap = availableModels.find((m) => m.id === settings.model);
  const contextWindow =
    lastTokenUsage?.contextWindow ?? activeCap?.inputTokenLimit ?? null;
  const maxConfigured =
    lastTokenUsage?.maxConfiguredOutputTokens ?? llmConfig.maxOutputTokens;

  return (
    <div className="mb-2 flex flex-wrap items-center justify-between gap-x-4 gap-y-1.5 rounded-lg bg-aegis-graphite/75 px-3 py-2 font-mono text-[10px] text-aegis-text-secondary aegis-border">
      <div className="flex items-center gap-1.5 text-aegis-cyan">
        <Gauge className="h-3.5 w-3.5" />
        <span className="uppercase tracking-wider">Token Monitor</span>
      </div>

      <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
        {lastTokenUsage?.modelUsed && (
          <span>
            Model:{' '}
            <span className="text-aegis-cyan">{lastTokenUsage.modelUsed}</span>
          </span>
        )}
        {lastTokenUsage?.estimatedPromptTokens !== undefined &&
          lastTokenUsage?.estimatedPromptTokens !== null &&
          lastTokenUsage?.inputTokens === null && (
            <span>
              Prompt Est:{' '}
              <span className="text-aegis-ice">
                ~{lastTokenUsage.estimatedPromptTokens.toLocaleString()}
              </span>
            </span>
          )}

        <span>
          In:{' '}
          <span className="text-aegis-text">
            {lastTokenUsage?.inputTokens !== null &&
            lastTokenUsage?.inputTokens !== undefined
              ? lastTokenUsage.inputTokens.toLocaleString()
              : '—'}
          </span>
        </span>

        <span>
          Out:{' '}
          <span className="text-aegis-text">
            {lastTokenUsage?.outputTokens !== null &&
            lastTokenUsage?.outputTokens !== undefined
              ? lastTokenUsage.outputTokens.toLocaleString()
              : '—'}
          </span>
        </span>

        <span>
          Total:{' '}
          <span className="text-aegis-cyan">
            {lastTokenUsage?.totalTokens !== null &&
            lastTokenUsage?.totalTokens !== undefined
              ? lastTokenUsage.totalTokens.toLocaleString()
              : '—'}
          </span>
        </span>

        <span>
          Max Out:{' '}
          <span className="text-aegis-text">
            {maxConfigured.toLocaleString()}
          </span>
        </span>

        <span>
          Context:{' '}
          <span className="text-aegis-text">
            {contextWindow ? contextWindow.toLocaleString() : '—'}
          </span>
        </span>

        <span>
          Finish:{' '}
          <span
            className={
              lastTokenUsage?.finishReason === 'MAX_TOKENS'
                ? 'text-aegis-amber'
                : 'text-aegis-ice'
            }
          >
            {lastTokenUsage?.finishReason ?? '—'}
          </span>
        </span>
      </div>
    </div>
  );
}

export default TokenUsageMonitor;
