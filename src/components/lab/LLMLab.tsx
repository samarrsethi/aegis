'use client';

import React, { useMemo, useRef, useState } from 'react';
import {
  AlertCircle,
  Check,
  Copy,
  Download,
  FlaskConical,
  Play,
  Square,
} from 'lucide-react';
import { useAppStore } from '@/lib/store';
import { sendChatMessage } from '@/lib/chat';
import type { GenerationConfig, ModelCapability, TokenUsage } from '@/types';
import { MessageRenderer } from '@/components/chat/MessageRenderer';
import { SamplingVisualizer } from './SamplingVisualizer';

interface ExperimentConfig extends GenerationConfig {
  model: string;
}

interface ExperimentResult {
  status: 'idle' | 'running' | 'done' | 'error';
  content: string;
  durationMs: number | null;
  usage: TokenUsage | null;
  actualModel: string | null;
  error: string | null;
  configSnapshot: ExperimentConfig;
}

const INITIAL_RESULT = (config: ExperimentConfig): ExperimentResult => ({
  status: 'idle',
  content: '',
  durationMs: null,
  usage: null,
  actualModel: null,
  error: null,
  configSnapshot: config,
});

export function LLMLab() {
  const availableModels = useAppStore((s) => s.availableModels);
  const settings = useAppStore((s) => s.settings);

  const models: ModelCapability[] = useMemo(
    () =>
      availableModels.length > 0
        ? availableModels
        : [
            {
              id: settings.model || 'gemini-3.5-flash-lite',
              displayName: settings.model || 'Gemini 3.5 Flash Lite',
              inputTokenLimit: 1048576,
              outputTokenLimit: 65536,
              defaultTemperature: 1,
              maxTemperature: 2,
              defaultTopP: 0.95,
              supportsTopK: true,
              defaultTopK: 64,
              maxTopK: 64,
              supportsCountTokens: true,
              supportedActions: ['generateContent', 'countTokens'],
            },
          ],
    [availableModels, settings.model]
  );

  const defaultModelId = models[0].id;

  const [prompt, setPrompt] = useState('Write a short story about a robot.');
  const [configA, setConfigA] = useState<ExperimentConfig>({
    model: defaultModelId,
    temperature: 0.1,
    maxOutputTokens: 300,
    topP: 0.95,
    topK: 40,
  });
  const [configB, setConfigB] = useState<ExperimentConfig>({
    model: defaultModelId,
    temperature: 1.5,
    maxOutputTokens: 300,
    topP: 0.95,
    topK: 40,
  });

  const [resultA, setResultA] = useState<ExperimentResult>(() =>
    INITIAL_RESULT(configA)
  );
  const [resultB, setResultB] = useState<ExperimentResult>(() =>
    INITIAL_RESULT(configB)
  );
  const [copied, setCopied] = useState(false);

  const abortARef = useRef<AbortController | null>(null);
  const abortBRef = useRef<AbortController | null>(null);

  const isRunning = resultA.status === 'running' || resultB.status === 'running';

  const runSingle = async (
    cfg: ExperimentConfig,
    setResult: React.Dispatch<React.SetStateAction<ExperimentResult>>,
    abortRef: React.MutableRefObject<AbortController | null>
  ) => {
    const controller = new AbortController();
    abortRef.current = controller;
    const cap = models.find((m) => m.id === cfg.model) || models[0];
    const startTime = performance.now();

    setResult({
      status: 'running',
      content: '',
      durationMs: null,
      usage: null,
      actualModel: cfg.model,
      error: null,
      configSnapshot: { ...cfg },
    });

    let accumulated = '';

    try {
      const stream = await sendChatMessage(
        [{ id: 'lab-prompt', role: 'user', content: prompt.trim(), timestamp: Date.now() }],
        cfg.model,
        {
          signal: controller.signal,
          allowFallback: false, // Controlled experiment: never silently switch models
          config: {
            temperature: cfg.temperature,
            topP: cfg.topP,
            maxOutputTokens: cfg.maxOutputTokens,
            ...(cap.supportsTopK && cfg.topK !== undefined ? { topK: cfg.topK } : {}),
          },
          onModelUsed: (actualModel) => {
            setResult((prev) => ({ ...prev, actualModel }));
          },
          onUsage: (usage) => {
            setResult((prev) => ({ ...prev, usage }));
          },
        }
      );

      const reader = stream.getReader();
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        if (value) {
          accumulated += value;
          setResult((prev) => ({ ...prev, content: accumulated }));
        }
      }

      const elapsed = Math.round(performance.now() - startTime);
      setResult((prev) => ({
        ...prev,
        status: 'done',
        durationMs: elapsed,
      }));
    } catch (err) {
      const elapsed = Math.round(performance.now() - startTime);
      const isAbort =
        controller.signal.aborted ||
        (err instanceof Error && err.name === 'AbortError');
      setResult((prev) => ({
        ...prev,
        status: 'error',
        durationMs: elapsed,
        error: isAbort
          ? 'Experiment cancelled.'
          : err instanceof Error
            ? err.message
            : 'Request failed.',
      }));
    } finally {
      abortRef.current = null;
    }
  };

  const handleRunComparison = async () => {
    if (!prompt.trim() || isRunning) return;
    await Promise.all([
      runSingle(configA, setResultA, abortARef),
      runSingle(configB, setResultB, abortBRef),
    ]);
  };

  const handleStop = () => {
    abortARef.current?.abort();
    abortBRef.current?.abort();
  };

  const buildExportPayload = () => ({
    exportedAt: new Date().toISOString(),
    prompt,
    caveat:
      'Single generation per configuration; not sufficient to establish a statistical pattern.',
    configurationA: {
      parameters: resultA.configSnapshot,
      actualModel: resultA.actualModel,
      durationMs: resultA.durationMs,
      usage: resultA.usage,
      response: resultA.content,
      error: resultA.error,
    },
    configurationB: {
      parameters: resultB.configSnapshot,
      actualModel: resultB.actualModel,
      durationMs: resultB.durationMs,
      usage: resultB.usage,
      response: resultB.content,
      error: resultB.error,
    },
  });

  const handleCopy = async () => {
    await navigator.clipboard.writeText(
      JSON.stringify(buildExportPayload(), null, 2)
    );
    setCopied(true);
    setTimeout(() => setCopied(false), 1800);
  };

  const handleExport = () => {
    const blob = new Blob([JSON.stringify(buildExportPayload(), null, 2)], {
      type: 'application/json',
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `aegis-llm-lab-${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const renderConfigCard = (
    label: string,
    cfg: ExperimentConfig,
    setCfg: React.Dispatch<React.SetStateAction<ExperimentConfig>>
  ) => {
    const cap = models.find((m) => m.id === cfg.model) || models[0];
    return (
      <div className="space-y-3 rounded-xl bg-aegis-graphite/75 p-4 aegis-border">
        <div className="flex items-center justify-between border-b border-aegis-cyan/10 pb-2">
          <span className="font-heading text-xs font-semibold uppercase tracking-[0.18em] text-aegis-cyan">
            {label}
          </span>
          <span className="font-mono text-[10px] text-aegis-text-secondary">
            {cfg.model}
          </span>
        </div>

        <div className="space-y-1">
          <label className="font-mono text-[10px] uppercase text-aegis-text-secondary">
            Model
          </label>
          <select
            value={cfg.model}
            onChange={(e) => setCfg({ ...cfg, model: e.target.value })}
            className="w-full rounded-lg bg-aegis-obsidian px-2.5 py-1.5 font-mono text-xs text-aegis-text aegis-border focus:border-aegis-cyan focus:outline-none"
          >
            {models.map((m) => (
              <option key={m.id} value={m.id}>
                {m.displayName} ({m.id})
              </option>
            ))}
          </select>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <div className="flex justify-between font-mono text-[10px] text-aegis-text-secondary">
              <span>Temp</span>
              <span className="text-aegis-cyan">{cfg.temperature.toFixed(2)}</span>
            </div>
            <input
              type="range"
              min={0}
              max={cap.maxTemperature}
              step={0.05}
              value={Math.min(cfg.temperature, cap.maxTemperature)}
              onChange={(e) =>
                setCfg({ ...cfg, temperature: parseFloat(e.target.value) })
              }
              className="mt-1 w-full accent-[#53D9E8]"
            />
          </div>

          <div>
            <div className="flex justify-between font-mono text-[10px] text-aegis-text-secondary">
              <span>Top-P</span>
              <span className="text-aegis-cyan">{cfg.topP.toFixed(2)}</span>
            </div>
            <input
              type="range"
              min={0.05}
              max={1}
              step={0.05}
              value={cfg.topP}
              onChange={(e) => setCfg({ ...cfg, topP: parseFloat(e.target.value) })}
              className="mt-1 w-full accent-[#53D9E8]"
            />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="font-mono text-[10px] text-aegis-text-secondary">
              Max Output Tokens
            </label>
            <input
              type="number"
              min={1}
              max={cap.outputTokenLimit}
              value={cfg.maxOutputTokens}
              onChange={(e) => {
                const v = parseInt(e.target.value, 10);
                if (!Number.isNaN(v)) {
                  setCfg({
                    ...cfg,
                    maxOutputTokens: Math.min(Math.max(v, 1), cap.outputTokenLimit),
                  });
                }
              }}
              className="mt-1 w-full rounded bg-aegis-obsidian px-2 py-1 font-mono text-xs text-aegis-text aegis-border focus:border-aegis-cyan focus:outline-none"
            />
          </div>

          {cap.supportsTopK && (
            <div>
              <label className="font-mono text-[10px] text-aegis-text-secondary">
                Top-K (1–{cap.maxTopK ?? 64})
              </label>
              <input
                type="number"
                min={1}
                max={cap.maxTopK ?? 64}
                value={cfg.topK ?? 40}
                onChange={(e) => {
                  const v = parseInt(e.target.value, 10);
                  if (!Number.isNaN(v)) {
                    setCfg({
                      ...cfg,
                      topK: Math.min(Math.max(v, 1), cap.maxTopK ?? 64),
                    });
                  }
                }}
                className="mt-1 w-full rounded bg-aegis-obsidian px-2 py-1 font-mono text-xs text-aegis-text aegis-border focus:border-aegis-cyan focus:outline-none"
              />
            </div>
          )}
        </div>
      </div>
    );
  };

  const renderResultCard = (label: string, res: ExperimentResult) => (
    <div className="flex flex-col rounded-xl bg-aegis-graphite/75 p-4 aegis-border">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2 border-b border-aegis-cyan/10 pb-2">
        <span className="font-heading text-xs font-semibold uppercase tracking-[0.18em] text-aegis-text">
          {label}
        </span>
        <span className="font-mono text-[10px] text-aegis-cyan">
          {res.actualModel || res.configSnapshot.model}
        </span>
      </div>

      {/* Metrics Row */}
      <div className="mb-3 grid grid-cols-2 gap-2 font-mono text-[10px] text-aegis-text-secondary sm:grid-cols-4">
        <div className="rounded bg-aegis-obsidian/70 px-2 py-1.5">
          <div className="text-[9px] uppercase">Duration</div>
          <div className="text-aegis-ice">
            {res.durationMs !== null ? `${res.durationMs} ms` : '—'}
          </div>
        </div>
        <div className="rounded bg-aegis-obsidian/70 px-2 py-1.5">
          <div className="text-[9px] uppercase">Output Tok</div>
          <div className="text-aegis-text">
            {res.usage?.outputTokens !== null && res.usage?.outputTokens !== undefined
              ? res.usage.outputTokens
              : '—'}
          </div>
        </div>
        <div className="rounded bg-aegis-obsidian/70 px-2 py-1.5">
          <div className="text-[9px] uppercase">Total Tok</div>
          <div className="text-aegis-text">
            {res.usage?.totalTokens !== null && res.usage?.totalTokens !== undefined
              ? res.usage.totalTokens
              : '—'}
          </div>
        </div>
        <div className="rounded bg-aegis-obsidian/70 px-2 py-1.5">
          <div className="text-[9px] uppercase">Finish</div>
          <div className="text-aegis-ice">{res.usage?.finishReason ?? '—'}</div>
        </div>
      </div>

      {/* Parameters Snapshot */}
      <div className="mb-3 flex flex-wrap gap-2 font-mono text-[10px] text-aegis-text-secondary">
        <span>T: {res.configSnapshot.temperature.toFixed(2)}</span>
        <span>Top-P: {res.configSnapshot.topP.toFixed(2)}</span>
        <span>MaxOut: {res.configSnapshot.maxOutputTokens}</span>
        {res.configSnapshot.topK !== undefined && (
          <span>Top-K: {res.configSnapshot.topK}</span>
        )}
      </div>

      {/* Response Body */}
      <div className="min-h-[160px] flex-1 rounded-lg bg-aegis-obsidian/70 p-3 aegis-border">
        {res.error ? (
          <div className="flex items-start gap-2 font-mono text-xs text-aegis-amber">
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
            <span>{res.error}</span>
          </div>
        ) : res.content ? (
          <MessageRenderer content={res.content} />
        ) : res.status === 'running' ? (
          <span className="font-mono text-xs text-aegis-cyan animate-pulse">
            Streaming response...
          </span>
        ) : (
          <span className="font-mono text-xs text-aegis-text-secondary/60">
            Run comparison to generate response.
          </span>
        )}
      </div>
    </div>
  );

  return (
    <div className="flex-1 overflow-y-auto px-4 py-6">
      <div className="mx-auto max-w-5xl space-y-5">
        {/* Header Banner */}
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl bg-aegis-graphite/75 p-4 aegis-border">
          <div className="flex items-center gap-2.5">
            <FlaskConical className="h-4 w-4 text-aegis-cyan" />
            <div>
              <h2 className="font-heading text-sm font-semibold uppercase tracking-[0.2em] text-aegis-text">
                LLM PARAMETER CONTROL LAB
              </h2>
              <p className="font-mono text-[10px] text-aegis-text-secondary">
                Side-by-side controlled inference comparison (fallback disabled)
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleCopy}
              disabled={resultA.status === 'idle' && resultB.status === 'idle'}
              className="inline-flex items-center gap-1.5 rounded-lg bg-aegis-titanium/70 px-3 py-1.5 font-mono text-[10px] uppercase tracking-wider text-aegis-text transition-colors hover:bg-aegis-titanium disabled:opacity-40"
            >
              {copied ? (
                <>
                  <Check className="h-3.5 w-3.5 text-aegis-cyan" />
                  <span>Copied</span>
                </>
              ) : (
                <>
                  <Copy className="h-3.5 w-3.5" />
                  <span>Copy</span>
                </>
              )}
            </button>
            <button
              type="button"
              onClick={handleExport}
              disabled={resultA.status === 'idle' && resultB.status === 'idle'}
              className="inline-flex items-center gap-1.5 rounded-lg bg-aegis-titanium/70 px-3 py-1.5 font-mono text-[10px] uppercase tracking-wider text-aegis-text transition-colors hover:bg-aegis-titanium disabled:opacity-40"
            >
              <Download className="h-3.5 w-3.5" />
              <span>Export JSON</span>
            </button>
          </div>
        </div>

        {/* Prompt Input */}
        <div className="rounded-xl bg-aegis-graphite/75 p-4 aegis-border">
          <label
            htmlFor="lab-prompt-input"
            className="mb-2 block font-mono text-[11px] uppercase tracking-wider text-aegis-text-secondary"
          >
            Experiment Prompt
          </label>
          <div className="flex flex-col gap-3 sm:flex-row">
            <textarea
              id="lab-prompt-input"
              rows={2}
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              placeholder="Enter a prompt to test across Configuration A and Configuration B..."
              className="flex-1 resize-none rounded-lg bg-aegis-obsidian px-3 py-2 font-body text-sm text-aegis-text aegis-border focus:border-aegis-cyan focus:outline-none"
            />
            {isRunning ? (
              <button
                type="button"
                onClick={handleStop}
                className="inline-flex shrink-0 items-center justify-center gap-2 rounded-lg border border-aegis-amber/40 bg-aegis-amber/15 px-5 py-2 font-mono text-xs uppercase tracking-wider text-aegis-amber transition-colors hover:bg-aegis-amber/25"
              >
                <Square className="h-3.5 w-3.5 fill-current" />
                <span>Stop</span>
              </button>
            ) : (
              <button
                type="button"
                onClick={handleRunComparison}
                disabled={!prompt.trim()}
                className="inline-flex shrink-0 items-center justify-center gap-2 rounded-lg border border-aegis-cyan/40 bg-aegis-cyan/15 px-5 py-2 font-mono text-xs uppercase tracking-wider text-aegis-cyan transition-colors hover:bg-aegis-cyan/25 disabled:opacity-40"
              >
                <Play className="h-3.5 w-3.5" />
                <span>Run A vs B</span>
              </button>
            )}
          </div>
        </div>

        {/* Config A & Config B */}
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          {renderConfigCard('Configuration A', configA, setConfigA)}
          {renderConfigCard('Configuration B', configB, setConfigB)}
        </div>

        {/* Side-by-Side Results */}
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          {renderResultCard('Response A', resultA)}
          {renderResultCard('Response B', resultB)}
        </div>

        {/* Statistical Caveat */}
        <p className="rounded-lg bg-aegis-graphite/50 px-3 py-2 font-mono text-[10px] text-aegis-text-secondary aegis-border">
          Note: One generation per configuration is not sufficient to establish a
          statistical pattern. Stochastic sampling varies between runs.
        </p>

        {/* Educational Sampling Visualization */}
        <SamplingVisualizer />
      </div>
    </div>
  );
}

export default LLMLab;
