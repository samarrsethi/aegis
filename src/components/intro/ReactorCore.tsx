'use client';

import React, { useEffect, useRef } from 'react';
import gsap from 'gsap';

export type ReactorPhase = 'dormant' | 'activating' | 'active' | 'dissolving';

export interface ReactorCoreProps {
  phase: ReactorPhase;
  scale?: number;
  size?: number;
  quality?: 'low' | 'medium' | 'high';
  className?: string;
}

interface Particle {
  angle: number;
  radius: number;
  speed: number;
  angularSpeed: number;
  size: number;
  alpha: number;
  vx: number;
  vy: number;
  x: number;
  y: number;
  scattered: boolean;
}

interface ReactorAnimState {
  intensity: number;
  ringSpeedMultiplier: number;
  corePulse: number;
  overallAlpha: number;
  ringExpansion: number;
  scatterFactor: number;
  rotOuter: number;
  rotMid: number;
  rotInner: number;
}

const PARTICLE_COUNTS: Record<'low' | 'medium' | 'high', number> = {
  low: 24,
  medium: 44,
  high: 64,
};

function createParticle(maxRadius: number, randomizeRadius: boolean): Particle {
  const angle = Math.random() * Math.PI * 2;
  const minR = maxRadius * 0.14;
  const outerR = maxRadius * 0.96;
  const radius = randomizeRadius
    ? minR + Math.random() * (outerR - minR)
    : maxRadius * (0.82 + Math.random() * 0.22);

  return {
    angle,
    radius,
    speed: 26 + Math.random() * 44,
    angularSpeed: (0.45 + Math.random() * 0.9) * (Math.random() > 0.5 ? 1 : -1),
    size: 0.9 + Math.random() * 1.6,
    alpha: 0.35 + Math.random() * 0.65,
    vx: 0,
    vy: 0,
    x: Math.cos(angle) * radius,
    y: Math.sin(angle) * radius,
    scattered: false,
  };
}

