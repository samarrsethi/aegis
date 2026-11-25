'use client';

import React, { useEffect, useMemo, useRef } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';

export interface PlanetDirectorState {
  // Scene 1: Planet Appears (0-3s)
  planetOpacity: number;
  rotationSpeed: number;

  // Scene 2: Planetary Energy (3-5s)
  fractureProgress: number; // 0 -> 1
  energyPulse: number; // 0 -> 2

  // Scene 3: Planet Explosion (5-7s)
  explodeProgress: number; // 0 -> 1 (crust plates fly outward)
  shockwaveProgress: number; // 0 -> 1
  cameraShake: number;

  // Scene 4 & 5: Particle Reconstruction -> AI Orb (7-11s)
  reconstructProgress: number; // 0 -> 1 (fragments & particles converge into orb)
  orbCoreOpacity: number; // 0 -> 1

  // Camera
  cameraZ: number;
  cameraY: number;
}

export function createInitialPlanetState(): PlanetDirectorState {
  return {
    planetOpacity: 0,
    rotationSpeed: 0.16,

    fractureProgress: 0,
    energyPulse: 0,

    explodeProgress: 0,
    shockwaveProgress: 0,
    cameraShake: 0,

    reconstructProgress: 0,
    orbCoreOpacity: 0,

    cameraZ: 7.4,
    cameraY: 0.35,
  };
}

// ─── Planet Crust Vertex & Fragment Shaders ───
const PLANET_VERTEX = /* glsl */ `
  attribute vec3 aCentroid;
  attribute vec3 aExplodeDir;
  attribute vec3 aRandom;
  attribute vec3 aOrbPos;

  uniform float uExplode;
  uniform float uReconstruct;
  uniform float uTime;

  varying vec3 vSpherePos;
  varying vec3 vWorldNormal;
  varying vec3 vViewDir;
  varying float vFragmentSeed;

  mat3 rotationMatrix(vec3 axis, float angle) {
    axis = normalize(axis);
    float s = sin(angle);
    float c = cos(angle);
    float oc = 1.0 - c;
    return mat3(
      oc * axis.x * axis.x + c,           oc * axis.x * axis.y - axis.z * s,  oc * axis.z * axis.x + axis.y * s,
      oc * axis.x * axis.y + axis.z * s,  oc * axis.y * axis.y + c,           oc * axis.y * axis.z - axis.x * s,
      oc * axis.z * axis.x - axis.y * s,  oc * axis.y * axis.z + axis.x * s,  oc * axis.z * axis.z + c
    );
  }

  void main() {
    vSpherePos = position;
    vFragmentSeed = aRandom.x;

    vec3 localPos = position - aCentroid;

    // Slow-motion tumbling of each surface plate during explosion
    float spinAngle = uExplode * (1.0 - uReconstruct * 0.6) * (1.8 + aRandom.z * 4.2);
    vec3 rotAxis = normalize(vec3(aRandom.x - 0.5, aRandom.y - 0.5, aRandom.z - 0.5) + 0.001);
    localPos = rotationMatrix(rotAxis, spinAngle) * localPos;

    // Shrink plates smoothly into luminous shards as they converge into the AI orb
    localPos *= mix(1.0, 0.22, uReconstruct);

    // Outward explosion trajectory, then convergence to the AI orb shell
    vec3 explodedCenter = aCentroid + aExplodeDir * (uExplode * (2.1 + aRandom.y * 3.4));
    vec3 finalCenter = mix(explodedCenter, aOrbPos, uReconstruct);

    vec3 transformed = finalCenter + localPos;
    vec4 worldPos = modelMatrix * vec4(transformed, 1.0);

    vWorldNormal = normalize(mat3(modelMatrix) * normalize(aCentroid));
    vViewDir = normalize(cameraPosition - worldPos.xyz);

    gl_Position = projectionMatrix * viewMatrix * worldPos;
  }
`;

