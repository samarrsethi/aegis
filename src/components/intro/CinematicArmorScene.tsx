'use client';

import React, { useEffect, useMemo, useRef } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';

export interface IntroDirectorState {
  // Hero walk & posture
  heroZ: number;
  walkPhase: number;
  walkWeight: number; // 0 = standing still, 1 = walking stride
  headPitch: number;

  // Camera orbit & push-in
  cameraAngle: number; // radians around hero
  cameraRadius: number;
  cameraY: number;
  cameraLookY: number;
  cameraShake: number;

  // Reactor & Armor
  reactorOpen: number;
  reactorIntensity: number;
  eyesGlow: number;

  // Ejected Holographic AI Consciousness -> Explosion -> Orb
  ejectProgress: number; // 0 = inside chest, 1 = floating in front
  consciousnessOpacity: number;
  explodeProgress: number; // 0 -> 1 (explodes into 2,400 particles)
  collapseToOrb: number; // 0 -> 1 (coalesces into AI orb)
  envFade: number; // 1 = industrial bay visible, 0 = dark void for orb reveal
}

export function createInitialDirectorState(): IntroDirectorState {
  return {
    heroZ: -4.2,
    walkPhase: 0,
    walkWeight: 1,
    headPitch: 0.08,

    cameraAngle: -0.42,
    cameraRadius: 5.4,
    cameraY: 1.25,
    cameraLookY: 1.15,
    cameraShake: 0,

    reactorOpen: 0,
    reactorIntensity: 0.45,
    eyesGlow: 1.4,

    ejectProgress: 0,
    consciousnessOpacity: 0,
    explodeProgress: 0,
    collapseToOrb: 0,
    envFade: 1,
  };
}

// ─── Procedural Studio HDRI Reflections ───
function StudioEnvironment() {
  const { gl, scene } = useThree();

  useEffect(() => {
    const pmrem = new THREE.PMREMGenerator(gl);
    pmrem.compileEquirectangularShader();
    const roomEnv = new RoomEnvironment();
    const envRT = pmrem.fromScene(roomEnv, 0.04);
    scene.environment = envRT.texture;
    scene.environmentIntensity = 1.2;

    return () => {
      scene.environment = null;
      envRT.dispose();
      roomEnv.dispose();
      pmrem.dispose();
    };
  }, [gl, scene]);

  return null;
}

function createSoftRadialTexture(innerColor: string, outerColor: string): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 128;
  canvas.height = 128;
  const ctx = canvas.getContext('2d');
  if (ctx) {
    const grad = ctx.createRadialGradient(64, 64, 2, 64, 64, 62);
    grad.addColorStop(0, innerColor);
    grad.addColorStop(0.35, outerColor);
    grad.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, 128, 128);
  }
  const tex = new THREE.CanvasTexture(canvas);
  tex.needsUpdate = true;
  return tex;
}

function createChestPlateGeometry(): THREE.ExtrudeGeometry {
  const shape = new THREE.Shape();
  shape.moveTo(-0.34, 0.22);
  shape.lineTo(-0.14, 0.25);
  shape.lineTo(0, 0.17);
  shape.lineTo(0.14, 0.25);
  shape.lineTo(0.34, 0.22);
  shape.lineTo(0.42, 0.06);
  shape.lineTo(0.31, -0.22);
  shape.lineTo(0, -0.27);
  shape.lineTo(-0.31, -0.22);
  shape.lineTo(-0.42, 0.06);
  shape.closePath();

  const geo = new THREE.ExtrudeGeometry(shape, {
    depth: 0.24,
    bevelEnabled: true,
    bevelThickness: 0.055,
    bevelSize: 0.045,
    bevelSegments: 4,
  });
  geo.center();
  return geo;
}

function createFaceplateGeometry(): THREE.ExtrudeGeometry {
  const shape = new THREE.Shape();
  shape.moveTo(-0.11, 0.14);
  shape.lineTo(0, 0.11);
  shape.lineTo(0.11, 0.14);
  shape.lineTo(0.13, 0.01);
  shape.lineTo(0.08, -0.13);
  shape.lineTo(0, -0.16);
  shape.lineTo(-0.08, -0.13);
  shape.lineTo(-0.13, 0.01);
  shape.closePath();

  const geo = new THREE.ExtrudeGeometry(shape, {
    depth: 0.05,
    bevelEnabled: true,
    bevelThickness: 0.02,
    bevelSize: 0.018,
    bevelSegments: 3,
  });
  geo.center();
  return geo;
}