export const ReactorCore: React.FC<ReactorCoreProps> = ({
  phase,
  scale = 1,
  size = 280,
  quality = 'high',
  className = '',
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const outerRingDomRef = useRef<HTMLDivElement>(null);
  const innerRingDomRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const phaseRef = useRef<ReactorPhase>(phase);
  const prevPhaseRef = useRef<ReactorPhase>(phase);

  const animStateRef = useRef<ReactorAnimState>({
    intensity: phase === 'active' ? 1 : phase === 'activating' ? 0.65 : phase === 'dormant' ? 0.16 : 0,
    ringSpeedMultiplier: phase === 'active' ? 1.15 : phase === 'activating' ? 0.85 : 0.15,
    corePulse: 0,
    overallAlpha: phase === 'dormant' ? 0.22 : phase === 'dissolving' ? 0 : 1,
    ringExpansion: 1,
    scatterFactor: phase === 'dissolving' ? 1 : 0,
    rotOuter: 0,
    rotMid: 0,
    rotInner: 0,
  });

  const particlesRef = useRef<Particle[]>([]);
  const qualityRef = useRef(quality);
  qualityRef.current = quality;

  const isFirstScaleRenderRef = useRef(true);

  // Set initial scale without flash on mount, and tween smoothly on updates
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    if (isFirstScaleRenderRef.current) {
      isFirstScaleRenderRef.current = false;
      gsap.set(el, { scale });
      return;
    }

    gsap.to(el, {
      scale,
      duration: 0.55,
      ease: 'power2.out',
      overwrite: 'auto',
    });
  }, [scale]);

  // Clean up GSAP tweens on unmount
  useEffect(() => {
    const el = containerRef.current;
    const outerRing = outerRingDomRef.current;
    const innerRing = innerRingDomRef.current;
    const state = animStateRef.current;

    return () => {
      if (el) gsap.killTweensOf(el);
      if (outerRing) gsap.killTweensOf(outerRing);
      if (innerRing) gsap.killTweensOf(innerRing);
      gsap.killTweensOf(state);
    };
  }, []);

  // GSAP-driven outer structural ring rotations & phase transitions
  useEffect(() => {
    const prev = prevPhaseRef.current;
    phaseRef.current = phase;
    prevPhaseRef.current = phase;

    const state = animStateRef.current;
    const maxRadius = size * 0.46;

    // Reset particle inward positions if re-activating from dormant/dissolving
    if ((prev === 'dissolving' || prev === 'dormant') && (phase === 'activating' || phase === 'active')) {
      const count = PARTICLE_COUNTS[qualityRef.current];
      particlesRef.current = Array.from({ length: count }, () =>
        createParticle(maxRadius, true)
      );
    }

    // Kill prior tweens without reverting DOM rotation angles so phase shifts stay seamless
    gsap.killTweensOf(state);
    if (outerRingDomRef.current) gsap.killTweensOf(outerRingDomRef.current);
    if (innerRingDomRef.current) gsap.killTweensOf(innerRingDomRef.current);

    if (phase === 'dormant') {
      gsap.to(state, {
        intensity: 0.16,
        ringSpeedMultiplier: 0.12,
        overallAlpha: 0.24,
        ringExpansion: 0.96,
        scatterFactor: 0,
        duration: 0.7,
        ease: 'power2.out',
      });

      if (outerRingDomRef.current && innerRingDomRef.current) {
        gsap.to(outerRingDomRef.current, {
          rotation: '+=360',
          duration: 36,
          repeat: -1,
          ease: 'none',
        });
        gsap.to(innerRingDomRef.current, {
          rotation: '-=360',
          duration: 28,
          repeat: -1,
          ease: 'none',
        });
      }
    } else if (phase === 'activating') {
      gsap.to(state, {
        intensity: 0.78,
        ringSpeedMultiplier: 0.95,
        overallAlpha: 0.92,
        ringExpansion: 1,
        scatterFactor: 0,
        duration: 0.75,
        ease: 'power2.inOut',
      });

      if (outerRingDomRef.current && innerRingDomRef.current) {
        gsap.to(outerRingDomRef.current, {
          rotation: '+=360',
          duration: 12,
          repeat: -1,
          ease: 'none',
        });
        gsap.to(innerRingDomRef.current, {
          rotation: '-=360',
          duration: 8.5,
          repeat: -1,
          ease: 'none',
        });
      }
    } else if (phase === 'active') {
      gsap.to(state, {
        intensity: 1,
        ringSpeedMultiplier: 1.2,
        overallAlpha: 1,
        ringExpansion: 1,
        scatterFactor: 0,
        duration: 0.5,
        ease: 'power2.out',
      });

      if (outerRingDomRef.current && innerRingDomRef.current) {
        gsap.to(outerRingDomRef.current, {
          rotation: '+=360',
          duration: 9,
          repeat: -1,
          ease: 'none',
        });
        gsap.to(innerRingDomRef.current, {
          rotation: '-=360',
          duration: 6.5,
          repeat: -1,
          ease: 'none',
        });
      }
    } else if (phase === 'dissolving') {
      // Trigger outward particle scatter velocities from current polar coordinates
      for (const p of particlesRef.current) {
        const outSpeed = 95 + Math.random() * 145;
        const jitter = (Math.random() - 0.5) * 0.45;
        const dir = p.angle + jitter;
        p.x = Math.cos(p.angle) * p.radius;
        p.y = Math.sin(p.angle) * p.radius;
        p.vx = Math.cos(dir) * outSpeed;
        p.vy = Math.sin(dir) * outSpeed;
        p.scattered = true;
      }

      gsap.to(state, {
        intensity: 0.1,
        ringSpeedMultiplier: 0.35,
        overallAlpha: 0,
        ringExpansion: 1.18,
        scatterFactor: 1,
        duration: 0.85,
        ease: 'power2.out',
      });
    }
  }, [phase, size]);

  // Main Canvas 2D rendering loop
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx2d = canvas.getContext('2d');
    if (!ctx2d) return;

    const dpr = Math.min(window.devicePixelRatio || 1, quality === 'low' ? 1 : 2);
    canvas.width = size * dpr;
    canvas.height = size * dpr;

    const maxRadius = size * 0.46;
    const targetCount = PARTICLE_COUNTS[quality];
    if (particlesRef.current.length !== targetCount) {
      particlesRef.current = Array.from({ length: targetCount }, () =>
        createParticle(maxRadius, true)
      );
    }

    let rafId = 0;
    let lastTime = performance.now();
    let elapsed = 0;

    const renderFrame = (now: number) => {
      const dt = Math.min((now - lastTime) / 1000, 0.05);
      lastTime = now;
      elapsed += dt;

      const state = animStateRef.current;
      const currentPhase = phaseRef.current;

      // Advance ring rotation angles smoothly based on GSAP-tweened speed multiplier
      state.rotOuter += dt * 0.55 * state.ringSpeedMultiplier;
      state.rotMid -= dt * 0.85 * state.ringSpeedMultiplier;
      state.rotInner += dt * 1.25 * state.ringSpeedMultiplier;

      ctx2d.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx2d.clearRect(0, 0, size, size);

      const cx = size / 2;
      const cy = size / 2;
      const pulse = 0.5 + 0.5 * Math.sin(elapsed * 3.2);
      const intensity = state.intensity;
      const alpha = state.overallAlpha;
      const expansion = state.ringExpansion;

      if (alpha > 0.004) {
        ctx2d.save();
        ctx2d.translate(cx, cy);
        ctx2d.globalAlpha = alpha;

        // 1. Ambient Core Aura (subtle cyan gradient)
        const auraRadius = size * 0.44 * expansion;
        const aura = ctx2d.createRadialGradient(0, 0, size * 0.03, 0, 0, auraRadius);
        aura.addColorStop(0, `rgba(168, 234, 240, ${0.22 * intensity})`);
        aura.addColorStop(0.38, `rgba(83, 217, 232, ${0.14 * intensity})`);
        aura.addColorStop(0.72, `rgba(83, 217, 232, ${0.04 * intensity})`);
        aura.addColorStop(1, 'rgba(5, 7, 9, 0)');
        ctx2d.fillStyle = aura;
        ctx2d.beginPath();
        ctx2d.arc(0, 0, auraRadius, 0, Math.PI * 2);
        ctx2d.fill();

        // 2. Radial Energy Lines
        const spokeCount = quality === 'low' ? 12 : 16;
        const innerSpokeR = size * 0.145 * expansion;
        const outerSpokeR = size * 0.415 * expansion;
        for (let i = 0; i < spokeCount; i++) {
          const angle = (i / spokeCount) * Math.PI * 2 + state.rotOuter * 0.25;
          const wave = 0.4 + 0.6 * Math.sin(elapsed * 4.2 - i * 0.7);
          const isMajor = i % 2 === 0;
          const lineAlpha = (isMajor ? 0.26 : 0.12) * intensity * wave;

          ctx2d.strokeStyle = isMajor
            ? `rgba(168, 234, 240, ${lineAlpha})`
            : `rgba(83, 217, 232, ${lineAlpha})`;
          ctx2d.lineWidth = isMajor ? 1.15 : 0.75;
          ctx2d.beginPath();
          ctx2d.moveTo(Math.cos(angle) * innerSpokeR, Math.sin(angle) * innerSpokeR);
          ctx2d.lineTo(Math.cos(angle) * outerSpokeR, Math.sin(angle) * outerSpokeR);
          ctx2d.stroke();
        }

        // 3. Outer Containment Ring + Segmented Arcs
        const rOuter = size * 0.42 * expansion;
        ctx2d.save();
        ctx2d.rotate(state.rotOuter);

        ctx2d.strokeStyle = `rgba(83, 217, 232, ${0.22 * intensity + 0.06})`;
        ctx2d.lineWidth = 1;
        ctx2d.beginPath();
        ctx2d.arc(0, 0, rOuter, 0, Math.PI * 2);
        ctx2d.stroke();

        // 4 heavy segmented arc plates
        ctx2d.strokeStyle = `rgba(83, 217, 232, ${0.55 * intensity + 0.08})`;
        ctx2d.lineWidth = 2.4;
        for (let q = 0; q < 4; q++) {
          const start = q * (Math.PI / 2) + 0.14;
          const end = start + Math.PI / 2 - 0.42;
          ctx2d.beginPath();
          ctx2d.arc(0, 0, rOuter, start, end);
          ctx2d.stroke();
        }
        ctx2d.restore();

        // 4. Calibration Ring with Precision Marks
        const rCal = size * 0.345 * expansion;
        ctx2d.save();
        ctx2d.rotate(state.rotMid);

        ctx2d.strokeStyle = `rgba(83, 217, 232, ${0.25 * intensity + 0.05})`;
        ctx2d.lineWidth = 0.9;
        ctx2d.beginPath();
        ctx2d.arc(0, 0, rCal, 0, Math.PI * 2);
        ctx2d.stroke();

        const ticks = quality === 'low' ? 36 : 72;
        for (let t = 0; t < ticks; t++) {
          const a = (t / ticks) * Math.PI * 2;
          const major = t % 6 === 0;
          const medium = t % 3 === 0;
          const len = major ? size * 0.032 : medium ? size * 0.02 : size * 0.011;
          ctx2d.strokeStyle = major
            ? `rgba(168, 234, 240, ${0.68 * intensity + 0.08})`
            : `rgba(83, 217, 232, ${0.34 * intensity + 0.04})`;
          ctx2d.lineWidth = major ? 1.4 : 0.85;
          ctx2d.beginPath();
          ctx2d.moveTo(Math.cos(a) * (rCal - len * 0.5), Math.sin(a) * (rCal - len * 0.5));
          ctx2d.lineTo(Math.cos(a) * (rCal + len * 0.5), Math.sin(a) * (rCal + len * 0.5));
          ctx2d.stroke();
        }
        ctx2d.restore();

        // 5. Inner Harmonic Ring (dashed conduits + nodes)
        const rInner = size * 0.25 * expansion;
        ctx2d.save();
        ctx2d.rotate(state.rotInner);

        ctx2d.setLineDash([12, 7, 4, 7]);
        ctx2d.strokeStyle = `rgba(168, 234, 240, ${0.52 * intensity + 0.08})`;
        ctx2d.lineWidth = 1.6;
        ctx2d.beginPath();
        ctx2d.arc(0, 0, rInner, 0, Math.PI * 2);
        ctx2d.stroke();
        ctx2d.setLineDash([]);

        // 6 inner calibration nodes
        for (let n = 0; n < 6; n++) {
          const na = (n / 6) * Math.PI * 2;
          const nx = Math.cos(na) * rInner;
          const ny = Math.sin(na) * rInner;
          ctx2d.fillStyle = `rgba(168, 234, 240, ${0.8 * intensity})`;
          ctx2d.beginPath();
          ctx2d.arc(nx, ny, 2.1, 0, Math.PI * 2);
          ctx2d.fill();
        }
        ctx2d.restore();

        // 6. Core Aperture Ring
        const rAperture = size * 0.15 * expansion;
        ctx2d.save();
        ctx2d.rotate(-state.rotInner * 1.15);
        ctx2d.strokeStyle = `rgba(83, 217, 232, ${0.72 * intensity + 0.1})`;
        ctx2d.lineWidth = 1.8;
        ctx2d.beginPath();
        ctx2d.arc(0, 0, rAperture, 0, Math.PI * 2);
        ctx2d.stroke();

        // Aperture notches
        for (let k = 0; k < 8; k++) {
          const ka = (k / 8) * Math.PI * 2;
          ctx2d.strokeStyle = `rgba(237, 245, 247, ${0.5 * intensity})`;
          ctx2d.lineWidth = 1.1;
          ctx2d.beginPath();
          ctx2d.moveTo(Math.cos(ka) * (rAperture - 4), Math.sin(ka) * (rAperture - 4));
          ctx2d.lineTo(Math.cos(ka) * (rAperture + 4), Math.sin(ka) * (rAperture + 4));
          ctx2d.stroke();
        }
        ctx2d.restore();

        // 7. Central Glowing Circle
        const coreR = size * (0.095 + 0.008 * pulse * intensity);
        const coreGrad = ctx2d.createRadialGradient(0, 0, 0, 0, 0, coreR * 1.65);
        coreGrad.addColorStop(0, `rgba(237, 245, 247, ${0.95 * intensity})`);
        coreGrad.addColorStop(0.32, `rgba(168, 234, 240, ${0.82 * intensity})`);
        coreGrad.addColorStop(0.62, `rgba(83, 217, 232, ${0.42 * intensity})`);
        coreGrad.addColorStop(1, 'rgba(83, 217, 232, 0)');

        ctx2d.fillStyle = coreGrad;
        ctx2d.beginPath();
        ctx2d.arc(0, 0, coreR * 1.65, 0, Math.PI * 2);
        ctx2d.fill();

        // Crisp central energy sphere outline
        ctx2d.strokeStyle = `rgba(237, 245, 247, ${0.65 * intensity})`;
        ctx2d.lineWidth = 1.1;
        ctx2d.beginPath();
        ctx2d.arc(0, 0, size * 0.068, 0, Math.PI * 2);
        ctx2d.stroke();

        ctx2d.restore();
      }

      // 8. Particle Convergence / Dissolve Scatter Layer
      ctx2d.save();
      ctx2d.translate(cx, cy);

      const particles = particlesRef.current;
      for (let i = 0; i < particles.length; i++) {
        const p = particles[i];

        if (currentPhase === 'dissolving') {
          p.x += p.vx * dt;
          p.y += p.vy * dt;
          p.vx *= 0.985;
          p.vy *= 0.985;
          const pAlpha = p.alpha * Math.max(0, 1 - state.scatterFactor * 0.95);
          if (pAlpha > 0.01) {
            ctx2d.fillStyle = `rgba(168, 234, 240, ${pAlpha})`;
            ctx2d.beginPath();
            ctx2d.arc(p.x, p.y, p.size, 0, Math.PI * 2);
            ctx2d.fill();
          }
          continue;
        }

        // In dormant/activating/active: spiral inward toward core center
        const pullFactor =
          currentPhase === 'dormant' ? 0.08 : currentPhase === 'activating' ? 0.72 : 1.05;

        const proximityBoost = 1 + (1 - Math.min(1, p.radius / maxRadius)) * 1.15;
        p.radius -= p.speed * pullFactor * proximityBoost * dt;
        p.angle += p.angularSpeed * (0.2 + intensity * 0.85) * dt;

        if (p.radius <= size * 0.045) {
          // Respawn at outer perimeter
          const fresh = createParticle(maxRadius, false);
          p.angle = fresh.angle;
          p.radius = fresh.radius;
          p.speed = fresh.speed;
          p.size = fresh.size;
          p.alpha = fresh.alpha;
          p.scattered = false;
        }

        const px = Math.cos(p.angle) * p.radius;
        const py = Math.sin(p.angle) * p.radius;
        p.x = px;
        p.y = py;

        // Smoothly fade in near edge and fade into core center
        const edgeFade = Math.min(1, (maxRadius - p.radius) / (maxRadius * 0.18) + 0.25);
        const coreFade = Math.min(1, p.radius / (size * 0.12));
        const pAlpha =
          p.alpha * edgeFade * coreFade * Math.max(0.12, intensity) * Math.max(0.25, alpha);

        if (pAlpha > 0.01) {
          ctx2d.fillStyle =
            p.radius < size * 0.2
              ? `rgba(237, 245, 247, ${pAlpha})`
              : `rgba(83, 217, 232, ${pAlpha})`;
          ctx2d.beginPath();
          ctx2d.arc(px, py, p.size, 0, Math.PI * 2);
          ctx2d.fill();
        }
      }

      ctx2d.restore();
      rafId = requestAnimationFrame(renderFrame);
    };

    rafId = requestAnimationFrame(renderFrame);
    return () => {
      cancelAnimationFrame(rafId);
    };
  }, [size, quality]);

  return (
    <div
      ref={containerRef}
      style={{ width: size, height: size }}
      className={`relative flex items-center justify-center select-none pointer-events-none ${className}`}
      aria-hidden="true"
    >
      {/* GSAP-rotated outer precision ring accent */}
      <div
        ref={outerRingDomRef}
        className="absolute inset-0 rounded-full border border-dashed border-aegis-cyan/20 transition-opacity duration-500"
        style={{
          opacity: phase === 'dormant' ? 0.15 : phase === 'dissolving' ? 0 : 0.65,
        }}
      />

      {/* GSAP-rotated inner containment bezel */}
      <div
        ref={innerRingDomRef}
        className="absolute inset-[14%] rounded-full border border-aegis-ice/15 transition-opacity duration-500"
        style={{
          opacity: phase === 'dormant' ? 0.1 : phase === 'dissolving' ? 0 : 0.55,
        }}
      />

      {/* 2D Canvas Reactor Visualization */}
      <canvas
        ref={canvasRef}
        style={{ width: size, height: size }}
        className="block relative z-10"
      />
    </div>
  );
};

export default ReactorCore;
