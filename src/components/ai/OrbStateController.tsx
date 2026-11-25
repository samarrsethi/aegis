'use client';

import React, { createContext, useContext, useEffect, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { useAppStore } from '@/lib/store';
import type { OrbState } from '@/types';

export interface OrbAnimationParams {
  rotationSpeed: number;
  pulseIntensity: number;
  particleSpeed: number;
  glowIntensity: number;
  innerRingSpeed: number;
  color: string;
}

export interface OrbAnimationState extends OrbAnimationParams {
  threeColor: THREE.Color;
  orbState: OrbState;
}

export const ORB_LERP_FACTOR = 0.03;

export const ORB_STATE_PARAMS: Record<OrbState, OrbAnimationParams> = {
  idle: {
    rotationSpeed: 0.2,
    pulseIntensity: 0.3,
    particleSpeed: 0.5,
    glowIntensity: 0.4,
    innerRingSpeed: 0.1,
    color: '#53D9E8',
  },
  listening: {
    rotationSpeed: 0.5,
    pulseIntensity: 0.6,
    particleSpeed: 1.5,
    glowIntensity: 0.6,
    innerRingSpeed: 0.3,
    color: '#53D9E8',
  },
  thinking: {
    rotationSpeed: 1.2,
    pulseIntensity: 0.7,
    particleSpeed: 2.0,
    glowIntensity: 0.7,
    innerRingSpeed: 0.8,
    color: '#53D9E8',
  },
  speaking: {
    rotationSpeed: 0.6,
    pulseIntensity: 0.8,
    particleSpeed: 1.0,
    glowIntensity: 0.65,
    innerRingSpeed: 0.4,
    color: '#53D9E8',
  },
  error: {
    rotationSpeed: 0.1,
    pulseIntensity: 0.5,
    particleSpeed: 0.3,
    glowIntensity: 0.5,
    innerRingSpeed: 0.05,
    color: '#D6A45C',
  },
  offline: {
    rotationSpeed: 0.05,
    pulseIntensity: 0.15,
    particleSpeed: 0.1,
    glowIntensity: 0.2,
    innerRingSpeed: 0.02,
    color: '#8296A1',
  },
};

const OrbAnimationContext = createContext<OrbAnimationState | null>(null);

function useOrbAnimationLoop(active: boolean): OrbAnimationState {
  const orbState = useAppStore((state) => state.orbState);
  const initialParams = ORB_STATE_PARAMS[orbState] ?? ORB_STATE_PARAMS.idle;

  const targetRef = useRef<OrbAnimationParams>({ ...initialParams });
  const currentColorRef = useRef<THREE.Color>(new THREE.Color(initialParams.color));
  const targetColorRef = useRef<THREE.Color>(new THREE.Color(initialParams.color));

  const currentRef = useRef<OrbAnimationState>({
    ...initialParams,
    threeColor: currentColorRef.current,
    orbState,
  });

  useEffect(() => {
    const nextTarget = ORB_STATE_PARAMS[orbState] ?? ORB_STATE_PARAMS.idle;
    targetRef.current = nextTarget;
    targetColorRef.current.set(nextTarget.color);
    currentRef.current.orbState = orbState;
  }, [orbState]);

  useFrame(() => {
    if (!active) return;

    const liveState = useAppStore.getState().orbState;
    const target = ORB_STATE_PARAMS[liveState] ?? targetRef.current;
    if (currentRef.current.orbState !== liveState) {
      targetRef.current = target;
      targetColorRef.current.set(target.color);
      currentRef.current.orbState = liveState;
    }

    const current = currentRef.current;

    current.rotationSpeed = THREE.MathUtils.lerp(
      current.rotationSpeed,
      target.rotationSpeed,
      ORB_LERP_FACTOR
    );
    current.pulseIntensity = THREE.MathUtils.lerp(
      current.pulseIntensity,
      target.pulseIntensity,
      ORB_LERP_FACTOR
    );
    current.particleSpeed = THREE.MathUtils.lerp(
      current.particleSpeed,
      target.particleSpeed,
      ORB_LERP_FACTOR
    );
    current.glowIntensity = THREE.MathUtils.lerp(
      current.glowIntensity,
      target.glowIntensity,
      ORB_LERP_FACTOR
    );
    current.innerRingSpeed = THREE.MathUtils.lerp(
      current.innerRingSpeed,
      target.innerRingSpeed,
      ORB_LERP_FACTOR
    );

    const dr = currentColorRef.current.r - targetColorRef.current.r;
    const dg = currentColorRef.current.g - targetColorRef.current.g;
    const db = currentColorRef.current.b - targetColorRef.current.b;
    const colorDiffSq = dr * dr + dg * dg + db * db;

    if (colorDiffSq > 1e-6) {
      currentColorRef.current.lerp(targetColorRef.current, ORB_LERP_FACTOR);
      current.color = `#${currentColorRef.current.getHexString().toUpperCase()}`;
    } else if (current.color !== target.color) {
      currentColorRef.current.copy(targetColorRef.current);
      current.color = target.color;
    }
  });

  return currentRef.current;
}

/**
 * R3F hook that reads `orbState` from the global store and smoothly lerps
 * all orb animation parameters toward the active state target on each frame.
 * Must be called inside a React Three Fiber `<Canvas>` tree.
 */
export function useOrbAnimation(): OrbAnimationState {
  const shared = useContext(OrbAnimationContext);
  const local = useOrbAnimationLoop(!shared);
  return shared ?? local;
}

export interface OrbStateControllerProps {
  children?: React.ReactNode;
}

/**
 * Optional provider component that shares a single lerped orb animation state
 * across child R3F components inside `<Canvas>`.
 */
export function OrbStateController({ children }: OrbStateControllerProps) {
  const animationState = useOrbAnimationLoop(true);

  return (
    <OrbAnimationContext.Provider value={animationState}>
      {children ?? null}
    </OrbAnimationContext.Provider>
  );
}

export default OrbStateController;
