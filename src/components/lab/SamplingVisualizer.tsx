'use client';

import React, { useMemo } from 'react';
import { Info } from 'lucide-react';
import { useAppStore } from '@/lib/store';

interface CandidateToken {
  token: string;
  logit: number;
}

const HYPOTHETICAL_CANDIDATES: CandidateToken[] = [
  { token: 'door', logit: 4.2 },
  { token: 'box', logit: 3.1 },
  { token: 'window', logit: 2.5 },
  { token: 'portal', logit: 1.4 },
  { token: 'hatch', logit: 0.8 },
];

export interface SamplingVisualizerProps {
  temperature?: number;
  topP?: number;
  topK?: number;
  supportsTopK?: boolean;
}

export function SamplingVisualizer(props: SamplingVisualizerProps) {
  const llmConfig = useAppStore((s) => s.llmConfig);
  const availableModels = useAppStore((s) => s.availableModels);
  const settings = useAppStore((s) => s.settings);

  const activeCap = availableModels.find((m) => m.id === settings.model);
  const temperature = props.temperature ?? llmConfig.temperature;
  const topP = props.topP ?? llmConfig.topP;
  const supportsTopK = props.supportsTopK ?? (activeCap?.supportsTopK ?? true);
  const topK = props.topK ?? llmConfig.topK ?? 5;

  const distribution = useMemo(() => {
    const sorted = [...HYPOTHETICAL_CANDIDATES].sort((a, b) => b.logit - a.logit);

    let probs: number[];
    if (temperature <= 0.01) {
      probs = sorted.map((_, i) => (i === 0 ? 1 : 0));
    } else {
      const maxLogit = sorted[0].logit;
      const exps = sorted.map((c) => Math.exp((c.logit - maxLogit) / temperature));
      const sum = exps.reduce((acc, v) => acc + v, 0);
      probs = exps.map((v) => v / sum);
    }

    let cumulative = 0;
    let reachedThreshold = false;

    return sorted.map((item, index) => {
      const prob = probs[index];
      const inTopK = !supportsTopK || index < topK;
      const inNucleus = !reachedThreshold;
      cumulative += prob;
      if (cumulative >= topP) {
        reachedThreshold = true;
      }
      return {
        token: item.token,
        logit: item.logit,
        probability: prob,
        cumulative,
        inTopK,
        inNucleus,
        eligible: inTopK && inNucleus,
      };
    });
  }, [temperature, topP, topK, supportsTopK]);

  return (
    <div className="rounded-xl bg-aegis-graphite/75 p-4 aegis-border">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <div>
          <h3 className="font-heading text-xs font-semibold uppercase tracking-[0.18em] text-aegis-text">
            Sampling Distribution Visualizer
          </h3>
          <p className="mt-0.5 font-mono text-[11px] text-aegis-text-secondary">
            Prompt: <span className="text-aegis-ice">&quot;The robot opened the...&quot;</span>
          </p>
        </div>

        <span className="inline-flex items-center gap-1 rounded border border-aegis-amber/30 bg-aegis-amber/10 px-2 py-0.5 font-mono text-[9px] uppercase tracking-wider text-aegis-amber">
          <Info className="h-3 w-3" />
          Illustrative Only — Not Extracted From Gemini
        </span>
      </div>

      {/* Active Parameter Summary */}
      <div className="mb-3 flex flex-wrap gap-2 font-mono text-[10px] text-aegis-text-secondary">
        <span className="rounded bg-aegis-obsidian/80 px-2 py-1 aegis-border">
          T = <span className="text-aegis-cyan">{temperature.toFixed(2)}</span>
        </span>
        <span className="rounded bg-aegis-obsidian/80 px-2 py-1 aegis-border">
          Top-P = <span className="text-aegis-cyan">{topP.toFixed(2)}</span>
        </span>
        {supportsTopK && (
          <span className="rounded bg-aegis-obsidian/80 px-2 py-1 aegis-border">
            Top-K = <span className="text-aegis-cyan">{topK}</span>
          </span>
        )}
      </div>

      {/* Probability Bars */}
      <div className="space-y-2">
        {distribution.map((row) => {
          const pct = (row.probability * 100).toFixed(1);
          const cumPct = (row.cumulative * 100).toFixed(1);
          return (
            <div key={row.token} className="space-y-1">
              <div className="flex items-center justify-between font-mono text-[11px]">
                <div className="flex items-center gap-2">
                  <span
                    className={
                      row.eligible
                        ? 'font-medium text-aegis-text'
                        : 'text-aegis-text-secondary/50 line-through'
                    }
                  >
                    {row.token}
                  </span>
                  <span className="text-[9px] text-aegis-text-secondary/60">
                    logit {row.logit.toFixed(1)}
                  </span>
                  {row.inNucleus && (
                    <span className="rounded bg-aegis-cyan/15 px-1.5 py-0.2 text-[9px] text-aegis-cyan">
                      Top-P
                    </span>
                  )}
                  {supportsTopK && row.inTopK && (
                    <span className="rounded bg-aegis-titanium px-1.5 py-0.2 text-[9px] text-aegis-ice">
                      Top-K
                    </span>
                  )}
                </div>
                <span className="text-aegis-text-secondary">
                  <span className={row.eligible ? 'text-aegis-ice' : ''}>
                    {pct}%
                  </span>{' '}
                  <span className="text-[9px] text-aegis-text-secondary/60">
                    (cum {cumPct}%)
                  </span>
                </span>
              </div>

              <div className="h-2 w-full overflow-hidden rounded-full bg-aegis-obsidian/80">
                <div
                  className={`h-full rounded-full transition-all duration-200 ${
                    row.eligible
                      ? 'bg-aegis-cyan/80'
                      : 'bg-aegis-titanium/70'
                  }`}
                  style={{ width: `${Math.max(row.probability * 100, 1)}%` }}
                />
              </div>
            </div>
          );
        })}
      </div>

      <p className="mt-3 font-body text-[11px] leading-relaxed text-aegis-text-secondary">
        Mathematically computed via softmax{' '}
        <span className="font-mono text-[10px] text-aegis-ice">
          P_i = exp(z_i / T) / sum(exp(z_j / T))
        </span>
        . Highlighted tokens pass both Top-K (when supported) and the Top-P nucleus
        threshold.
      </p>
    </div>
  );
}

export default SamplingVisualizer;
