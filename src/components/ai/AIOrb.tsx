'use client';

import React, { Component, Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';
import { useAppStore } from '@/lib/store';
import type { OrbState } from '@/types';
import { ORB_LERP_FACTOR, ORB_STATE_PARAMS, useOrbAnimation } from './OrbStateController';

export type OrbSize = 'small' | 'medium' | 'large';

export interface AIOrbProps {
  size?: OrbSize;
  className?: string;
}

const SIZE_WIDTH_CLASSES: Record<OrbSize, string> = {
  small: 'w-24',
  medium: 'w-48 sm:w-56',
  large: 'w-72 sm:w-80 md:w-96',
};

const SIZE_HEIGHT_CLASSES: Record<OrbSize, string> = {
  small: 'h-24',
  medium: 'h-48 sm:h-56',
  large: 'h-72 sm:h-80 md:h-96',
};

const SIZE_SCENE_SCALE: Record<OrbSize, number> = {
  small: 0.88,
  medium: 0.98,
  large: 1.06,
};

const BASE_CAMERA_Z = 7.8;

const CAMERA_DOLLY_Z: Record<OrbState, number> = {
  idle: 7.8,
  listening: 7.35,
  thinking: 7.5,
  speaking: 7.25,
  error: 8.05,
  offline: 8.3,
};

const CORE_VERTEX_SHADER = /* glsl */ `
  uniform float uTime;
  uniform float uPulse;

  varying vec3 vNormal;
  varying vec3 vViewPosition;
  varying vec3 vLocalPosition;
  varying float vDisplacement;

  void main() {
    float wave1 = sin(position.x * 3.0 + uTime * 1.6) * cos(position.y * 3.0 + uTime * 1.2);
    float wave2 = sin(position.z * 3.5 - uTime * 1.4) * sin((position.x + position.y) * 2.2 + uTime * 0.9);
    float breathing = sin(uTime * 1.5) * 0.5 + 0.5;
    float displacement = (wave1 * 0.042 + wave2 * 0.028 + breathing * 0.018) * (0.35 + uPulse * 0.9);

    vec3 displacedPosition = position + normal * displacement;
    vec4 mvPosition = modelViewMatrix * vec4(displacedPosition, 1.0);

    vNormal = normalize(normalMatrix * normal);
    vViewPosition = -mvPosition.xyz;
    vLocalPosition = displacedPosition;
    vDisplacement = displacement;

    gl_Position = projectionMatrix * mvPosition;
  }
`;

const CORE_FRAGMENT_SHADER = /* glsl */ `
  uniform float uTime;
  uniform float uPulse;
  uniform vec3 uColor;

  varying vec3 vNormal;
  varying vec3 vViewPosition;
  varying vec3 vLocalPosition;
  varying float vDisplacement;

  void main() {
    vec3 normal = normalize(vNormal);
    vec3 viewDir = normalize(vViewPosition);

    float ndotv = clamp(dot(normal, viewDir), 0.0, 1.0);
    float fresnel = pow(1.0 - ndotv, 2.2);
    float centerGlow = pow(ndotv, 1.6);
    float pulseShimmer = 0.5 + 0.5 * sin(uTime * 2.0 + vLocalPosition.y * 3.0);

    vec3 deepCore = mix(vec3(0.02, 0.03, 0.05), uColor, 0.38 + centerGlow * (0.44 + uPulse * 0.18));
    vec3 rimColor = mix(uColor, vec3(0.92, 0.97, 0.99), 0.28);
    vec3 finalColor = mix(deepCore, rimColor, fresnel * 0.9);
    finalColor += uColor * (centerGlow * 0.16 * uPulse + vDisplacement * 1.6 + pulseShimmer * 0.05 * uPulse);

    float alpha = clamp(
      0.24 + centerGlow * (0.28 + uPulse * 0.16) + fresnel * (0.56 + uPulse * 0.22),
      0.18,
      0.95
    );

    gl_FragColor = vec4(finalColor, alpha);
  }
`;

function checkWebGLSupport(): boolean {
  if (typeof window === 'undefined') return false;
  try {
    const canvas = document.createElement('canvas');
    const context =
      canvas.getContext('webgl2') ||
      canvas.getContext('webgl') ||
      canvas.getContext('experimental-webgl');
    return Boolean(context);
  } catch {
    return false;
  }
}

function createParticleGlowTexture(): THREE.CanvasTexture | null {
  if (typeof document === 'undefined') return null;
  const textureSize = 64;
  const canvas = document.createElement('canvas');
  canvas.width = textureSize;
  canvas.height = textureSize;
  const ctx = canvas.getContext('2d');
  if (!ctx) return null;

  const center = textureSize / 2;
  const gradient = ctx.createRadialGradient(center, center, 0, center, center, center);
  gradient.addColorStop(0, 'rgba(255, 255, 255, 1)');
  gradient.addColorStop(0.25, 'rgba(255, 255, 255, 0.8)');
  gradient.addColorStop(0.6, 'rgba(255, 255, 255, 0.2)');
  gradient.addColorStop(1, 'rgba(255, 255, 255, 0)');

  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, textureSize, textureSize);

  const texture = new THREE.CanvasTexture(canvas);
  texture.needsUpdate = true;
  return texture;
}

