'use client';

import React, { Component, useCallback, useEffect, useRef, useState } from 'react';
import gsap from 'gsap';
import { Volume2, VolumeX } from 'lucide-react';
import { useAppStore } from '@/lib/store';
import { CinematicMusicEngine } from '@/lib/audio/CinematicMusicEngine';
import {
  PlanetaryAwakeningScene,
  createInitialPlanetState,
  type PlanetDirectorState,
} from './PlanetaryAwakeningScene';

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
  const [flashOpacity, setFlashOpacity] = useState(0);
  const [overlayOpacity, setOverlayOpacity] = useState(1);

  const directorRef = useRef<PlanetDirectorState>(createInitialPlanetState());
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
      const flashProxy = { val: 0 };
      const overlayProxy = { val: 1 };

      const tl = gsap.timeline({
        onUpdate: () => {
          // Synchronize music curve so climax hits at Scene 3 explosion (~5.0-7.0s)
          // and resolves softly at Scene 5 (~9.0-11.0s)
          const p = tl.progress();
          const musicPos = p < 0.45 ? p * 1.45 : p < 0.65 ? 0.65 + (p - 0.45) * 0.6 : 0.77 + (p - 0.65) * 0.65;
          music.setProgress(Math.min(1, musicPos));
        },
        onComplete: () => {
          cleanupAll();
          setIntroComplete();
        },
      });
      timelineRef.current = tl;

      // ─── SCENE 1: PLANET APPEARS (0.0s – 3.0s) ───
      tl.to(
        d,
        {
          planetOpacity: 1,
          cameraZ: 6.1,
          duration: 3.0,
          ease: 'power2.out',
        },
        0
      );

      // ─── SCENE 2: PLANETARY ENERGY (3.0s – 5.0s) ───
      tl.to(
        d,
        {
          rotationSpeed: 0.04,
          fractureProgress: 1,
          energyPulse: 2.0,
          cameraZ: 5.4,
          duration: 2.0,
          ease: 'power2.inOut',
        },
        3.0
      );

      // ─── SCENE 3: PLANET EXPLOSION (5.0s – 7.0s) ───
      tl.to(
        d,
        {
          explodeProgress: 1,
          shockwaveProgress: 1,
          cameraShake: 1,
          duration: 1.85,
          ease: 'power3.out',
        },
        5.0
      );
      tl.to(
        flashProxy,
        {
          val: 0.72,
          duration: 0.25,
          ease: 'power2.in',
          onUpdate: () => setFlashOpacity(flashProxy.val),
        },
        5.05
      );
      tl.to(
        flashProxy,
        {
          val: 0,
          duration: 0.75,
          ease: 'power2.out',
          onUpdate: () => setFlashOpacity(flashProxy.val),
        },
        5.35
      );

      // ─── SCENE 4: PARTICLE RECONSTRUCTION (7.0s – 9.0s) ───
      tl.to(
        d,
        {
          cameraShake: 0,
          reconstructProgress: 1,
          orbCoreOpacity: 1,
          cameraZ: 5.2,
          cameraY: 0,
          duration: 2.0,
          ease: 'power2.inOut',
        },
        7.0
      );

      // ─── SCENE 5: CHATBOT REVEAL (9.0s – 11.0s) ───
      tl.to(
        overlayProxy,
        {
          val: 0,
          duration: 1.6,
          ease: 'power2.inOut',
          onUpdate: () => setOverlayOpacity(overlayProxy.val),
        },
        9.4
      );
    },
    [cleanupAll, setIntroComplete, settings.reducedMotion]
  );

  // Automatic playback (or autoplay gate if browser blocks AudioContext)
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
      aria-label="A.E.G.I.S. Planetary Awakening"
    >
      {/* 3D Planetary Awakening Stage (with WebGL fallback) */}
      {!webglFailed ? (
        <IntroWebGLErrorBoundary onError={() => setWebglFailed(true)}>
          <PlanetaryAwakeningScene
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

      {/* Controlled Cyan Flash on Planet Explosion */}
      {flashOpacity > 0.005 && (
        <div
          className="pointer-events-none fixed inset-0 z-20"
          style={{
            opacity: flashOpacity,
            background:
              'radial-gradient(circle at center, #EDF5F7 0%, #53D9E8 42%, #050709 100%)',
          }}
        />
      )}

      {/* Autoplay-Respecting Music Gate */}
      {awaitingGate && (
        <div className="fixed inset-0 z-30 flex flex-col items-center justify-center bg-aegis-obsidian/95 px-6 text-center backdrop-blur-sm">
          <div className="mb-2 h-2 w-2 rounded-full bg-aegis-cyan animate-pulse" />
          <h2 className="font-heading text-xl font-semibold tracking-[0.3em] text-aegis-text sm:text-2xl">
            A.E.G.I.S.
          </h2>
          <p className="mt-1 font-mono text-[11px] uppercase tracking-[0.22em] text-aegis-text-secondary">
            Adaptive Engine for General Intelligence Systems
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
              <span>Enter with Music</span>
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
