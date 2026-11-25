'use client';

import React, {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useRef,
  useState,
} from 'react';
import gsap from 'gsap';
import { motion } from 'framer-motion';
import { Menu, Mic, Send, Settings } from 'lucide-react';
import { ReactorCore } from './ReactorCore';

export interface IntroTransitionProps {
  onTransitionComplete: () => void;
  orbComponent?: React.ReactNode;
  reducedMotion?: boolean;
  className?: string;
}

export interface IntroTransitionHandle {
  start: () => void;
  reset: () => void;
  kill: () => void;
}

function DefaultAIOrbVisual() {
  return (
    <div
      className="relative w-28 h-28 flex items-center justify-center select-none pointer-events-none"
      aria-hidden="true"
    >
      {/* Subtle outer halo (max 0.15 alpha) */}
      <div
        className="absolute inset-0 rounded-full animate-pulse-slow"
        style={{
          background:
            'radial-gradient(circle, rgba(83, 217, 232, 0.15) 0%, rgba(83, 217, 232, 0.04) 58%, transparent 75%)',
          boxShadow: '0 0 24px rgba(83, 217, 232, 0.15)',
        }}
      />

      {/* Outer orbital ring */}
      <div className="absolute inset-1 rounded-full border border-aegis-cyan/30 animate-spin-slow" />

      {/* Counter-rotating inner calibration ring */}
      <div className="absolute inset-3.5 rounded-full border border-dashed border-aegis-ice/35 animate-spin-reverse" />

      {/* Core sphere */}
      <div
        className="relative w-14 h-14 rounded-full border border-aegis-ice/50 flex items-center justify-center"
        style={{
          background:
            'radial-gradient(circle at 38% 35%, rgba(237, 245, 247, 0.9) 0%, rgba(168, 234, 240, 0.65) 32%, rgba(83, 217, 232, 0.32) 66%, rgba(17, 24, 32, 0.95) 100%)',
          boxShadow: '0 0 20px rgba(83, 217, 232, 0.15)',
        }}
      >
        <div className="w-5 h-5 rounded-full bg-aegis-text/80 blur-[2px]" />
      </div>
    </div>
  );
}