interface OrbErrorBoundaryProps {
  fallback: React.ReactNode;
  onError?: () => void;
  children: React.ReactNode;
}

interface OrbErrorBoundaryState {
  hasError: boolean;
}

class OrbErrorBoundary extends Component<OrbErrorBoundaryProps, OrbErrorBoundaryState> {
  state: OrbErrorBoundaryState = { hasError: false };

  static getDerivedStateFromError(): OrbErrorBoundaryState {
    return { hasError: true };
  }

  componentDidCatch(): void {
    this.props.onError?.();
  }

  render(): React.ReactNode {
    if (this.state.hasError) {
      return this.props.fallback;
    }
    return this.props.children;
  }
}

interface OrbFallback2DProps {
  size: OrbSize;
  orbState: OrbState;
  reducedMotion: boolean;
}

function getFallbackVisuals(orbState: OrbState) {
  switch (orbState) {
    case 'error':
      return {
        accent: '#D6A45C',
        glow: 'rgba(214, 164, 92, 0.15)',
        ringBorder: 'rgba(214, 164, 92, 0.35)',
        coreBackground:
          'radial-gradient(circle at 38% 35%, rgba(214, 164, 92, 0.48) 0%, rgba(214, 164, 92, 0.15) 55%, rgba(5, 7, 9, 0.85) 100%)',
      };
    case 'offline':
      return {
        accent: '#8296A1',
        glow: 'rgba(130, 150, 161, 0.1)',
        ringBorder: 'rgba(130, 150, 161, 0.25)',
        coreBackground:
          'radial-gradient(circle at 38% 35%, rgba(130, 150, 161, 0.35) 0%, rgba(130, 150, 161, 0.1) 55%, rgba(5, 7, 9, 0.9) 100%)',
      };
    default:
      return {
        accent: '#53D9E8',
        glow: 'rgba(83, 217, 232, 0.15)',
        ringBorder: 'rgba(83, 217, 232, 0.32)',
        coreBackground:
          'radial-gradient(circle at 38% 35%, rgba(168, 234, 240, 0.55) 0%, rgba(83, 217, 232, 0.15) 55%, rgba(5, 7, 9, 0.85) 100%)',
      };
  }
}

function OrbFallback2D({ size, orbState, reducedMotion }: OrbFallback2DProps) {
  const visuals = getFallbackVisuals(orbState);
  const scaleFactor = size === 'small' ? 0.88 : size === 'large' ? 1.0 : 0.95;

  return (
    <div
      role="img"
      aria-label={`A.E.G.I.S. AI Orb (${orbState})`}
      className="relative flex h-full w-full items-center justify-center"
      style={{ transform: `scale(${scaleFactor})` }}
    >
      {/* Subtle outer halo */}
      <div
        className={`absolute h-[78%] w-[78%] rounded-full border border-dashed transition-colors duration-500 ${
          reducedMotion ? '' : 'animate-spin-slow'
        }`}
        style={{
          borderColor: visuals.ringBorder,
          boxShadow: `0 0 24px ${visuals.glow}`,
        }}
      />

      {/* Inner orbital ring */}
      <div
        className={`absolute h-[62%] w-[62%] rounded-full border transition-colors duration-500 ${
          reducedMotion ? '' : 'animate-spin-reverse'
        }`}
        style={{
          borderColor: visuals.ringBorder,
          borderTopColor: visuals.accent,
        }}
      />

      {/* Central animated gradient core */}
      <div
        className={`relative h-[44%] w-[44%] rounded-full border transition-all duration-500 ${
          reducedMotion ? '' : 'animate-pulse-slow'
        }`}
        style={{
          background: visuals.coreBackground,
          borderColor: visuals.ringBorder,
          boxShadow: `0 0 20px ${visuals.glow}`,
        }}
      />
    </div>
  );
}

