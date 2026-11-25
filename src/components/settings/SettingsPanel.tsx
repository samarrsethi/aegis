'use client';

import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  X,
  SlidersHorizontal,
  Mic,
  Volume2,
  Monitor,
  Cpu,
  Database,
  RotateCcw,
  Trash2,
  AlertTriangle,
  ChevronDown,
} from 'lucide-react';
import { useAppStore } from '@/lib/store';
import type { AegisSettings } from '@/types';

// ─── Constants ───

const AI_MODELS = [
  { value: 'gemini-3.5-flash-lite', label: 'Gemini 3.5 Flash Lite', badge: '500 RPD' },
  { value: 'gemini-3.1-flash-lite', label: 'Gemini 3.1 Flash Lite', badge: '500 RPD' },
  { value: 'gemini-3.5-flash', label: 'Gemini 3.5 Flash', badge: 'Limited' },
  { value: 'gemini-3.6-flash', label: 'Gemini 3.6 Flash', badge: '20 RPD' },
] as const;

const ANIMATION_QUALITY_OPTIONS: {
  value: AegisSettings['animationQuality'];
  label: string;
}[] = [
  { value: 'low', label: 'Low' },
  { value: 'medium', label: 'Medium' },
  { value: 'high', label: 'High' },
];

// ─── Custom Toggle Component ───

interface ToggleProps {
  id: string;
  label: string;
  description?: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
  reducedMotion?: boolean;
}

function Toggle({
  id,
  label,
  description,
  checked,
  onChange,
  reducedMotion = false,
}: ToggleProps) {
  return (
    <div className="flex items-center justify-between gap-4 py-2">
      <div className="flex-1 min-w-0">
        <label
          htmlFor={id}
          className="block text-sm font-body font-medium text-aegis-text cursor-pointer select-none"
        >
          {label}
        </label>
        {description && (
          <p className="text-xs font-body text-aegis-text-secondary mt-0.5 leading-relaxed">
            {description}
          </p>
        )}
      </div>

      <button
        id={id}
        type="button"
        role="switch"
        aria-checked={checked}
        aria-label={label}
        onClick={() => onChange(!checked)}
        className={`relative inline-flex items-center shrink-0 w-[40px] h-[22px] rounded-full p-[3px] focus-visible:outline focus-visible:outline-1 focus-visible:outline-aegis-cyan ${
          reducedMotion ? '' : 'transition-colors duration-200 ease-in-out'
        } ${
          checked
            ? 'bg-aegis-cyan shadow-[0_0_12px_rgba(83,217,232,0.15)]'
            : 'bg-aegis-titanium'
        }`}
      >
        <span
          aria-hidden="true"
          className={`block w-4 h-4 rounded-full shadow-sm ${
            reducedMotion ? '' : 'transition-transform duration-200 ease-in-out'
          } ${
            checked
              ? 'translate-x-[18px] bg-aegis-obsidian'
              : 'translate-x-0 bg-aegis-text-secondary'
          }`}
        />
      </button>
    </div>
  );
}

// ─── Section Header Helper ───

interface SectionHeaderProps {
  icon: React.ReactNode;
  title: string;
}

function SectionHeader({ icon, title }: SectionHeaderProps) {
  return (
    <div className="flex items-center gap-2 mb-3">
      <span className="text-aegis-cyan">{icon}</span>
      <h3 className="font-heading text-xs font-semibold uppercase tracking-widest text-aegis-ice">
        {title}
      </h3>
    </div>
  );
}

// ─── SettingsPanel Component ───