const PLANET_FRAGMENT = /* glsl */ `
  uniform float uOpacity;
  uniform float uFracture;
  uniform float uEnergyPulse;
  uniform float uExplode;
  uniform float uReconstruct;
  uniform float uTime;

  varying vec3 vSpherePos;
  varying vec3 vWorldNormal;
  varying vec3 vViewDir;
  varying float vFragmentSeed;

  // Compact 3D hash & value noise for planetary continents, clouds, and fractures
  float hash(vec3 p) {
    p = fract(p * 0.3183099 + 0.1);
    p *= 17.0;
    return fract(p.x * p.y * p.z * (p.x + p.y + p.z));
  }

  float noise(vec3 x) {
    vec3 i = floor(x);
    vec3 f = fract(x);
    f = f * f * (3.0 - 2.0 * f);
    return mix(
      mix(mix(hash(i + vec3(0,0,0)), hash(i + vec3(1,0,0)), f.x),
          mix(hash(i + vec3(0,1,0)), hash(i + vec3(1,1,0)), f.x), f.y),
      mix(mix(hash(i + vec3(0,0,1)), hash(i + vec3(1,0,1)), f.x),
          mix(hash(i + vec3(0,1,1)), hash(i + vec3(1,1,1)), f.x), f.y), f.z);
  }

  float fbm(vec3 p) {
    float v = 0.0;
    float a = 0.5;
    for (int i = 0; i < 4; i++) {
      v += a * noise(p);
      p = p * 2.05 + 1.3;
      a *= 0.5;
    }
    return v;
  }

  void main() {
    vec3 p = normalize(vSpherePos) * 2.2;
    float continent = fbm(p * 1.4);
    float clouds = fbm(p * 2.8 + vec3(uTime * 0.03, 0.0, uTime * 0.02));

    // Deep dark-blue planetary palette
    vec3 deepOcean = vec3(0.015, 0.04, 0.075);
    vec3 landmass = vec3(0.045, 0.125, 0.21);
    vec3 cloudTint = vec3(0.16, 0.34, 0.45);

    vec3 surface = mix(deepOcean, landmass, smoothstep(0.45, 0.65, continent));
    surface = mix(surface, cloudTint, smoothstep(0.56, 0.78, clouds) * 0.42);

    // Directional solar terminator lighting + cyan atmospheric rim
    vec3 sunDir = normalize(vec3(0.75, 0.35, 0.55));
    float diff = max(dot(vWorldNormal, sunDir), 0.0);
    float rim = pow(1.0 - max(dot(vWorldNormal, vViewDir), 0.0), 3.0);

    vec3 litSurface = surface * (0.14 + diff * 1.15);
    litSurface += vec3(0.325, 0.85, 0.91) * rim * (0.45 + uEnergyPulse * 0.35);

    // Glowing cyan fracture network spreading across the crust
    float ridge1 = 1.0 - abs(noise(p * 3.6) * 2.0 - 1.0);
    float ridge2 = 1.0 - abs(noise(p * 7.2 + 4.1) * 2.0 - 1.0);
    float crack = pow(ridge1 * 0.7 + ridge2 * 0.45, 5.5);

    float fractureMask = smoothstep(0.28 - uFracture * 0.24, 0.65 - uFracture * 0.35, crack) * uFracture;
    float pulse = 0.75 + 0.25 * sin(uTime * 5.0 + vFragmentSeed * 12.0);
    vec3 energyColor = mix(vec3(0.325, 0.85, 0.91), vec3(0.93, 0.97, 0.98), fractureMask * 0.7);

    // Expose bright core energy on fragments during explosion & reconstruction
    float coreGlow = uExplode * (0.45 + uReconstruct * 0.55);
    vec3 finalColor = litSurface + energyColor * (fractureMask * (1.2 + uEnergyPulse * 1.6) * pulse + coreGlow * 0.9);

    float alpha = uOpacity * (1.0 - uReconstruct * 0.25);
    gl_FragColor = vec4(finalColor, alpha);
  }
`;

// ─── Atmospheric Scattering Halo Shader ───
const ATMO_VERTEX = /* glsl */ `
  varying vec3 vNormal;
  varying vec3 vViewDir;
  void main() {
    vec4 worldPos = modelMatrix * vec4(position, 1.0);
    vNormal = normalize(mat3(modelMatrix) * normal);
    vViewDir = normalize(cameraPosition - worldPos.xyz);
    gl_Position = projectionMatrix * viewMatrix * worldPos;
  }
`;

const ATMO_FRAGMENT = /* glsl */ `
  uniform float uIntensity;
  varying vec3 vNormal;
  varying vec3 vViewDir;
  void main() {
    float rim = pow(0.65 - dot(vNormal, vViewDir), 3.4);
    vec3 col = vec3(0.325, 0.85, 0.91);
    gl_FragColor = vec4(col, clamp(rim, 0.0, 1.0) * uIntensity);
  }
`;

function createSoftGlowTexture(): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 64;
  canvas.height = 64;
  const ctx = canvas.getContext('2d');
  if (ctx) {
    const grad = ctx.createRadialGradient(32, 32, 1, 32, 32, 30);
    grad.addColorStop(0, 'rgba(237,245,247,1)');
    grad.addColorStop(0.35, 'rgba(83,217,232,0.65)');
    grad.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, 64, 64);
  }
  const tex = new THREE.CanvasTexture(canvas);
  tex.needsUpdate = true;
  return tex;
}