interface ParticleSystemData {
  geometry: THREE.BufferGeometry;
  radii: Float32Array;
  speeds: Float32Array;
  angles: Float32Array;
  inclinations: Float32Array;
  nodeAngles: Float32Array;
}

function writeParticlePosition(
  positions: Float32Array,
  index: number,
  radius: number,
  angle: number,
  inclination: number,
  nodeAngle: number
) {
  const lx = radius * Math.cos(angle);
  const lz = radius * Math.sin(angle);
  const ty = lz * Math.sin(inclination);
  const tz = lz * Math.cos(inclination);

  const cosN = Math.cos(nodeAngle);
  const sinN = Math.sin(nodeAngle);

  positions[index * 3] = lx * cosN + tz * sinN;
  positions[index * 3 + 1] = ty;
  positions[index * 3 + 2] = -lx * sinN + tz * cosN;
}

interface OrbSceneProps {
  size: OrbSize;
  onContextLost: () => void;
}

function OrbScene({ size, onContextLost }: OrbSceneProps) {
  const anim = useOrbAnimation();
  const animationQuality = useAppStore((state) => state.settings.animationQuality);
  const reducedMotion = useAppStore((state) => state.settings.reducedMotion);
  const { camera, gl } = useThree();

  const orbGroupRef = useRef<THREE.Group>(null);
  const coreMeshRef = useRef<THREE.Mesh>(null);
  const coreMatRef = useRef<THREE.ShaderMaterial>(null);
  const innerRingRef = useRef<THREE.Mesh>(null);
  const innerRingMatRef = useRef<THREE.MeshBasicMaterial>(null);
  const outerRingRef = useRef<THREE.Mesh>(null);
  const outerRingMatRef = useRef<THREE.MeshBasicMaterial>(null);
  const pointsMatRef = useRef<THREE.PointsMaterial>(null);
  const pointLightRef = useRef<THREE.PointLight>(null);
  const timeRef = useRef<number>(0);

  useEffect(() => {
    const canvas = gl.domElement;
    const handleContextLost = (event: Event) => {
      event.preventDefault();
      onContextLost();
    };
    canvas.addEventListener('webglcontextlost', handleContextLost, false);
    return () => {
      canvas.removeEventListener('webglcontextlost', handleContextLost, false);
    };
  }, [gl, onContextLost]);

  const qualityConfig = useMemo(() => {
    if (animationQuality === 'low') {
      return {
        icosahedronDetail: 2,
        ringRadialSegments: 8,
        ringTubularSegments: 36,
        particleCount: 30,
        particleSize: 0.08,
      };
    }
    if (animationQuality === 'medium') {
      return {
        icosahedronDetail: 3,
        ringRadialSegments: 10,
        ringTubularSegments: 52,
        particleCount: 64,
        particleSize: 0.072,
      };
    }
    return {
      icosahedronDetail: 3,
      ringRadialSegments: 12,
      ringTubularSegments: 64,
      particleCount: 76,
      particleSize: 0.068,
    };
  }, [animationQuality]);

  const coreUniforms = useMemo(
    () => ({
      uTime: { value: 0 },
      uPulse: { value: ORB_STATE_PARAMS.idle.pulseIntensity },
      uColor: { value: new THREE.Color(ORB_STATE_PARAMS.idle.color) },
    }),
    []
  );

  const particleTexture = useMemo(() => createParticleGlowTexture(), []);
  useEffect(() => {
    return () => {
      particleTexture?.dispose();
    };
  }, [particleTexture]);

  const particleData = useMemo<ParticleSystemData>(() => {
    const count = qualityConfig.particleCount;
    const positions = new Float32Array(count * 3);
    const radii = new Float32Array(count);
    const speeds = new Float32Array(count);
    const angles = new Float32Array(count);
    const inclinations = new Float32Array(count);
    const nodeAngles = new Float32Array(count);

    for (let i = 0; i < count; i++) {
      const radius = 1.5 + Math.random() * 1.5;
      const speed = 0.25 + Math.random() * 0.55;
      const phase = Math.random() * Math.PI * 2;
      const inclination = (Math.random() - 0.5) * Math.PI * 0.85;
      const nodeAngle = Math.random() * Math.PI * 2;

      radii[i] = radius;
      speeds[i] = speed;
      angles[i] = phase;
      inclinations[i] = inclination;
      nodeAngles[i] = nodeAngle;

      writeParticlePosition(positions, i, radius, phase, inclination, nodeAngle);
    }

    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));

    return { geometry, radii, speeds, angles, inclinations, nodeAngles };
  }, [qualityConfig.particleCount]);

  useEffect(() => {
    return () => {
      particleData.geometry.dispose();
    };
  }, [particleData]);

  const baseScale = SIZE_SCENE_SCALE[size];

  useFrame((_, rawDelta) => {
    const delta = Math.min(rawDelta, 0.1);
    const motionScale = reducedMotion ? 0 : 1;
    timeRef.current += delta * motionScale;
    const t = timeRef.current;

    // Whole orb subtle breathing oscillation
    if (orbGroupRef.current) {
      const breathe = reducedMotion
        ? 0
        : Math.sin(t * 1.4) * 0.035 * (0.5 + anim.pulseIntensity);
      orbGroupRef.current.scale.setScalar(baseScale * (1 + breathe));
    }

    // Central core shader & organic rotation
    if (coreMatRef.current) {
      coreMatRef.current.uniforms.uTime.value = t;
      coreMatRef.current.uniforms.uPulse.value = anim.pulseIntensity;
      coreMatRef.current.uniforms.uColor.value.copy(anim.threeColor);
    }
    if (coreMeshRef.current) {
      coreMeshRef.current.rotation.y += anim.rotationSpeed * delta * 0.75 * motionScale;
      coreMeshRef.current.rotation.x = Math.sin(t * 0.35) * 0.1 * motionScale;
    }

    // Inner wireframe ring rotating on Y axis
    if (innerRingRef.current) {
      innerRingRef.current.rotation.y += anim.innerRingSpeed * delta * 2.2 * motionScale;
      innerRingRef.current.rotation.x =
        Math.PI * 0.14 + Math.sin(t * 0.45) * 0.05 * motionScale;
    }
    if (innerRingMatRef.current) {
      innerRingMatRef.current.color.copy(anim.threeColor);
      innerRingMatRef.current.opacity = 0.2 + anim.glowIntensity * 0.38;
    }

    // Outer thin ring rotating on tilted axis (~30 degrees)
    if (outerRingRef.current) {
      outerRingRef.current.rotation.y -= anim.rotationSpeed * delta * 0.9 * motionScale;
      outerRingRef.current.rotation.x += anim.rotationSpeed * delta * 0.25 * motionScale;
    }
    if (outerRingMatRef.current) {
      outerRingMatRef.current.color.copy(anim.threeColor);
      outerRingMatRef.current.opacity = 0.14 + anim.glowIntensity * 0.26;
    }

    // Orbiting particles
    const posAttribute = particleData.geometry.getAttribute('position') as THREE.BufferAttribute;
    if (motionScale > 0) {
      const posArray = posAttribute.array as Float32Array;
      const count = particleData.radii.length;

      for (let i = 0; i < count; i++) {
        const nextAngle =
          particleData.angles[i] +
          particleData.speeds[i] * anim.particleSpeed * delta * motionScale;
        particleData.angles[i] = nextAngle;

        writeParticlePosition(
          posArray,
          i,
          particleData.radii[i],
          nextAngle,
          particleData.inclinations[i],
          particleData.nodeAngles[i]
        );
      }
      posAttribute.needsUpdate = true;
    }

    if (pointsMatRef.current) {
      pointsMatRef.current.color.copy(anim.threeColor);
      pointsMatRef.current.opacity = 0.35 + anim.glowIntensity * 0.45;
    }

    // Center PointLight glow
    if (pointLightRef.current) {
      pointLightRef.current.color.copy(anim.threeColor);
      pointLightRef.current.intensity = anim.glowIntensity * 2.0;
    }

    // Slight camera dolly effect on state change
    const targetCameraZ = reducedMotion
      ? BASE_CAMERA_Z
      : CAMERA_DOLLY_Z[anim.orbState] ?? BASE_CAMERA_Z;
    camera.position.z = THREE.MathUtils.lerp(camera.position.z, targetCameraZ, ORB_LERP_FACTOR);
  });

  return (
    <>
      <ambientLight intensity={0.25} color="#A8EAF0" />
      <pointLight
        ref={pointLightRef}
        position={[0, 0, 0]}
        color="#53D9E8"
        intensity={0.8}
        distance={10}
        decay={2}
      />

      <group ref={orbGroupRef} scale={baseScale}>
        {/* Central Core Sphere */}
        <mesh ref={coreMeshRef}>
          <icosahedronGeometry args={[0.8, qualityConfig.icosahedronDetail]} />
          <shaderMaterial
            ref={coreMatRef}
            vertexShader={CORE_VERTEX_SHADER}
            fragmentShader={CORE_FRAGMENT_SHADER}
            uniforms={coreUniforms}
            transparent
            depthWrite={false}
          />
        </mesh>

        {/* Inner Wireframe Ring (Y-axis rotation) */}
        <mesh ref={innerRingRef} rotation={[Math.PI * 0.14, 0, 0]}>
          <torusGeometry
            args={[1.18, 0.022, qualityConfig.ringRadialSegments, qualityConfig.ringTubularSegments]}
          />
          <meshBasicMaterial
            ref={innerRingMatRef}
            color="#53D9E8"
            wireframe
            transparent
            opacity={0.42}
            depthWrite={false}
            blending={THREE.AdditiveBlending}
          />
        </mesh>

        {/* Outer Thin Ring (tilted ~30 degrees) */}
        <group rotation={[Math.PI / 6, 0, Math.PI / 12]}>
          <mesh ref={outerRingRef}>
            <torusGeometry args={[1.52, 0.008, 8, qualityConfig.ringTubularSegments]} />
            <meshBasicMaterial
              ref={outerRingMatRef}
              color="#A8EAF0"
              transparent
              opacity={0.28}
              depthWrite={false}
              blending={THREE.AdditiveBlending}
            />
          </mesh>
        </group>

        {/* Orbiting Particle System */}
        <points geometry={particleData.geometry}>
          <pointsMaterial
            ref={pointsMatRef}
            color="#53D9E8"
            size={qualityConfig.particleSize}
            sizeAttenuation
            transparent
            opacity={0.7}
            depthWrite={false}
            blending={THREE.AdditiveBlending}
            map={particleTexture ?? undefined}
          />
        </points>
      </group>
    </>
  );
}