function createLatheLimb(
  radii: [number, number][],
  segments = 24
): THREE.LatheGeometry {
  const pts = radii.map(([r, y]) => new THREE.Vector2(r, y));
  return new THREE.LatheGeometry(pts, segments);
}

interface SceneProps {
  directorRef: React.MutableRefObject<IntroDirectorState>;
  isMobile: boolean;
}

function IndustrialBayAndHero({ directorRef, isMobile }: SceneProps) {
  const { camera } = useThree();

  const envGroupRef = useRef<THREE.Group>(null);
  const heroGroupRef = useRef<THREE.Group>(null);
  const torsoGroupRef = useRef<THREE.Group>(null);
  const headGroupRef = useRef<THREE.Group>(null);
  const leftLegRef = useRef<THREE.Group>(null);
  const rightLegRef = useRef<THREE.Group>(null);
  const leftArmRef = useRef<THREE.Group>(null);
  const rightArmRef = useRef<THREE.Group>(null);

  const irisRefs = useRef<(THREE.Mesh | null)[]>([]);
  const ring1Ref = useRef<THREE.Mesh>(null);
  const ring2Ref = useRef<THREE.Mesh>(null);
  const reactorLightRef = useRef<THREE.PointLight>(null);
  const reactorHaloRef = useRef<THREE.Sprite>(null);

  const consciousnessRef = useRef<THREE.Group>(null);
  const explosionPointsRef = useRef<THREE.Points>(null);
  const collapseOrbRef = useRef<THREE.Group>(null);

  const geos = useMemo(() => {
    const chest = createChestPlateGeometry();
    const faceplate = createFaceplateGeometry();
    const thigh = createLatheLimb([
      [0.095, -0.21],
      [0.125, -0.05],
      [0.135, 0.12],
      [0.11, 0.21],
    ]);
    const shin = createLatheLimb([
      [0.08, -0.24],
      [0.11, -0.02],
      [0.115, 0.14],
      [0.095, 0.24],
    ]);
    const pauldron = createLatheLimb([
      [0.16, -0.1],
      [0.18, 0.0],
      [0.14, 0.1],
      [0.06, 0.14],
    ]);
    const bicep = createLatheLimb([
      [0.075, -0.14],
      [0.095, 0.0],
      [0.085, 0.14],
    ]);
    const gauntlet = createLatheLimb([
      [0.068, -0.18],
      [0.092, 0.04],
      [0.088, 0.16],
    ]);
    return { chest, faceplate, thigh, shin, pauldron, bicep, gauntlet };
  }, []);

  const glowTexture = useMemo(
    () => createSoftRadialTexture('rgba(237,245,247,1)', 'rgba(83,217,232,0.55)'),
    []
  );

  const materials = useMemo(() => {
    const crimson = new THREE.MeshPhysicalMaterial({
      color: '#9A141A',
      metalness: 0.9,
      roughness: 0.18,
      clearcoat: 1.0,
      clearcoatRoughness: 0.08,
    });
    const gold = new THREE.MeshPhysicalMaterial({
      color: '#E5B44C',
      metalness: 0.95,
      roughness: 0.15,
      clearcoat: 0.9,
      clearcoatRoughness: 0.06,
    });
    const titanium = new THREE.MeshPhysicalMaterial({
      color: '#1A232B',
      metalness: 0.85,
      roughness: 0.32,
      clearcoat: 0.35,
    });
    const hangarSteel = new THREE.MeshStandardMaterial({
      color: '#0E141B',
      metalness: 0.82,
      roughness: 0.42,
    });
    const cyanCore = new THREE.MeshStandardMaterial({
      color: '#EDF5F7',
      emissive: new THREE.Color('#53D9E8'),
      emissiveIntensity: 2.2,
      roughness: 0.1,
    });
    const eyeMat = new THREE.MeshStandardMaterial({
      color: '#EDF5F7',
      emissive: new THREE.Color('#7CEEFF'),
      emissiveIntensity: 2.0,
    });
    return { crimson, gold, titanium, hangarSteel, cyanCore, eyeMat };
  }, []);

  // 2,400 particles for the holographic AI consciousness explosion -> AI Orb
  const particleCount = isMobile ? 1200 : 2400;
  const explosionGeo = useMemo(() => {
    const positions = new Float32Array(particleCount * 3);
    const dirs = new Float32Array(particleCount * 3);
    const orbTargets = new Float32Array(particleCount * 3);

    for (let i = 0; i < particleCount; i++) {
      const theta = Math.random() * Math.PI * 2;
      const phi = Math.acos(2 * Math.random() - 1);
      const speed = 1.4 + Math.random() * 4.5;

      dirs[i * 3] = Math.sin(phi) * Math.cos(theta) * speed;
      dirs[i * 3 + 1] = Math.cos(phi) * speed;
      dirs[i * 3 + 2] = Math.sin(phi) * Math.sin(theta) * speed;

      const r = 0.52 + Math.random() * 0.25;
      orbTargets[i * 3] = Math.sin(phi) * Math.cos(theta) * r;
      orbTargets[i * 3 + 1] = 1.15 + Math.cos(phi) * r;
      orbTargets[i * 3 + 2] = Math.sin(phi) * Math.sin(theta) * r;
    }

    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geo.setAttribute('aDir', new THREE.BufferAttribute(dirs, 3));
    geo.setAttribute('aOrbTarget', new THREE.BufferAttribute(orbTargets, 3));
    return geo;
  }, [particleCount]);

  useEffect(() => {
    return () => {
      Object.values(geos).forEach((g) => g.dispose());
      Object.values(materials).forEach((m) => m.dispose());
      glowTexture.dispose();
      explosionGeo.dispose();
    };
  }, [geos, materials, glowTexture, explosionGeo]);

  useFrame((state, delta) => {
    const d = directorRef.current;
    const t = state.clock.elapsedTime;

    // 1. Orbiting / Push-In Camera + Shake
    const camX = Math.sin(d.cameraAngle) * d.cameraRadius;
    const camZ = Math.cos(d.cameraAngle) * d.cameraRadius + d.heroZ;
    const sx = d.cameraShake > 0 ? (Math.random() - 0.5) * d.cameraShake * 0.28 : 0;
    const sy = d.cameraShake > 0 ? (Math.random() - 0.5) * d.cameraShake * 0.28 : 0;

    camera.position.set(camX + sx, d.cameraY + sy, camZ);
    camera.lookAt(0, d.cameraLookY, d.heroZ);

    // 2. Industrial Bay visibility
    if (envGroupRef.current) {
      envGroupRef.current.visible = d.envFade > 0.05;
    }

    // 3. Hero Weighted Walk Cycle
    const stride = Math.sin(d.walkPhase) * d.walkWeight;
    const bob = Math.abs(Math.sin(d.walkPhase)) * 0.045 * d.walkWeight;

    if (heroGroupRef.current) {
      heroGroupRef.current.position.set(0, bob, d.heroZ);
      heroGroupRef.current.visible = d.collapseToOrb < 0.35;
    }
    if (torsoGroupRef.current) {
      torsoGroupRef.current.rotation.y = -stride * 0.08;
    }
    if (headGroupRef.current) {
      headGroupRef.current.rotation.x = d.headPitch;
    }
    if (leftLegRef.current) {
      leftLegRef.current.rotation.x = stride * 0.36;
    }
    if (rightLegRef.current) {
      rightLegRef.current.rotation.x = -stride * 0.36;
    }
    if (leftArmRef.current) {
      leftArmRef.current.rotation.x = -stride * 0.28;
    }
    if (rightArmRef.current) {
      rightArmRef.current.rotation.x = stride * 0.28;
    }

    // 4. Reactor Iris & Rings
    const openDist = 0.055 + d.reactorOpen * 0.135;
    irisRefs.current.forEach((mesh, idx) => {
      if (!mesh) return;
      const angle = (idx / 6) * Math.PI * 2;
      mesh.position.set(Math.cos(angle) * openDist, Math.sin(angle) * openDist, 0.045);
      mesh.rotation.z = angle;
    });

    const spinRate = 1.5 + d.reactorOpen * 3.8 + d.reactorIntensity * 1.4;
    if (ring1Ref.current) ring1Ref.current.rotation.z += delta * spinRate;
    if (ring2Ref.current) ring2Ref.current.rotation.z -= delta * spinRate * 1.35;

    materials.cyanCore.emissiveIntensity = 1.2 + d.reactorIntensity * 1.9;
    materials.eyeMat.emissiveIntensity = d.eyesGlow * 1.6;
    if (reactorLightRef.current) {
      reactorLightRef.current.intensity = 2.0 + d.reactorIntensity * 5.0;
    }
    if (reactorHaloRef.current) {
      const hs = 0.45 + d.reactorIntensity * 0.35;
      reactorHaloRef.current.scale.set(hs, hs, 1);
      reactorHaloRef.current.material.opacity = Math.min(0.95, 0.3 + d.reactorIntensity * 0.3);
    }

    // 5. Ejected Holographic AI Consciousness
    const ejectZ = d.heroZ + 0.22 + d.ejectProgress * 1.55;
    const ejectY = 1.39 - d.ejectProgress * 0.08;
    if (consciousnessRef.current) {
      consciousnessRef.current.visible =
        d.consciousnessOpacity > 0.02 && d.explodeProgress < 0.25;
      consciousnessRef.current.position.set(0, ejectY, ejectZ);
      consciousnessRef.current.rotation.y = t * 2.2;
      consciousnessRef.current.rotation.x = t * 1.1;
      const cs = THREE.MathUtils.lerp(0.15, 0.55, d.ejectProgress);
      consciousnessRef.current.scale.set(cs, cs, cs);
    }

    // 6. Particle Explosion -> Collapse into A.E.G.I.S. AI Orb
    if (explosionPointsRef.current) {
      explosionPointsRef.current.visible = d.explodeProgress > 0.01;
      const posAttr = explosionGeo.getAttribute('position') as THREE.BufferAttribute;
      const dirAttr = explosionGeo.getAttribute('aDir') as THREE.BufferAttribute;
      const orbAttr = explosionGeo.getAttribute('aOrbTarget') as THREE.BufferAttribute;

      for (let i = 0; i < particleCount; i++) {
        const dx = dirAttr.getX(i);
        const dy = dirAttr.getY(i);
        const dz = dirAttr.getZ(i);

        const ex = dx * d.explodeProgress;
        const ey = ejectY + dy * d.explodeProgress;
        const ez = ejectZ + dz * d.explodeProgress;

        const tx = orbAttr.getX(i);
        const ty = orbAttr.getY(i);
        const tz = d.heroZ + orbAttr.getZ(i);

        posAttr.setXYZ(
          i,
          THREE.MathUtils.lerp(ex, tx, d.collapseToOrb),
          THREE.MathUtils.lerp(ey, ty, d.collapseToOrb),
          THREE.MathUtils.lerp(ez, tz, d.collapseToOrb)
        );
      }
      posAttr.needsUpdate = true;
      (explosionPointsRef.current.material as THREE.PointsMaterial).opacity =
        0.9 * (1 - d.collapseToOrb * 0.2);
    }

    if (collapseOrbRef.current) {
      collapseOrbRef.current.visible = d.collapseToOrb > 0.1;
      collapseOrbRef.current.position.set(0, 1.15, d.heroZ);
      const s = THREE.MathUtils.lerp(2.2, 0.9, d.collapseToOrb);
      collapseOrbRef.current.scale.set(s, s, s);
      collapseOrbRef.current.rotation.y = t * 1.4;
    }
  });

  return (
    <>
      <StudioEnvironment />

      {/* Cinematic Industrial Blue / Orange Rim Lighting */}
      <ambientLight intensity={0.22} color="#8296A1" />
      <directionalLight position={[5, 8, 5]} intensity={2.4} color="#FF9E44" />
      <directionalLight position={[-6, 4, -3]} intensity={2.6} color="#53D9E8" />
      <spotLight position={[0, 7, 2]} intensity={3.5} angle={0.5} penumbra={0.8} color="#A8EAF0" />

      {/* ─── Futuristic Industrial Hangar Environment ─── */}
      <group ref={envGroupRef}>
        {/* Reflective Steel Floor */}
        <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.02, -2]}>
          <planeGeometry args={[28, 36]} />
          <meshStandardMaterial color="#070B10" metalness={0.88} roughness={0.28} />
        </mesh>

        {/* Illuminated Runway Guide Strips */}
        {[-1.3, 1.3].map((x) => (
          <mesh key={x} rotation={[-Math.PI / 2, 0, 0]} position={[x, -0.01, -2]}>
            <planeGeometry args={[0.04, 18]} />
            <meshBasicMaterial color="#53D9E8" transparent opacity={0.35} />
          </mesh>
        ))}

        {/* Industrial Structural Rib Arches */}
        {[-8, -4.5, -1, 2.5].map((z) => (
          <group key={z} position={[0, 0, z]}>
            <mesh position={[-3.4, 2.4, 0]} material={materials.hangarSteel}>
              <boxGeometry args={[0.35, 4.8, 0.45]} />
            </mesh>
            <mesh position={[3.4, 2.4, 0]} material={materials.hangarSteel}>
              <boxGeometry args={[0.35, 4.8, 0.45]} />
            </mesh>
            <mesh position={[0, 4.8, 0]} material={materials.hangarSteel}>
              <boxGeometry args={[7.2, 0.35, 0.45]} />
            </mesh>
          </group>
        ))}
      </group>

      {/* ─── Armored Hero ─── */}
      <group ref={heroGroupRef} position={[0, 0, -4.2]}>
        {/* Left Leg (pivoted at hip y = 0.94) */}
        <group ref={leftLegRef} position={[-0.2, 0.94, 0]}>
          <mesh position={[0, -0.18, 0]} geometry={geos.thigh} material={materials.gold} />
          <mesh position={[0, -0.38, 0.09]} material={materials.gold}>
            <sphereGeometry args={[0.09, 16, 12]} />
          </mesh>
          <mesh position={[0, -0.58, 0]} geometry={geos.shin} material={materials.crimson} />
          <mesh position={[0, -0.84, 0.04]} material={materials.crimson}>
            <capsuleGeometry args={[0.095, 0.14, 8, 16]} />
          </mesh>
        </group>

        {/* Right Leg (pivoted at hip y = 0.94) */}
        <group ref={rightLegRef} position={[0.2, 0.94, 0]}>
          <mesh position={[0, -0.18, 0]} geometry={geos.thigh} material={materials.gold} />
          <mesh position={[0, -0.38, 0.09]} material={materials.gold}>
            <sphereGeometry args={[0.09, 16, 12]} />
          </mesh>
          <mesh position={[0, -0.58, 0]} geometry={geos.shin} material={materials.crimson} />
          <mesh position={[0, -0.84, 0.04]} material={materials.crimson}>
            <capsuleGeometry args={[0.095, 0.14, 8, 16]} />
          </mesh>
        </group>

        {/* Pelvis */}
        <mesh position={[0, 0.98, 0]} material={materials.crimson}>
          <cylinderGeometry args={[0.26, 0.22, 0.18, 20]} />
        </mesh>

        {/* Torso + Reactor + Arms + Helmet */}
        <group ref={torsoGroupRef}>
          <mesh position={[0, 1.16, 0]} material={materials.titanium}>
            <cylinderGeometry args={[0.25, 0.22, 0.22, 20]} />
          </mesh>
          <mesh position={[0, 1.38, 0.02]} geometry={geos.chest} material={materials.crimson} />
          <mesh position={[0, 1.58, 0.03]} rotation={[0.2, 0, 0]} material={materials.gold}>
            <torusGeometry args={[0.19, 0.035, 12, 28, Math.PI]} />
          </mesh>

          {/* Chest Reactor */}
          <group position={[0, 1.39, 0.19]}>
            <pointLight ref={reactorLightRef} color="#53D9E8" intensity={2.5} distance={8} />
            <sprite ref={reactorHaloRef} position={[0, 0, 0.05]}>
              <spriteMaterial
                map={glowTexture}
                transparent
                opacity={0.7}
                blending={THREE.AdditiveBlending}
                depthWrite={false}
              />
            </sprite>
            <mesh rotation={[Math.PI / 2, 0, 0]} material={materials.titanium}>
              <cylinderGeometry args={[0.145, 0.155, 0.05, 28]} />
            </mesh>
            <mesh position={[0, 0, 0.026]} material={materials.gold}>
              <torusGeometry args={[0.138, 0.014, 12, 32]} />
            </mesh>
            <mesh position={[0, 0, 0.025]} material={materials.cyanCore}>
              <circleGeometry args={[0.072, 28]} />
            </mesh>
            <mesh ref={ring1Ref} position={[0, 0, 0.032]} material={materials.cyanCore}>
              <torusGeometry args={[0.095, 0.009, 10, 28]} />
            </mesh>
            <mesh ref={ring2Ref} position={[0, 0, 0.036]} material={materials.gold}>
              <torusGeometry args={[0.12, 0.01, 10, 28]} />
            </mesh>
            {[0, 1, 2, 3, 4, 5].map((i) => (
              <mesh
                key={i}
                ref={(el) => {
                  irisRefs.current[i] = el;
                }}
                material={i % 2 === 0 ? materials.crimson : materials.gold}
              >
                <cylinderGeometry args={[0.035, 0.055, 0.018, 6]} />
              </mesh>
            ))}
          </group>

          {/* Shoulders & Arms */}
          <mesh position={[-0.48, 1.56, 0]} rotation={[0, 0, 0.22]} geometry={geos.pauldron} material={materials.crimson} />
          <mesh position={[0.48, 1.56, 0]} rotation={[0, 0, -0.22]} geometry={geos.pauldron} material={materials.crimson} />

          <group ref={leftArmRef} position={[-0.54, 1.44, 0]} rotation={[0, 0, 0.14]}>
            <mesh position={[0, -0.14, 0]} geometry={geos.bicep} material={materials.gold} />
            <mesh position={[0, -0.44, 0.03]} geometry={geos.gauntlet} material={materials.crimson} />
          </group>
          <group ref={rightArmRef} position={[0.54, 1.44, 0]} rotation={[0, 0, -0.14]}>
            <mesh position={[0, -0.14, 0]} geometry={geos.bicep} material={materials.gold} />
            <mesh position={[0, -0.44, 0.03]} geometry={geos.gauntlet} material={materials.crimson} />
          </group>

          {/* Helmet */}
          <group ref={headGroupRef} position={[0, 1.76, 0]}>
            <mesh position={[0, -0.09, 0]} material={materials.titanium}>
              <cylinderGeometry args={[0.08, 0.105, 0.14, 20]} />
            </mesh>
            <mesh position={[0, 0.12, -0.01]} scale={[0.92, 1.12, 1.05]} material={materials.crimson}>
              <sphereGeometry args={[0.165, 28, 24]} />
            </mesh>
            <mesh position={[0, 0.1, 0.145]} geometry={geos.faceplate} material={materials.gold} />
            <mesh position={[-0.052, 0.13, 0.178]} rotation={[0, 0, -0.14]} material={materials.eyeMat}>
              <capsuleGeometry args={[0.01, 0.042, 6, 12]} />
            </mesh>
            <mesh position={[0.052, 0.13, 0.178]} rotation={[0, 0, 0.14]} material={materials.eyeMat}>
              <capsuleGeometry args={[0.01, 0.042, 6, 12]} />
            </mesh>
          </group>
        </group>
      </group>

      {/* ─── Ejected Holographic AI Consciousness ─── */}
      <group ref={consciousnessRef} visible={false}>
        <mesh material={materials.cyanCore}>
          <icosahedronGeometry args={[0.45, 2]} />
        </mesh>
        <mesh rotation={[0.5, 0.3, 0]}>
          <torusGeometry args={[0.85, 0.025, 12, 48]} />
          <meshBasicMaterial color="#53D9E8" transparent opacity={0.9} blending={THREE.AdditiveBlending} />
        </mesh>
        <mesh rotation={[-0.4, 0.8, 0.2]}>
          <torusGeometry args={[1.1, 0.018, 12, 48]} />
          <meshBasicMaterial color="#A8EAF0" transparent opacity={0.75} blending={THREE.AdditiveBlending} />
        </mesh>
      </group>

      {/* ─── 2,400-Particle Explosion & Collapse to AI Orb ─── */}
      <points ref={explosionPointsRef} geometry={explosionGeo} visible={false}>
        <pointsMaterial
          map={glowTexture}
          color="#53D9E8"
          size={0.12}
          transparent
          opacity={0.9}
          blending={THREE.AdditiveBlending}
          depthWrite={false}
        />
      </points>

      <group ref={collapseOrbRef} visible={false}>
        <mesh material={materials.cyanCore}>
          <icosahedronGeometry args={[0.58, 3]} />
        </mesh>
      </group>
    </>
  );
}

export interface CinematicArmorSceneProps {
  directorRef: React.MutableRefObject<IntroDirectorState>;
  isMobile: boolean;
  onWebGLError: () => void;
}

export function CinematicArmorScene({
  directorRef,
  isMobile,
  onWebGLError,
}: CinematicArmorSceneProps) {
  return (
    <Canvas
      dpr={[1, isMobile ? 1.25 : 1.75]}
      camera={{ position: [0, 1.25, 5.4], fov: 46, near: 0.1, far: 100 }}
      gl={{
        antialias: true,
        toneMapping: THREE.ACESFilmicToneMapping,
        toneMappingExposure: 1.15,
        powerPreference: 'high-performance',
      }}
      onCreated={({ gl }) => {
        gl.domElement.addEventListener('webglcontextlost', (e) => {
          e.preventDefault();
          onWebGLError();
        });
      }}
      style={{ width: '100%', height: '100%' }}
    >
      <color attach="background" args={['#050709']} />
      <fog attach="fog" args={['#050709', 8, 24]} />
      <IndustrialBayAndHero directorRef={directorRef} isMobile={isMobile} />
    </Canvas>
  );
}

export default CinematicArmorScene;