interface SceneProps {
  directorRef: React.MutableRefObject<PlanetDirectorState>;
  isMobile: boolean;
}

function PlanetarySceneContent({ directorRef, isMobile }: SceneProps) {
  const { camera } = useThree();

  const planetGroupRef = useRef<THREE.Group>(null);
  const atmoMeshRef = useRef<THREE.Mesh>(null);
  const shockwaveRef = useRef<THREE.Mesh>(null);
  const energyPointsRef = useRef<THREE.Points>(null);
  const orbCoreRef = useRef<THREE.Group>(null);

  const glowTex = useMemo(() => createSoftGlowTexture(), []);

  // Build non-indexed planet crust geometry so every triangle is an independent surface fragment
  const planetGeo = useMemo(() => {
    const detail = isMobile ? 10 : 15;
    const base = new THREE.IcosahedronGeometry(2.05, detail).toNonIndexed();
    const pos = base.getAttribute('position') as THREE.BufferAttribute;
    const vertCount = pos.count;

    const centroids = new Float32Array(vertCount * 3);
    const explodeDirs = new Float32Array(vertCount * 3);
    const randoms = new Float32Array(vertCount * 3);
    const orbPositions = new Float32Array(vertCount * 3);

    const v0 = new THREE.Vector3();
    const v1 = new THREE.Vector3();
    const v2 = new THREE.Vector3();
    const center = new THREE.Vector3();
    const dir = new THREE.Vector3();

    for (let i = 0; i < vertCount; i += 3) {
      v0.fromBufferAttribute(pos, i);
      v1.fromBufferAttribute(pos, i + 1);
      v2.fromBufferAttribute(pos, i + 2);

      center.copy(v0).add(v1).add(v2).divideScalar(3);

      // Outward radial explosion direction with slight organic spread
      dir.copy(center).normalize();
      dir.x += (Math.random() - 0.5) * 0.28;
      dir.y += (Math.random() - 0.5) * 0.28;
      dir.z += (Math.random() - 0.5) * 0.28;
      dir.normalize();

      const rx = Math.random();
      const ry = Math.random();
      const rz = Math.random();

      const orbRadius = 0.62 + Math.random() * 0.14;
      const orbVec = center.clone().normalize().multiplyScalar(orbRadius);

      for (let k = 0; k < 3; k++) {
        const idx = (i + k) * 3;
        centroids[idx] = center.x;
        centroids[idx + 1] = center.y;
        centroids[idx + 2] = center.z;

        explodeDirs[idx] = dir.x;
        explodeDirs[idx + 1] = dir.y;
        explodeDirs[idx + 2] = dir.z;

        randoms[idx] = rx;
        randoms[idx + 1] = ry;
        randoms[idx + 2] = rz;

        orbPositions[idx] = orbVec.x;
        orbPositions[idx + 1] = orbVec.y;
        orbPositions[idx + 2] = orbVec.z;
      }
    }

    base.setAttribute('aCentroid', new THREE.BufferAttribute(centroids, 3));
    base.setAttribute('aExplodeDir', new THREE.BufferAttribute(explodeDirs, 3));
    base.setAttribute('aRandom', new THREE.BufferAttribute(randoms, 3));
    base.setAttribute('aOrbPos', new THREE.BufferAttribute(orbPositions, 3));
    return base;
  }, [isMobile]);

  const planetMat = useMemo(
    () =>
      new THREE.ShaderMaterial({
        vertexShader: PLANET_VERTEX,
        fragmentShader: PLANET_FRAGMENT,
        transparent: true,
        side: THREE.DoubleSide,
        uniforms: {
          uOpacity: { value: 0 },
          uFracture: { value: 0 },
          uEnergyPulse: { value: 0 },
          uExplode: { value: 0 },
          uReconstruct: { value: 0 },
          uTime: { value: 0 },
        },
      }),
    []
  );

  const atmoMat = useMemo(
    () =>
      new THREE.ShaderMaterial({
        vertexShader: ATMO_VERTEX,
        fragmentShader: ATMO_FRAGMENT,
        transparent: true,
        side: THREE.BackSide,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
        uniforms: {
          uIntensity: { value: 0.7 },
        },
      }),
    []
  );

  // Fine cosmic dust starfield
  const dustCount = isMobile ? 350 : 750;
  const dustGeo = useMemo(() => {
    const pos = new Float32Array(dustCount * 3);
    for (let i = 0; i < dustCount; i++) {
      pos[i * 3] = (Math.random() - 0.5) * 32;
      pos[i * 3 + 1] = (Math.random() - 0.5) * 22;
      pos[i * 3 + 2] = -4 - Math.random() * 20;
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    return g;
  }, [dustCount]);

  // Luminous core energy particles emitted on explosion -> reconstructed into AI Orb
  const energyCount = isMobile ? 1000 : 2000;
  const energyGeo = useMemo(() => {
    const positions = new Float32Array(energyCount * 3);
    const dirs = new Float32Array(energyCount * 3);
    const orbTargets = new Float32Array(energyCount * 3);

    for (let i = 0; i < energyCount; i++) {
      const theta = Math.random() * Math.PI * 2;
      const phi = Math.acos(2 * Math.random() - 1);
      const nx = Math.sin(phi) * Math.cos(theta);
      const ny = Math.cos(phi);
      const nz = Math.sin(phi) * Math.sin(theta);

      const speed = 2.0 + Math.random() * 4.8;
      dirs[i * 3] = nx * speed;
      dirs[i * 3 + 1] = ny * speed;
      dirs[i * 3 + 2] = nz * speed;

      const r = 0.55 + Math.random() * 0.25;
      orbTargets[i * 3] = nx * r;
      orbTargets[i * 3 + 1] = ny * r;
      orbTargets[i * 3 + 2] = nz * r;
    }

    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    g.setAttribute('aDir', new THREE.BufferAttribute(dirs, 3));
    g.setAttribute('aOrbTarget', new THREE.BufferAttribute(orbTargets, 3));
    return g;
  }, [energyCount]);

  useEffect(() => {
    return () => {
      planetGeo.dispose();
      planetMat.dispose();
      atmoMat.dispose();
      dustGeo.dispose();
      energyGeo.dispose();
      glowTex.dispose();
    };
  }, [planetGeo, planetMat, atmoMat, dustGeo, energyGeo, glowTex]);

  useFrame((state, delta) => {
    const d = directorRef.current;
    const t = state.clock.elapsedTime;

    // 1. Cinematic Camera + Restrained Shake on Explosion
    const sx = d.cameraShake > 0 ? (Math.random() - 0.5) * d.cameraShake * 0.22 : 0;
    const sy = d.cameraShake > 0 ? (Math.random() - 0.5) * d.cameraShake * 0.22 : 0;
    camera.position.set(sx, d.cameraY + sy, d.cameraZ);
    camera.lookAt(0, 0, 0);

    // 2. Planet Rotation & Shader Uniforms
    if (planetGroupRef.current) {
      planetGroupRef.current.rotation.y += delta * d.rotationSpeed;
    }
    planetMat.uniforms.uOpacity.value = d.planetOpacity;
    planetMat.uniforms.uFracture.value = d.fractureProgress;
    planetMat.uniforms.uEnergyPulse.value = d.energyPulse;
    planetMat.uniforms.uExplode.value = d.explodeProgress;
    planetMat.uniforms.uReconstruct.value = d.reconstructProgress;
    planetMat.uniforms.uTime.value = t;

    // 3. Atmospheric Rim Glow (fades as planet explodes)
    if (atmoMeshRef.current) {
      const atmoVis = d.planetOpacity * (1 - d.explodeProgress * 1.4);
      atmoMeshRef.current.visible = atmoVis > 0.01;
      atmoMat.uniforms.uIntensity.value = Math.max(0, atmoVis * (0.65 + d.energyPulse * 0.2));
    }

    // 4. Expanding Shockwave
    if (shockwaveRef.current) {
      shockwaveRef.current.visible =
        d.shockwaveProgress > 0.01 && d.shockwaveProgress < 0.99;
      const s = 1.8 + d.shockwaveProgress * 11;
      shockwaveRef.current.scale.set(s, s, s);
      (shockwaveRef.current.material as THREE.MeshBasicMaterial).opacity =
        (1 - d.shockwaveProgress) * 0.65;
    }

    // 5. Energy Particles: Burst Outward -> Converge into AI Orb
    if (energyPointsRef.current) {
      energyPointsRef.current.visible = d.explodeProgress > 0.01;
      const posAttr = energyGeo.getAttribute('position') as THREE.BufferAttribute;
      const dirAttr = energyGeo.getAttribute('aDir') as THREE.BufferAttribute;
      const orbAttr = energyGeo.getAttribute('aOrbTarget') as THREE.BufferAttribute;

      for (let i = 0; i < energyCount; i++) {
        const dx = dirAttr.getX(i);
        const dy = dirAttr.getY(i);
        const dz = dirAttr.getZ(i);

        const ex = dx * d.explodeProgress;
        const ey = dy * d.explodeProgress;
        const ez = dz * d.explodeProgress;

        const tx = orbAttr.getX(i);
        const ty = orbAttr.getY(i);
        const tz = orbAttr.getZ(i);

        posAttr.setXYZ(
          i,
          THREE.MathUtils.lerp(ex, tx, d.reconstructProgress),
          THREE.MathUtils.lerp(ey, ty, d.reconstructProgress),
          THREE.MathUtils.lerp(ez, tz, d.reconstructProgress)
        );
      }
      posAttr.needsUpdate = true;
      (energyPointsRef.current.material as THREE.PointsMaterial).opacity =
        Math.min(0.95, d.explodeProgress * 1.4) * (1 - d.orbCoreOpacity * 0.25);
    }

    // 6. Stabilizing AI Orb Core
    if (orbCoreRef.current) {
      orbCoreRef.current.visible = d.orbCoreOpacity > 0.01;
      const s = THREE.MathUtils.lerp(0.3, 0.92, d.orbCoreOpacity);
      orbCoreRef.current.scale.set(s, s, s);
      orbCoreRef.current.rotation.y = t * 0.8;
      orbCoreRef.current.rotation.x = t * 0.35;
    }
  });

  return (
    <>
      {/* Fine Cosmic Dust */}
      <points geometry={dustGeo}>
        <pointsMaterial color="#8296A1" size={0.045} transparent opacity={0.5} />
      </points>

      {/* Fragmented Dark-Blue Planet */}
      <group ref={planetGroupRef}>
        <mesh geometry={planetGeo} material={planetMat} />
      </group>

      {/* Atmospheric Scattering Rim */}
      <mesh ref={atmoMeshRef} material={atmoMat}>
        <sphereGeometry args={[2.24, 48, 48]} />
      </mesh>

      {/* Shockwave Ring */}
      <mesh ref={shockwaveRef} rotation={[Math.PI / 2.4, 0.2, 0]} visible={false}>
        <ringGeometry args={[0.92, 1.0, 64]} />
        <meshBasicMaterial
          color="#53D9E8"
          transparent
          opacity={0}
          side={THREE.DoubleSide}
          blending={THREE.AdditiveBlending}
        />
      </mesh>

      {/* Luminous Energy Particles */}
      <points ref={energyPointsRef} geometry={energyGeo} visible={false}>
        <pointsMaterial
          map={glowTex}
          color="#53D9E8"
          size={0.14}
          transparent
          opacity={0.9}
          blending={THREE.AdditiveBlending}
          depthWrite={false}
        />
      </points>

      {/* Assembled AI Orb Core (Scene 4-5) */}
      <group ref={orbCoreRef} visible={false}>
        <mesh>
          <icosahedronGeometry args={[0.62, 3]} />
          <meshBasicMaterial
            color="#53D9E8"
            wireframe
            transparent
            opacity={0.55}
            blending={THREE.AdditiveBlending}
          />
        </mesh>
        <mesh rotation={[0.45, 0, 0]}>
          <torusGeometry args={[1.05, 0.015, 12, 48]} />
          <meshBasicMaterial color="#A8EAF0" transparent opacity={0.7} blending={THREE.AdditiveBlending} />
        </mesh>
      </group>
    </>
  );
}

export interface PlanetaryAwakeningSceneProps {
  directorRef: React.MutableRefObject<PlanetDirectorState>;
  isMobile: boolean;
  onWebGLError: () => void;
}

export function PlanetaryAwakeningScene({
  directorRef,
  isMobile,
  onWebGLError,
}: PlanetaryAwakeningSceneProps) {
  return (
    <Canvas
      dpr={[1, isMobile ? 1.25 : 1.75]}
      camera={{ position: [0, 0.35, 7.4], fov: 45, near: 0.1, far: 100 }}
      gl={{ antialias: true, powerPreference: 'high-performance' }}
      onCreated={({ gl }) => {
        gl.domElement.addEventListener('webglcontextlost', (e) => {
          e.preventDefault();
          onWebGLError();
        });
      }}
      style={{ width: '100%', height: '100%' }}
    >
      <color attach="background" args={['#050709']} />
      <PlanetarySceneContent directorRef={directorRef} isMobile={isMobile} />
    </Canvas>
  );
}

export default PlanetaryAwakeningScene;