export function SettingsPanel() {
  const settingsOpen = useAppStore((s) => s.settingsOpen);
  const setSettingsOpen = useAppStore((s) => s.setSettingsOpen);
  const settings = useAppStore((s) => s.settings);
  const updateSettings = useAppStore((s) => s.updateSettings);
  const introComplete = useAppStore((s) => s.introComplete);
  const replayIntro = useAppStore((s) => s.replayIntro);
  const clearHistory = useAppStore((s) => s.clearHistory);
  const conversationsCount = useAppStore((s) => s.conversations.length);

  const [confirmClearOpen, setConfirmClearOpen] = useState(false);

  // Reset confirmation dialog whenever settings panel closes
  useEffect(() => {
    if (!settingsOpen) {
      setConfirmClearOpen(false);
    }
  }, [settingsOpen]);

  // Close confirmation dialog or settings panel on Escape key
  useEffect(() => {
    if (!settingsOpen) return;

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        if (confirmClearOpen) {
          setConfirmClearOpen(false);
        } else {
          setSettingsOpen(false);
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [settingsOpen, confirmClearOpen, setSettingsOpen]);

  const handleReplayIntro = () => {
    replayIntro();
    setSettingsOpen(false);
  };

  const handleConfirmClearHistory = () => {
    clearHistory();
    setConfirmClearOpen(false);
  };

  const motionDuration = settings.reducedMotion ? 0.01 : 0.25;

  return (
    <AnimatePresence>
      {settingsOpen && (
        <div
          className="fixed inset-0 z-50 flex justify-end"
          role="dialog"
          aria-modal="true"
          aria-labelledby="aegis-settings-title"
        >
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: motionDuration }}
            onClick={() => setSettingsOpen(false)}
            className="fixed inset-0 bg-aegis-obsidian/65 backdrop-blur-sm"
            aria-hidden="true"
          />

          {/* Slide-in Panel */}
          <motion.aside
            initial={settings.reducedMotion ? { opacity: 0 } : { x: '100%' }}
            animate={settings.reducedMotion ? { opacity: 1 } : { x: 0 }}
            exit={settings.reducedMotion ? { opacity: 0 } : { x: '100%' }}
            transition={
              settings.reducedMotion
                ? { duration: 0.01 }
                : { type: 'spring', damping: 32, stiffness: 320 }
            }
            className="relative z-10 flex flex-col w-full max-w-md h-full bg-aegis-graphite/90 backdrop-blur-xl border-l border-aegis-cyan/15 shadow-2xl"
          >
            {/* Header */}
            <header className="flex items-center justify-between px-6 py-5 border-b border-aegis-cyan/10 shrink-0">
              <div className="flex items-center gap-2.5">
                <SlidersHorizontal className="w-4 h-4 text-aegis-cyan" />
                <h2
                  id="aegis-settings-title"
                  className="font-heading text-sm font-semibold tracking-wider text-aegis-text uppercase"
                >
                  SYSTEM SETTINGS
                </h2>
              </div>

              <button
                type="button"
                onClick={() => setSettingsOpen(false)}
                aria-label="Close settings"
                className="inline-flex items-center justify-center w-8 h-8 rounded-lg text-aegis-text-secondary hover:text-aegis-text hover:bg-aegis-titanium/70 transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </header>

            {/* Scrollable Body */}
            <div className="flex-1 overflow-y-auto px-6 py-5 space-y-6">
              {/* Voice Section */}
              <section aria-labelledby="settings-voice-heading">
                <SectionHeader
                  icon={<Mic className="w-3.5 h-3.5" />}
                  title="Voice"
                />
                <div id="settings-voice-heading" className="space-y-1">
                  <Toggle
                    id="toggle-voice-input"
                    label="Voice Input"
                    description="Enable microphone speech-to-text input"
                    checked={settings.voiceEnabled}
                    onChange={(voiceEnabled) => updateSettings({ voiceEnabled })}
                    reducedMotion={settings.reducedMotion}
                  />
                  <Toggle
                    id="toggle-voice-output"
                    label="Voice Output"
                    description="Enable spoken assistant responses"
                    checked={settings.voiceOutputEnabled}
                    onChange={(voiceOutputEnabled) =>
                      updateSettings({ voiceOutputEnabled })
                    }
                    reducedMotion={settings.reducedMotion}
                  />
                </div>
              </section>

              <div className="h-px bg-aegis-cyan/10" role="separator" />

              {/* Audio Section */}
              <section aria-labelledby="settings-audio-heading">
                <SectionHeader
                  icon={<Volume2 className="w-3.5 h-3.5" />}
                  title="Audio"
                />
                <div id="settings-audio-heading">
                  <Toggle
                    id="toggle-startup-sound"
                    label="Startup Sound"
                    description="Play subtle synthesized chime on initialization"
                    checked={settings.startupSoundEnabled}
                    onChange={(startupSoundEnabled) =>
                      updateSettings({ startupSoundEnabled })
                    }
                    reducedMotion={settings.reducedMotion}
                  />
                </div>
              </section>

              <div className="h-px bg-aegis-cyan/10" role="separator" />

              {/* Display Section */}
              <section aria-labelledby="settings-display-heading">
                <SectionHeader
                  icon={<Monitor className="w-3.5 h-3.5" />}
                  title="Display"
                />
                <div id="settings-display-heading" className="space-y-2">
                  <Toggle
                    id="toggle-autoplay-intro"
                    label="Auto-play Intro"
                    description="Launch A.E.G.I.S. boot sequence on startup"
                    checked={settings.autoPlayIntro}
                    onChange={(autoPlayIntro) => updateSettings({ autoPlayIntro })}
                    reducedMotion={settings.reducedMotion}
                  />
                  <Toggle
                    id="toggle-reduced-motion"
                    label="Reduced Motion"
                    description="Minimize non-essential transitions and orb motion"
                    checked={settings.reducedMotion}
                    onChange={(reducedMotion) => updateSettings({ reducedMotion })}
                    reducedMotion={settings.reducedMotion}
                  />

                  {/* Animation Quality Select */}
                  <div className="flex items-center justify-between gap-4 py-2">
                    <label
                      htmlFor="select-animation-quality"
                      className="text-sm font-body font-medium text-aegis-text"
                    >
                      Animation Quality
                    </label>
                    <div className="relative">
                      <select
                        id="select-animation-quality"
                        value={settings.animationQuality}
                        onChange={(e) =>
                          updateSettings({
                            animationQuality: e.target
                              .value as AegisSettings['animationQuality'],
                          })
                        }
                        className="appearance-none bg-aegis-obsidian/80 aegis-border text-aegis-text text-xs font-mono rounded-lg pl-3 pr-8 py-2 cursor-pointer hover:border-aegis-cyan/30 focus:outline-none focus:border-aegis-cyan transition-colors"
                      >
                        {ANIMATION_QUALITY_OPTIONS.map((option) => (
                          <option
                            key={option.value}
                            value={option.value}
                            className="bg-aegis-graphite text-aegis-text"
                          >
                            {option.label}
                          </option>
                        ))}
                      </select>
                      <ChevronDown className="w-3.5 h-3.5 text-aegis-text-secondary pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2" />
                    </div>
                  </div>

                  {/* Replay Intro Button (only when intro is complete) */}
                  {introComplete && (
                    <div className="pt-1">
                      <button
                        type="button"
                        onClick={handleReplayIntro}
                        className="w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg bg-aegis-titanium/60 hover:bg-aegis-titanium aegis-border text-aegis-ice hover:text-aegis-cyan text-xs font-mono uppercase tracking-wider transition-colors"
                      >
                        <RotateCcw className="w-3.5 h-3.5" />
                        <span>Replay Intro</span>
                      </button>
                    </div>
                  )}
                </div>
              </section>

              <div className="h-px bg-aegis-cyan/10" role="separator" />

              {/* AI Model Section */}
              <section aria-labelledby="settings-model-heading">
                <SectionHeader
                  icon={<Cpu className="w-3.5 h-3.5" />}
                  title="AI Model"
                />
                <div id="settings-model-heading" className="space-y-2.5">
                  <div className="flex items-center justify-between gap-4">
                    <label
                      htmlFor="select-ai-model"
                      className="text-sm font-body font-medium text-aegis-text"
                    >
                      Model
                    </label>
                    <div className="relative">
                      <select
                        id="select-ai-model"
                        value={settings.model}
                        onChange={(e) => updateSettings({ model: e.target.value })}
                        className="appearance-none bg-aegis-obsidian/80 aegis-border text-aegis-text text-xs font-mono rounded-lg pl-3 pr-8 py-2 cursor-pointer hover:border-aegis-cyan/30 focus:outline-none focus:border-aegis-cyan transition-colors"
                      >
                        {AI_MODELS.map((modelOption) => (
                          <option
                            key={modelOption.value}
                            value={modelOption.value}
                            className="bg-aegis-graphite text-aegis-text"
                          >
                            {modelOption.value}
                          </option>
                        ))}
                      </select>
                      <ChevronDown className="w-3.5 h-3.5 text-aegis-text-secondary pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2" />
                    </div>
                  </div>

                  <div className="flex items-center justify-between rounded-lg bg-aegis-obsidian/50 aegis-border px-3 py-2">
                    <span className="text-xs font-body text-aegis-text-secondary">
                      Active Model
                    </span>
                    <span className="font-mono text-xs text-aegis-cyan">
                      {settings.model}
                    </span>
                  </div>
                </div>
              </section>

              <div className="h-px bg-aegis-cyan/10" role="separator" />

              {/* Data Section */}
              <section aria-labelledby="settings-data-heading">
                <SectionHeader
                  icon={<Database className="w-3.5 h-3.5" />}
                  title="Data"
                />
                <div id="settings-data-heading" className="space-y-2.5">
                  <button
                    type="button"
                    onClick={() => setConfirmClearOpen(true)}
                    className="w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg bg-aegis-obsidian/70 hover:bg-aegis-amber/10 border border-aegis-amber/25 hover:border-aegis-amber/50 text-aegis-amber text-xs font-mono uppercase tracking-wider transition-colors"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>Clear All Conversations</span>
                  </button>
                  <p className="text-xs font-body text-aegis-text-secondary text-center">
                    Conversations stored locally in this browser
                  </p>
                </div>
              </section>
            </div>

            {/* Confirmation Dialog Overlay */}
            <AnimatePresence>
              {confirmClearOpen && (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: settings.reducedMotion ? 0.01 : 0.15 }}
                  role="alertdialog"
                  aria-modal="true"
                  aria-labelledby="clear-confirm-title"
                  aria-describedby="clear-confirm-description"
                  className="absolute inset-0 z-20 flex items-center justify-center p-6 bg-aegis-obsidian/80 backdrop-blur-sm"
                >
                  <motion.div
                    initial={
                      settings.reducedMotion ? { opacity: 0 } : { opacity: 0, scale: 0.96 }
                    }
                    animate={
                      settings.reducedMotion ? { opacity: 1 } : { opacity: 1, scale: 1 }
                    }
                    exit={
                      settings.reducedMotion ? { opacity: 0 } : { opacity: 0, scale: 0.96 }
                    }
                    transition={{ duration: settings.reducedMotion ? 0.01 : 0.15 }}
                    className="w-full max-w-sm rounded-xl bg-aegis-graphite border border-aegis-amber/30 p-5 shadow-2xl"
                  >
                    <div className="flex items-start gap-3 mb-4">
                      <div className="p-2 rounded-lg bg-aegis-amber/10 text-aegis-amber shrink-0">
                        <AlertTriangle className="w-5 h-5" />
                      </div>
                      <div>
                        <h4
                          id="clear-confirm-title"
                          className="font-heading text-sm font-semibold text-aegis-text"
                        >
                          Clear All Conversations?
                        </h4>
                        <p
                          id="clear-confirm-description"
                          className="text-xs font-body text-aegis-text-secondary mt-1 leading-relaxed"
                        >
                          {conversationsCount > 0
                            ? `This will permanently remove all ${conversationsCount} conversation${conversationsCount === 1 ? '' : 's'} from local browser storage.`
                            : 'This will clear all conversation history from local browser storage.'}{' '}
                          This action cannot be undone.
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center justify-end gap-2.5">
                      <button
                        type="button"
                        onClick={() => setConfirmClearOpen(false)}
                        className="px-3.5 py-2 rounded-lg bg-aegis-titanium/70 hover:bg-aegis-titanium text-aegis-text text-xs font-body font-medium transition-colors"
                      >
                        Cancel
                      </button>
                      <button
                        type="button"
                        onClick={handleConfirmClearHistory}
                        className="px-3.5 py-2 rounded-lg bg-aegis-amber/20 hover:bg-aegis-amber/30 border border-aegis-amber/40 text-aegis-amber text-xs font-mono uppercase tracking-wider transition-colors"
                      >
                        Confirm Clear
                      </button>
                    </div>
                  </motion.div>
                </motion.div>
              )}
            </AnimatePresence>
          </motion.aside>
        </div>
      )}
    </AnimatePresence>
  );
}

export default SettingsPanel;
