'use client';

import React, { useMemo, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Check,
  Cpu,
  RotateCcw,
  Save,
  Sliders,
  X,
} from 'lucide-react';
import { useAppStore } from '@/lib/store';
import type { ModelCapability } from '@/types';

const FALLBACK_MODEL_LIST: ModelCapability[] = [
  {
    id: 'gemini-3.5-flash-lite',
    displayName: 'Gemini 3.5 Flash Lite',
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
  {
    id: 'gemini-3.1-flash-lite',
    displayName: 'Gemini 3.1 Flash Lite',
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
];

export function NeuralConfigPanel() {
  const neuralConfigOpen = useAppStore((s) => s.neuralConfigOpen);
  const setNeuralConfigOpen = useAppStore((s) => s.setNeuralConfigOpen);
  const availableModels = useAppStore((s) => s.availableModels);
  const settings = useAppStore((s) => s.settings);
  const updateSettings = useAppStore((s) => s.updateSettings);
  const llmConfig = useAppStore((s) => s.llmConfig);
  const updateLlmConfig = useAppStore((s) => s.updateLlmConfig);
  const saveLlmConfiguration = useAppStore((s) => s.saveLlmConfiguration);
  const resetLlmConfig = useAppStore((s) => s.resetLlmConfig);
  const setSystemStatus = useAppStore((s) => s.setSystemStatus);

  const [savedToast, setSavedToast] = useState(false);

  const models = availableModels.length > 0 ? availableModels : FALLBACK_MODEL_LIST;

  const selectedCap = useMemo(
    () => models.find((m) => m.id === settings.model) || models[0],
    [models, settings.model]
  );

  const maxTemp = selectedCap.maxTemperature ?? 2;
  const maxOut = selectedCap.outputTokenLimit ?? 65536;
  const maxTopK = selectedCap.maxTopK ?? 64;

  const handleModelChange = (modelId: string) => {
    const cap = models.find((m) => m.id === modelId) || selectedCap;
    updateSettings({ model: modelId });
    setSystemStatus({ model: modelId });

    // Clamp parameters to the newly selected model's supported limits
    updateLlmConfig({
      temperature: Math.min(llmConfig.temperature, cap.maxTemperature),
      maxOutputTokens: Math.min(llmConfig.maxOutputTokens, cap.outputTokenLimit),
      topP: Math.min(Math.max(llmConfig.topP, 0), 1),
      ...(cap.supportsTopK
        ? {
            topK: Math.min(
              llmConfig.topK ?? Math.min(40, cap.maxTopK ?? 64),
              cap.maxTopK ?? 64
            ),
          }
        : { topK: undefined }),
    });
  };

  const handleSave = () => {
    saveLlmConfiguration();
    setSavedToast(true);
    setTimeout(() => setSavedToast(false), 1800);
  };

  const handleReset = () => {
    resetLlmConfig(selectedCap);
  };

  return (
    <AnimatePresence>
      {neuralConfigOpen && (
        <motion.aside
          initial={settings.reducedMotion ? { opacity: 1 } : { opacity: 0, x: 24 }}
          animate={{ opacity: 1, x: 0 }}
          exit={settings.reducedMotion ? { opacity: 0 } : { opacity: 0, x: 24 }}
          transition={{ duration: settings.reducedMotion ? 0.01 : 0.2 }}
          className="fixed inset-y-0 right-0 z-40 flex w-full max-w-sm flex-col border-l border-aegis-cyan/15 bg-aegis-obsidian/95 backdrop-blur-md shadow-2xl"
          aria-label="Neural Configuration"
        >
          {/* Header */}
          <div className="flex h-14 shrink-0 items-center justify-between border-b border-aegis-cyan/10 px-4">
            <div className="flex items-center gap-2">
              <Sliders className="h-4 w-4 text-aegis-cyan" />
              <h2 className="font-heading text-xs font-semibold uppercase tracking-[0.2em] text-aegis-text">
                NEURAL CONFIGURATION
              </h2>
            </div>
            <button
              type="button"
              onClick={() => setNeuralConfigOpen(false)}
              aria-label="Close Neural Configuration"
              className="rounded-lg p-1.5 text-aegis-text-secondary transition-colors hover:bg-aegis-titanium/60 hover:text-aegis-cyan"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          {/* Body */}
          <div className="flex-1 space-y-5 overflow-y-auto p-4">
            {/* 1. Model Selector */}
            <section className="space-y-2 rounded-xl bg-aegis-graphite/70 p-3.5 aegis-border">
              <div className="flex items-center justify-between">
                <label
                  htmlFor="neural-model-select"
                  className="flex items-center gap-1.5 font-mono text-[11px] uppercase tracking-wider text-aegis-text"
                >
                  <Cpu className="h-3.5 w-3.5 text-aegis-cyan" />
                  <span>Model</span>
                </label>
                <span className="font-mono text-[10px] text-aegis-cyan">
                  {selectedCap.id}
                </span>
              </div>

              <select
                id="neural-model-select"
                value={selectedCap.id}
                onChange={(e) => handleModelChange(e.target.value)}
                className="w-full rounded-lg bg-aegis-obsidian px-3 py-2 font-mono text-xs text-aegis-text aegis-border focus:border-aegis-cyan focus:outline-none"
              >
                {models.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.displayName} ({m.id})
                  </option>
                ))}
              </select>

              <div className="grid grid-cols-2 gap-2 pt-1 font-mono text-[10px] text-aegis-text-secondary">
                <div className="rounded-md bg-aegis-obsidian/70 px-2 py-1.5">
                  <div className="text-[9px] uppercase text-aegis-text-secondary/70">
                    Context Window
                  </div>
                  <div className="text-aegis-ice">
                    {selectedCap.inputTokenLimit.toLocaleString()} tok
                  </div>
                </div>
                <div className="rounded-md bg-aegis-obsidian/70 px-2 py-1.5">
                  <div className="text-[9px] uppercase text-aegis-text-secondary/70">
                    Max Output Limit
                  </div>
                  <div className="text-aegis-ice">
                    {selectedCap.outputTokenLimit.toLocaleString()} tok
                  </div>
                </div>
              </div>
              <div className="flex flex-wrap gap-1.5 pt-0.5 font-mono text-[9px]">
                <span className="rounded bg-aegis-titanium/70 px-1.5 py-0.5 text-aegis-text-secondary">
                  Temp: 0–{maxTemp}
                </span>
                <span className="rounded bg-aegis-titanium/70 px-1.5 py-0.5 text-aegis-text-secondary">
                  Top-K: {selectedCap.supportsTopK ? `1–${maxTopK}` : 'Unsupported'}
                </span>
                <span className="rounded bg-aegis-titanium/70 px-1.5 py-0.5 text-aegis-text-secondary">
                  countTokens: {selectedCap.supportsCountTokens ? 'Supported' : 'No'}
                </span>
              </div>
            </section>

            {/* 2. Temperature */}
            <section className="space-y-2 rounded-xl bg-aegis-graphite/70 p-3.5 aegis-border">
              <div className="flex items-center justify-between font-mono text-xs">
                <label
                  htmlFor="neural-temp-slider"
                  className="text-[11px] uppercase tracking-wider text-aegis-text"
                >
                  Temperature
                </label>
                <span className="text-aegis-cyan">
                  {llmConfig.temperature.toFixed(2)}
                </span>
              </div>
              <input
                id="neural-temp-slider"
                type="range"
                min={0}
                max={maxTemp}
                step={0.05}
                value={Math.min(llmConfig.temperature, maxTemp)}
                onChange={(e) =>
                  updateLlmConfig({ temperature: parseFloat(e.target.value) })
                }
                className="w-full accent-[#53D9E8]"
              />
              <div className="flex justify-between font-mono text-[9px] text-aegis-text-secondary">
                <span>0.0 (Deterministic)</span>
                <span>{maxTemp.toFixed(1)} (Creative)</span>
              </div>
              <p className="font-body text-[11px] leading-relaxed text-aegis-text-secondary">
                Scales raw logits before softmax. Lower values sharpen the distribution
                toward high-probability tokens; higher values flatten it, increasing
                randomness.
              </p>
            </section>

            {/* 3. Maximum Output Tokens */}
            <section className="space-y-2 rounded-xl bg-aegis-graphite/70 p-3.5 aegis-border">
              <div className="flex items-center justify-between font-mono text-xs">
                <label
                  htmlFor="neural-max-tokens"
                  className="text-[11px] uppercase tracking-wider text-aegis-text"
                >
                  Max Output Tokens
                </label>
                <input
                  id="neural-max-tokens"
                  type="number"
                  min={1}
                  max={maxOut}
                  value={llmConfig.maxOutputTokens}
                  onChange={(e) => {
                    const parsed = parseInt(e.target.value, 10);
                    if (!Number.isNaN(parsed)) {
                      updateLlmConfig({
                        maxOutputTokens: Math.min(Math.max(parsed, 1), maxOut),
                      });
                    }
                  }}
                  className="w-24 rounded bg-aegis-obsidian px-2 py-1 text-right font-mono text-xs text-aegis-cyan aegis-border focus:border-aegis-cyan focus:outline-none"
                />
              </div>
              <input
                type="range"
                min={64}
                max={Math.min(maxOut, 8192)}
                step={64}
                value={Math.min(llmConfig.maxOutputTokens, Math.min(maxOut, 8192))}
                onChange={(e) =>
                  updateLlmConfig({ maxOutputTokens: parseInt(e.target.value, 10) })
                }
                className="w-full accent-[#53D9E8]"
              />
              <p className="font-body text-[11px] leading-relaxed text-aegis-text-secondary">
                Caps the generated response length (up to{' '}
                {maxOut.toLocaleString()} tokens). Distinct from the{' '}
                {selectedCap.inputTokenLimit.toLocaleString()}-token context window,
                which bounds total input + history.
              </p>
            </section>

            {/* 4. Top-P */}
            <section className="space-y-2 rounded-xl bg-aegis-graphite/70 p-3.5 aegis-border">
              <div className="flex items-center justify-between font-mono text-xs">
                <label
                  htmlFor="neural-top-p"
                  className="text-[11px] uppercase tracking-wider text-aegis-text"
                >
                  Top-P (Nucleus)
                </label>
                <span className="text-aegis-cyan">{llmConfig.topP.toFixed(2)}</span>
              </div>
              <input
                id="neural-top-p"
                type="range"
                min={0.05}
                max={1}
                step={0.05}
                value={llmConfig.topP}
                onChange={(e) =>
                  updateLlmConfig({ topP: parseFloat(e.target.value) })
                }
                className="w-full accent-[#53D9E8]"
              />
              <p className="font-body text-[11px] leading-relaxed text-aegis-text-secondary">
                Nucleus sampling keeps only the smallest set of highest-probability
                tokens whose cumulative probability reaches P.
              </p>
            </section>

            {/* 5. Top-K */}
            {selectedCap.supportsTopK ? (
              <section className="space-y-2 rounded-xl bg-aegis-graphite/70 p-3.5 aegis-border">
                <div className="flex items-center justify-between font-mono text-xs">
                  <label
                    htmlFor="neural-top-k"
                    className="text-[11px] uppercase tracking-wider text-aegis-text"
                  >
                    Top-K
                  </label>
                  <span className="text-aegis-cyan">
                    {llmConfig.topK ?? selectedCap.defaultTopK ?? 40}
                  </span>
                </div>
                <input
                  id="neural-top-k"
                  type="range"
                  min={1}
                  max={maxTopK}
                  step={1}
                  value={Math.min(
                    llmConfig.topK ?? selectedCap.defaultTopK ?? 40,
                    maxTopK
                  )}
                  onChange={(e) =>
                    updateLlmConfig({ topK: parseInt(e.target.value, 10) })
                  }
                  className="w-full accent-[#53D9E8]"
                />
                <p className="font-body text-[11px] leading-relaxed text-aegis-text-secondary">
                  Restricts candidate selection to the K highest-probability tokens at
                  each step (1–{maxTopK} for {selectedCap.id}).
                </p>
              </section>
            ) : (
              <section className="rounded-xl bg-aegis-graphite/40 p-3.5 aegis-border">
                <div className="font-mono text-[11px] uppercase tracking-wider text-aegis-text-secondary">
                  Top-K
                </div>
                <p className="mt-1 font-body text-[11px] text-aegis-text-secondary/80">
                  Not configurable for {selectedCap.id} and will not be sent.
                </p>
              </section>
            )}
          </div>

          {/* Footer Actions */}
          <div className="flex shrink-0 items-center gap-2 border-t border-aegis-cyan/10 bg-aegis-graphite/60 p-4">
            <button
              type="button"
              onClick={handleReset}
              className="inline-flex flex-1 items-center justify-center gap-1.5 rounded-lg bg-aegis-titanium/70 px-3 py-2 font-mono text-[11px] uppercase tracking-wider text-aegis-text transition-colors hover:bg-aegis-titanium"
            >
              <RotateCcw className="h-3.5 w-3.5" />
              <span>Reset</span>
            </button>
            <button
              type="button"
              onClick={handleSave}
              className="inline-flex flex-1 items-center justify-center gap-1.5 rounded-lg border border-aegis-cyan/40 bg-aegis-cyan/15 px-3 py-2 font-mono text-[11px] uppercase tracking-wider text-aegis-cyan transition-colors hover:bg-aegis-cyan/25"
            >
              {savedToast ? (
                <>
                  <Check className="h-3.5 w-3.5" />
                  <span>Saved</span>
                </>
              ) : (
                <>
                  <Save className="h-3.5 w-3.5" />
                  <span>Save Config</span>
                </>
              )}
            </button>
          </div>
        </motion.aside>
      )}
    </AnimatePresence>
  );
}

export default NeuralConfigPanel;