export const IntroTransition = forwardRef<IntroTransitionHandle, IntroTransitionProps>(
  function IntroTransition(
    { onTransitionComplete, orbComponent, reducedMotion = false, className = '' },
    ref
  ) {
    const rootRef = useRef<HTMLDivElement>(null);
    const reactorMorphRef = useRef<HTMLDivElement>(null);
    const orbTargetRef = useRef<HTMLDivElement>(null);
    const uiShellRef = useRef<HTMLDivElement>(null);

    const tlRef = useRef<gsap.core.Timeline | null>(null);
    const onCompleteRef = useRef(onTransitionComplete);
    onCompleteRef.current = onTransitionComplete;

    const [active, setActive] = useState(false);
    const [uiRevealed, setUiRevealed] = useState(false);

    const kill = useCallback(() => {
      tlRef.current?.kill();
      tlRef.current = null;
    }, []);

    const reset = useCallback(() => {
      kill();
      setActive(false);
      setUiRevealed(false);

      if (rootRef.current) {
        gsap.set(rootRef.current, { opacity: 0 });
      }
      if (reactorMorphRef.current) {
        gsap.set(reactorMorphRef.current, { x: 0, y: 0, scale: 1, opacity: 1 });
      }
      if (orbTargetRef.current) {
        gsap.set(orbTargetRef.current, { x: 0, y: -44, scale: 0.8, opacity: 0 });
      }
      if (uiShellRef.current) {
        gsap.set(uiShellRef.current, { opacity: 0 });
      }
    }, [kill]);

    const start = useCallback(() => {
      kill();
      setActive(true);

      const finalOrbY = -44;

      if (reducedMotion) {
        setUiRevealed(true);

        if (reactorMorphRef.current) {
          gsap.set(reactorMorphRef.current, { opacity: 0 });
        }
        if (orbTargetRef.current) {
          gsap.set(orbTargetRef.current, { x: 0, y: finalOrbY, scale: 1, opacity: 1 });
        }

        const tl = gsap.timeline({
          onComplete: () => {
            onCompleteRef.current();
          },
        });

        if (rootRef.current) {
          tl.fromTo(
            rootRef.current,
            { opacity: 0 },
            { opacity: 1, duration: 0.25, ease: 'power1.out' },
            0
          );
        }
        if (uiShellRef.current) {
          tl.fromTo(
            uiShellRef.current,
            { opacity: 0 },
            { opacity: 1, duration: 0.28, ease: 'power1.out' },
            0.05
          );
        }
        if (rootRef.current) {
          tl.to(
            rootRef.current,
            { opacity: 0, duration: 0.25, ease: 'power1.inOut' },
            0.42
          );
        }

        tlRef.current = tl;
        return;
      }

      // Reset initial transform positions prior to morphing
      if (reactorMorphRef.current) {
        gsap.set(reactorMorphRef.current, { x: 0, y: 0, scale: 1, opacity: 1 });
      }
      if (orbTargetRef.current) {
        gsap.set(orbTargetRef.current, { x: 0, y: finalOrbY, scale: 0.82, opacity: 0 });
      }
      if (uiShellRef.current) {
        gsap.set(uiShellRef.current, { opacity: 0 });
      }

      const tl = gsap.timeline({
        onComplete: () => {
          onCompleteRef.current();
        },
      });

      // Reveal transition stage cleanly
      if (rootRef.current) {
        tl.fromTo(
          rootRef.current,
          { opacity: 0 },
          { opacity: 1, duration: 0.14, ease: 'power2.out' },
          0
        );
      }

      // 1 & 2. Condense reactor core, scale down, and move to final center AI Orb position
      if (reactorMorphRef.current) {
        tl.fromTo(
          reactorMorphRef.current,
          { opacity: 0.25, scale: 1.06, x: 0, y: 0 },
          {
            opacity: 1,
            scale: 1,
            duration: 0.14,
            ease: 'power2.out',
          },
          0
        ).to(
          reactorMorphRef.current,
          {
            scale: 0.52,
            y: finalOrbY,
            duration: 0.45,
            ease: 'power3.inOut',
          },
          0.15
        );
      }

      // 3. Fade in surrounding chat interface elements
      tl.call(
        () => {
          setUiRevealed(true);
        },
        [],
        0.24
      );

      if (uiShellRef.current) {
        tl.to(
          uiShellRef.current,
          {
            opacity: 1,
            duration: 0.42,
            ease: 'power2.out',
          },
          0.24
        );
      }

      // 4. Cross-fade the scaled-down reactor core to the AIOrb component
      if (reactorMorphRef.current) {
        tl.to(
          reactorMorphRef.current,
          {
            opacity: 0,
            scale: 0.42,
            duration: 0.34,
            ease: 'power2.inOut',
          },
          0.46
        );
      }

      if (orbTargetRef.current) {
        tl.to(
          orbTargetRef.current,
          {
            opacity: 1,
            scale: 1,
            duration: 0.42,
            ease: 'power2.out',
          },
          0.42
        );
      }

      // Hold momentarily and dissolve overlay smoothly into the live chat interface
      if (rootRef.current) {
        tl.to(
          rootRef.current,
          {
            opacity: 0,
            duration: 0.2,
            ease: 'power2.inOut',
          },
          0.88
        );
      }

      tlRef.current = tl;
    }, [kill, reducedMotion]);

    useEffect(() => {
      return () => {
        kill();
      };
    }, [kill]);

    useImperativeHandle(
      ref,
      () => ({
        start,
        reset,
        kill,
      }),
      [start, reset, kill]
    );

    const motionYOffset = reducedMotion ? 0 : 18;
    const motionDuration = reducedMotion ? 0.25 : 0.45;

    return (
      <div
        ref={rootRef}
        className={`fixed inset-0 z-40 pointer-events-none select-none overflow-hidden bg-aegis-obsidian/90 ${
          active ? 'opacity-100' : 'opacity-0'
        } ${className}`}
        aria-hidden={!active}
      >
        {/* Ambient grid layer emerging during UI reveal */}
        <div
          ref={uiShellRef}
          className="absolute inset-0 flex flex-col justify-between aegis-grid-bg opacity-0"
        >
          {/* Top Chat Header Bar Preview */}
          <motion.div
            initial={{ opacity: 0, y: -motionYOffset }}
            animate={uiRevealed ? { opacity: 1, y: 0 } : { opacity: 0, y: -motionYOffset }}
            transition={{ duration: motionDuration, ease: [0.22, 1, 0.36, 1] }}
            className="w-full h-14 px-4 sm:px-6 flex items-center justify-between border-b border-aegis-cyan/10 bg-aegis-obsidian/60 backdrop-blur-sm"
          >
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg bg-aegis-graphite/80 aegis-border flex items-center justify-center text-aegis-text-secondary">
                <Menu className="w-4 h-4" />
              </div>
              <div className="flex items-center gap-2">
                <span className="font-heading text-sm font-semibold tracking-[0.18em] text-aegis-text">
                  A.E.G.I.S.
                </span>
                <span className="inline-flex items-center gap-1.5 font-mono text-[10px] tracking-widest text-aegis-cyan/80 bg-aegis-graphite/80 px-2 py-0.5 rounded border border-aegis-cyan/15">
                  <span className="w-1.5 h-1.5 rounded-full bg-aegis-cyan" />
                  ONLINE
                </span>
              </div>
            </div>

            <div className="w-8 h-8 rounded-lg bg-aegis-graphite/80 aegis-border flex items-center justify-center text-aegis-text-secondary">
              <Settings className="w-4 h-4" />
            </div>
          </motion.div>

          {/* Center Welcome Copy Below Morphed Orb */}
          <motion.div
            initial={{ opacity: 0, y: motionYOffset }}
            animate={uiRevealed ? { opacity: 1, y: 0 } : { opacity: 0, y: motionYOffset }}
            transition={{
              duration: motionDuration,
              delay: reducedMotion ? 0 : 0.08,
              ease: [0.22, 1, 0.36, 1],
            }}
            className="flex flex-col items-center justify-center text-center px-6 mt-28"
          >
            <h2 className="font-heading text-xl sm:text-2xl font-medium tracking-[0.22em] text-aegis-text aegis-glow-text">
              A.E.G.I.S.
            </h2>
            <p className="mt-1.5 font-body text-xs sm:text-sm text-aegis-text-secondary tracking-wide">
              Adaptive Engine for General Intelligence Systems
            </p>
          </motion.div>

          {/* Bottom Chat Input Bar Reveal */}
          <motion.div
            initial={{ opacity: 0, y: motionYOffset }}
            animate={uiRevealed ? { opacity: 1, y: 0 } : { opacity: 0, y: motionYOffset }}
            transition={{
              duration: motionDuration,
              delay: reducedMotion ? 0 : 0.14,
              ease: [0.22, 1, 0.36, 1],
            }}
            className="w-full max-w-3xl mx-auto px-4 pb-6 sm:pb-8"
          >
            <div className="flex items-center justify-between gap-3 px-4 py-3 rounded-2xl bg-aegis-graphite/80 aegis-border aegis-glow">
              <span className="font-body text-sm text-aegis-text-secondary/70">
                Initialize query or voice command...
              </span>
              <div className="flex items-center gap-2 text-aegis-text-secondary">
                <span className="w-8 h-8 rounded-lg bg-aegis-titanium/60 flex items-center justify-center">
                  <Mic className="w-4 h-4 text-aegis-cyan/70" />
                </span>
                <span className="w-8 h-8 rounded-lg bg-aegis-cyan/15 border border-aegis-cyan/25 flex items-center justify-center">
                  <Send className="w-4 h-4 text-aegis-cyan" />
                </span>
              </div>
            </div>
          </motion.div>
        </div>

        {/* Center Morphing Stage: ReactorCore -> AIOrb */}
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
          {/* Morphing Reactor Core */}
          <div
            ref={reactorMorphRef}
            className="absolute flex items-center justify-center"
          >
            <ReactorCore phase="active" size={220} />
          </div>

          {/* Target AI Orb Component (Cross-Fade Destination) */}
          <div
            ref={orbTargetRef}
            className="absolute flex items-center justify-center opacity-0"
          >
            {orbComponent ?? <DefaultAIOrbVisual />}
          </div>
        </div>
      </div>
    );
  }
);

export default IntroTransition;
