'use client';

import React, { Component, useCallback, useEffect, useRef, useState } from 'react';
import gsap from 'gsap';
import { Volume2, VolumeX } from 'lucide-react';
import { useAppStore } from '@/lib/store';
import { CinematicMusicEngine } from '@/lib/audio/CinematicMusicEngine';
import {
  HolographicSuit3D,
  createInitialHologramState,
  type HologramDirectorState,
} from './HolographicSuit3D';

class IntroWebGLErrorBoundary extends Component<
  { children: React.ReactNode; onError: () => void },
  { hasError: boolean }
> {
  constructor(props: { children: React.ReactNode; onError: () => void }) {
    super(props);
    this.state = { hasError: false };
  }
  static getDerivedStateFromError() {
    return { hasError: true };
  }
  componentDidCatch() {
    this.props.onError();
  }
  render() {
    if (this.state.hasError) return null;
    return this.props.children;
  }
}

export function CinematicIntro() {
  const settings = useAppStore((s) => s.settings);
  const updateSettings = useAppStore((s) => s.updateSettings);
  const setIntroComplete = useAppStore((s) => s.setIntroComplete);
  const skipIntro = useAppStore((s) => s.skipIntro);

  const [isMobile, setIsMobile] = useState(false);
  const [webglFailed, setWebglFailed] = useState(false);
  const [awaitingGate, setAwaitingGate] = useState<boolean>(
    settings.startupSoundEnabled
  );
  const [overlayOpacity, setOverlayOpacity] = useState(1);

  const directorRef = useRef<HologramDirectorState>(createInitialHologramState());
  const timelineRef = useRef<gsap.core.Timeline | null>(null);
  const musicRef = useRef<CinematicMusicEngine | null>(null);
  const startedRef = useRef(false);

  // Detect mobile viewport
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const mq = window.matchMedia('(max-width: 767px)');
    const update = () => setIsMobile(mq.matches);
    update();
    mq.addEventListener('change', update);
    return () => mq.removeEventListener('change', update);
  }, []);

  // Reduced-motion fallback
  useEffect(() => {
    if (settings.reducedMotion) {
      const t = setTimeout(() => {
        setIntroComplete();
      }, 200);
      return () => clearTimeout(t);
    }
  }, [settings.reducedMotion, setIntroComplete]);

  const cleanupAll = useCallback(() => {
    if (timelineRef.current) {
      timelineRef.current.kill();
      timelineRef.current = null;
    }
    if (musicRef.current) {
      musicRef.current.dispose();
      musicRef.current = null;
    }
  }, []);

  const handleSkip = useCallback(() => {
    cleanupAll();
    skipIntro();
  }, [cleanupAll, skipIntro]);

  const handleToggleMute = useCallback(() => {
    const nextEnabled = !settings.startupSoundEnabled;
    updateSettings({ startupSoundEnabled: nextEnabled });
    if (musicRef.current) {
      if (nextEnabled) {
        musicRef.current.init().then(() => {
          musicRef.current?.setMuted(false);
        });
      } else {
        musicRef.current.setMuted(true);
      }
    }
  }, [settings.startupSoundEnabled, updateSettings]);

  const runSequence = useCallback(
    async (withSound: boolean) => {
      if (startedRef.current || settings.reducedMotion) return;
      startedRef.current = true;
      setAwaitingGate(false);

      const music = new CinematicMusicEngine();
      musicRef.current = music;
      if (withSound) {
        const ok = await music.init();
        music.setMuted(!ok);
      } else {
        music.setMuted(true);
      }

      const d = directorRef.current;
      const overlayProxy = { val: 1 };

      const tl = gsap.timeline({
        onUpdate: () => {
          // Map progress smoothly (capped below 0.71 to keep score purely melodic/ambient without blast hit)
          music.setProgress(Math.min(0.68, tl.progress() * 0.85));
        },
        onComplete: () => {
          cleanupAll();
          setIntroComplete();
        },
      });
      timelineRef.current = tl;

      // ─── SCENE 1: INITIALIZATION (0.0s – 1.4s) ───
      // Black screen -> small cyan particles -> thin luminous lines emerge
      tl.to(
        d,
        {
          gridOpacity: 0.75,
          initLinesProgress: 1,
          duration: 1.4,
          ease: 'power1.inOut',
        },
        0
      );

      // ─── SCENE 2: HOLOGRAM CONSTRUCTION (1.4s – 4.4s) ───
      // Progressive path-tracing: helmet -> eyes -> neck/shoulders -> chest/reactor -> arms -> torso/legs
      tl.to(
        d,
        {
          drawProgress: 1,
          scanY: 2.2,
          duration: 3.0,
          ease: 'power1.inOut',
        },
        1.4
      );
      tl.to(d, { eyesGlow: 1, duration: 0.45, ease: 'power2.out' }, 1.85);

      // ─── SCENE 3: REACTOR ACTIVATION (4.4s – 6.4s) ───
      // Smooth camera push toward chest, rotating concentric rings, energy pulse through lines
      tl.to(
        d,
        {
          cameraZ: 3.0,
          cameraY: 1.36,
          cameraLookY: 1.36,
          reactorSpin: 2.0,
          reactorGlow: 1.0,
          duration: 1.5,
          ease: 'power2.inOut',
        },
        4.4
      );
      tl.to(
        d,
        {
          energyWave: 1.35,
          duration: 1.4,
          ease: 'power1.inOut',
        },
        4.8
      );

      // ─── SCENE 4: HOLOGRAPHIC DISINTEGRATION (6.4s – 8.0s) ───
      // Dissolve into thousands of glowing lines & particles -> converge toward center
      tl.to(
        d,
        {
          disintegrate: 1,
          gridOpacity: 0,
          cameraZ: 5.2,
          cameraY: 1.15,
          cameraLookY: 1.15,
          duration: 0.9,
          ease: 'power2.out',
        },
        6.4
      );
      tl.to(
        d,
        {
          collapseToOrb: 1,
          duration: 0.9,
          ease: 'power2.inOut',
        },
        7.1
      );

      // ─── SCENE 5: A.E.G.I.S. REVEAL (8.0s – 9.0s) ───
      // Smooth cross-fade into the chatbot around the AI orb
      tl.to(
        overlayProxy,
        {
          val: 0,
          duration: 0.95,
          ease: 'power2.inOut',
          onUpdate: () => setOverlayOpacity(overlayProxy.val),
        },
        8.05
      );
    },
    [cleanupAll, setIntroComplete, settings.reducedMotion]
  );

  // Automatic playback on mount (or autoplay gate if browser blocks AudioContext)
  useEffect(() => {
    if (settings.reducedMotion) return;

    const soundEnabled = useAppStore.getState().settings.startupSoundEnabled;
    if (!soundEnabled) {
      runSequence(false);
    } else {
      const AudioCtx =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext?: typeof AudioContext })
          .webkitAudioContext;
      if (!AudioCtx) {
        runSequence(false);
      } else {
        const probe = new AudioCtx();
        if (probe.state === 'running') {
          probe.close().catch(() => {});
          runSequence(true);
        } else {
          probe.close().catch(() => {});
          setAwaitingGate(true);
        }
      }
    }

    return () => {
      cleanupAll();
      startedRef.current = false;
    };
  }, [cleanupAll, runSequence, settings.reducedMotion]);

  if (settings.reducedMotion) {
    return null;
  }

  return (
    <div
      className="fixed inset-0 z-50 bg-aegis-obsidian select-none"
      style={{ opacity: overlayOpacity }}
      aria-label="A.E.G.I.S. Holographic Initialization"
    >
      {/* Pure Holographic Line & Particle Stage */}
      {!webglFailed ? (
        <IntroWebGLErrorBoundary onError={() => setWebglFailed(true)}>
          <HolographicSuit3D
            directorRef={directorRef}
            isMobile={isMobile}
            onWebGLError={() => setWebglFailed(true)}
          />
        </IntroWebGLErrorBoundary>
      ) : (
        <div className="flex h-full w-full items-center justify-center bg-aegis-obsidian">
          <div className="h-24 w-24 rounded-full border border-aegis-cyan/40 bg-aegis-cyan/10 animate-pulse" />
        </div>
      )}

      {/* Minimal Technical Corner Label */}
      {!awaitingGate && (
        <div className="pointer-events-none fixed bottom-6 left-6 z-30 font-mono text-[10px] uppercase tracking-[0.25em] text-aegis-cyan/70">
          INITIALIZING A.E.G.I.S. CORE
        </div>
      )}

      {/* Autoplay-Respecting Sound Gate */}
      {awaitingGate && (
        <div className="fixed inset-0 z-30 flex flex-col items-center justify-center bg-aegis-obsidian/95 px-6 text-center backdrop-blur-sm">
          <div className="mb-2 h-2 w-2 rounded-full bg-aegis-cyan animate-pulse" />
          <h2 className="font-heading text-xl font-semibold tracking-[0.3em] text-aegis-text sm:text-2xl">
            A.E.G.I.S.
          </h2>
          <p className="mt-1 font-mono text-[11px] uppercase tracking-[0.22em] text-aegis-text-secondary">
            Holographic Core Initialization
          </p>
          <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
            <button
              type="button"
              onClick={() => {
                updateSettings({ startupSoundEnabled: true });
                runSequence(true);
              }}
              className="inline-flex items-center gap-2 rounded-lg border border-aegis-cyan/50 bg-aegis-cyan/15 px-5 py-2.5 font-mono text-xs uppercase tracking-widest text-aegis-cyan transition-colors hover:bg-aegis-cyan/25"
            >
              <Volume2 className="h-4 w-4" />
              <span>Launch with Sound</span>
            </button>
            <button
              type="button"
              onClick={() => {
                updateSettings({ startupSoundEnabled: false });
                runSequence(false);
              }}
              className="inline-flex items-center gap-2 rounded-lg bg-aegis-graphite px-5 py-2.5 font-mono text-xs uppercase tracking-widest text-aegis-text-secondary aegis-border transition-colors hover:bg-aegis-titanium hover:text-aegis-text"
            >
              <VolumeX className="h-4 w-4" />
              <span>Continue Silently</span>
            </button>
          </div>
        </div>
      )}

      {/* Top-Right Controls: Mute/Unmute + Skip Intro */}
      <div className="fixed top-5 right-5 z-40 flex items-center gap-2">
        {!awaitingGate && (
          <button
            type="button"
            onClick={handleToggleMute}
            aria-label={
              settings.startupSoundEnabled ? 'Mute intro music' : 'Unmute intro music'
            }
            title={settings.startupSoundEnabled ? 'Mute' : 'Unmute'}
            className="inline-flex h-8 w-8 items-center justify-center rounded-lg bg-aegis-obsidian/80 text-aegis-text-secondary aegis-border backdrop-blur-sm transition-colors hover:text-aegis-cyan"
          >
            {settings.startupSoundEnabled ? (
              <Volume2 className="h-4 w-4" />
            ) : (
              <VolumeX className="h-4 w-4" />
            )}
          </button>
        )}

        <button
          type="button"
          onClick={handleSkip}
          className="rounded-lg bg-aegis-obsidian/80 px-3 py-1.5 font-mono text-[11px] uppercase tracking-widest text-aegis-text-secondary aegis-border backdrop-blur-sm transition-colors hover:border-aegis-cyan/40 hover:text-aegis-cyan"
        >
          Skip Intro →
        </button>
      </div>
    </div>
  );
}

export default CinematicIntro;