export default function AIOrb({ size = 'medium', className = '' }: AIOrbProps) {
  const orbState = useAppStore((state) => state.orbState);
  const animationQuality = useAppStore((state) => state.settings.animationQuality);
  const reducedMotion = useAppStore((state) => state.settings.reducedMotion);

  const [webglAvailable, setWebglAvailable] = useState<boolean | null>(null);

  useEffect(() => {
    setWebglAvailable(checkWebGLSupport());
  }, []);

  const handleWebGLUnavailable = useCallback(() => {
    setWebglAvailable(false);
  }, []);

  const hasCustomWidth = /\b(w-|size-|min-w-|max-w-)/.test(className);
  const hasCustomHeight = /\b(h-|size-|min-h-|max-h-)/.test(className);

  const containerClasses = [
    'relative flex items-center justify-center select-none overflow-hidden',
    !hasCustomWidth ? SIZE_WIDTH_CLASSES[size] : '',
    !hasCustomHeight ? SIZE_HEIGHT_CLASSES[size] : '',
    className,
  ]
    .filter(Boolean)
    .join(' ');

  const fallbackNode = (
    <OrbFallback2D size={size} orbState={orbState} reducedMotion={reducedMotion} />
  );

  return (
    <div
      className={containerClasses}
      aria-label={`A.E.G.I.S. AI Orb (${orbState})`}
    >
      {webglAvailable === true ? (
        <OrbErrorBoundary fallback={fallbackNode} onError={handleWebGLUnavailable}>
          <Suspense fallback={fallbackNode}>
            <Canvas
              dpr={[1, 1.5]}
              camera={{ position: [0, 0, BASE_CAMERA_Z], fov: 45, near: 0.1, far: 100 }}
              gl={{
                antialias: animationQuality !== 'low',
                alpha: true,
                powerPreference: 'high-performance',
              }}
              resize={{ scroll: false, debounce: { scroll: 50, resize: 0 } }}
              style={{ width: '100%', height: '100%' }}
            >
              <OrbScene size={size} onContextLost={handleWebGLUnavailable} />
            </Canvas>
          </Suspense>
        </OrbErrorBoundary>
      ) : (
        fallbackNode
      )}
    </div>
  );
}
