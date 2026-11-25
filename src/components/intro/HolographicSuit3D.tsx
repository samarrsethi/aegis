'use client';

import React, { useEffect, useMemo, useRef } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';

export interface HologramDirectorState {
  // Scene 1: Initialization
  gridOpacity: number;
  initLinesProgress: number;
  scanY: number;

  // Scene 2: Progressive Wireframe Construction (0 -> 1)
  drawProgress: number;
  eyesGlow: number;

  // Scene 3: Reactor Activation
  reactorSpin: number;
  reactorGlow: number;
  energyWave: number; // 0 -> 1 pulse traveling through lines

  // Scene 4: Arm Raise & Energy Blast
  rightArmRaise: number; // 0 -> 1
  palmCharge: number; // 0 -> 1
  blastProgress: number; // 0 -> 1
  cameraShake: number;

  // Scene 5 & 6: Disintegration -> Collapse into AI Orb
  disintegrate: number; // 0 -> 1
  collapseToOrb: number; // 0 -> 1

  // Camera
  cameraX: number;
  cameraY: number;
  cameraZ: number;
  cameraLookY: number;
}

export function createInitialHologramState(): HologramDirectorState {
  return {
    gridOpacity: 0,
    initLinesProgress: 0,
    scanY: -1.5,

    drawProgress: 0,
    eyesGlow: 0,

    reactorSpin: 0.4,
    reactorGlow: 0.2,
    energyWave: 0,

    rightArmRaise: 0,
    palmCharge: 0,
    blastProgress: 0,
    cameraShake: 0,

    disintegrate: 0,
    collapseToOrb: 0,

    cameraX: 0,
    cameraY: 1.15,
    cameraZ: 5.8,
    cameraLookY: 1.05,
  };
}

// ─── Helper: Add a symmetric or single polyline into segment arrays ───
interface SegmentBuilder {
  positions: number[];
  orders: number[];
  colors: number[];
  seeds: number[];
}

function addPolyline(
  b: SegmentBuilder,
  pts: [number, number, number][],
  orderStart: number,
  orderEnd: number,
  color: [number, number, number],
  mirrorX = false
) {
  const pushSeg = (p1: [number, number, number], p2: [number, number, number], t: number) => {
    b.positions.push(p1[0], p1[1], p1[2], p2[0], p2[1], p2[2]);
    b.orders.push(t, t);
    b.colors.push(color[0], color[1], color[2], color[0], color[1], color[2]);
    const sx = (Math.random() - 0.5) * 2;
    const sy = (Math.random() - 0.5) * 2;
    const sz = (Math.random() - 0.5) * 2;
    b.seeds.push(sx, sy, sz, sx, sy, sz);
  };

  for (let i = 0; i < pts.length - 1; i++) {
    const t = orderStart + ((i + 0.5) / Math.max(1, pts.length - 1)) * (orderEnd - orderStart);
    pushSeg(pts[i], pts[i + 1], t);
    if (mirrorX) {
      pushSeg([-pts[i][0], pts[i][1], pts[i][2]], [-pts[i + 1][0], pts[i + 1][1], pts[i + 1][2]], t);
    }
  }
}

function addLoop(
  b: SegmentBuilder,
  pts: [number, number, number][],
  orderStart: number,
  orderEnd: number,
  color: [number, number, number],
  mirrorX = false
) {
  addPolyline(b, [...pts, pts[0]], orderStart, orderEnd, color, mirrorX);
}

// ─── Build Recognizable Armored Superhero Wireframe Blueprint ───
function buildBodyWireframeGeometry(): THREE.BufferGeometry {
  const b: SegmentBuilder = { positions: [], orders: [], colors: [], seeds: [] };
  const cyan: [number, number, number] = [0.325, 0.85, 0.91]; // #53D9E8
  const electric: [number, number, number] = [0.22, 0.74, 0.97]; // #38BDF8
  const ice: [number, number, number] = [0.66, 0.92, 0.94]; // #A8EAF0

  // 1. HELMET OUTLINE (0.00 - 0.16)
  // Cranium & faceplate contour
  addPolyline(
    b,
    [
      [0, 2.02, 0.02],
      [0.11, 1.98, 0.05],
      [0.145, 1.88, 0.08],
      [0.135, 1.76, 0.1],
      [0.07, 1.66, 0.12],
      [0, 1.64, 0.13],
    ],
    0.0,
    0.08,
    cyan,
    true
  );
  // Faceplate inner mask & brow V-ridge
  addPolyline(
    b,
    [
      [0, 1.92, 0.14],
      [0.09, 1.89, 0.13],
      [0.11, 1.79, 0.13],
      [0.055, 1.69, 0.14],
      [0, 1.68, 0.14],
    ],
    0.06,
    0.13,
    ice,
    true
  );
  // Cranium horizontal & vertical blueprint ribs
  addPolyline(
    b,
    [
      [-0.14, 1.86, 0.04],
      [0, 1.9, -0.14],
      [0.14, 1.86, 0.04],
    ],
    0.1,
    0.16,
    electric
  );
  addPolyline(
    b,
    [
      [0, 2.02, 0.02],
      [0, 1.92, -0.14],
      [0, 1.72, -0.12],
    ],
    0.12,
    0.16,
    electric
  );

  // 2. NECK & SHOULDERS (0.22 - 0.38)
  addPolyline(
    b,
    [
      [0.065, 1.66, 0.02],
      [0.085, 1.56, 0.04],
      [0.2, 1.54, 0.08],
      [0.36, 1.55, 0.05],
    ],
    0.22,
    0.3,
    cyan,
    true
  );
  // Sculpted shoulder pauldrons (layered rings)
  addLoop(
    b,
    [
      [0.36, 1.56, 0.09],
      [0.52, 1.52, 0.07],
      [0.57, 1.39, 0.02],
      [0.45, 1.36, -0.06],
      [0.34, 1.46, -0.08],
    ],
    0.28,
    0.38,
    electric,
    true
  );
  addPolyline(
    b,
    [
      [0.38, 1.53, 0.04],
      [0.54, 1.46, 0.03],
    ],
    0.32,
    0.38,
    ice,
    true
  );

  // 3. CHEST & CIRCUIT PATHS (0.38 - 0.56)
  addPolyline(
    b,
    [
      [0, 1.49, 0.16],
      [0.18, 1.52, 0.15],
      [0.38, 1.46, 0.11],
      [0.33, 1.24, 0.12],
      [0.16, 1.18, 0.15],
      [0, 1.2, 0.16],
    ],
    0.38,
    0.49,
    cyan,
    true
  );
  // Chest circuit lines leading into the reactor
  addPolyline(
    b,
    [
      [0.34, 1.44, 0.12],
      [0.2, 1.38, 0.17],
      [0.13, 1.36, 0.18],
    ],
    0.46,
    0.54,
    ice,
    true
  );
  addPolyline(
    b,
    [
      [0.28, 1.24, 0.13],
      [0.16, 1.29, 0.17],
      [0.11, 1.33, 0.18],
    ],
    0.48,
    0.56,
    electric,
    true
  );

  // 4. LEFT ARM & HAND (0.56 - 0.75) — Right arm is in a separate animated group for Scene 4!
  addPolyline(
    b,
    [
      [-0.48, 1.42, 0.02],
      [-0.56, 1.16, 0.04],
      [-0.6, 0.92, 0.09],
      [-0.58, 0.8, 0.12],
    ],
    0.56,
    0.72,
    cyan
  );
  addPolyline(
    b,
    [
      [-0.4, 1.38, -0.02],
      [-0.47, 1.14, -0.02],
      [-0.51, 0.92, 0.03],
      [-0.52, 0.82, 0.08],
    ],
    0.58,
    0.74,
    electric
  );
  // Left gauntlet & fingers
  addLoop(
    b,
    [
      [-0.6, 0.92, 0.09],
      [-0.51, 0.92, 0.03],
      [-0.53, 0.78, 0.06],
      [-0.61, 0.78, 0.12],
    ],
    0.66,
    0.75,
    ice
  );

  // 5. TORSO & LEGS (0.75 - 1.00)
  // Abdominal armor ribs
  [1.12, 1.03, 0.94].forEach((y, idx) => {
    const w = 0.24 - idx * 0.02;
    addPolyline(
      b,
      [
        [-w, y, 0.12],
        [0, y - 0.03, 0.14],
        [w, y, 0.12],
      ],
      0.75 + idx * 0.02,
      0.81 + idx * 0.02,
      electric
    );
  });
  // Pelvis frame
  addPolyline(
    b,
    [
      [0, 0.85, 0.14],
      [0.24, 0.89, 0.1],
      [0.27, 0.76, 0.06],
      [0.08, 0.72, 0.1],
      [0, 0.71, 0.11],
    ],
    0.8,
    0.86,
    cyan,
    true
  );

  // Muscular Thighs, Knees, Shins & Boots (mirrored)
  addPolyline(
    b,
    [
      [0.26, 0.76, 0.06],
      [0.28, 0.44, 0.08],
      [0.24, 0.36, 0.1],
      [0.27, 0.08, 0.06],
      [0.26, -0.18, 0.14],
      [0.14, -0.18, 0.14],
      [0.13, 0.08, 0.04],
      [0.14, 0.42, 0.06],
      [0.11, 0.72, 0.08],
    ],
    0.85,
    0.98,
    cyan,
    true
  );
  // Knee & boot detail rings
  addLoop(
    b,
    [
      [0.15, 0.43, 0.08],
      [0.26, 0.43, 0.08],
      [0.24, 0.34, 0.11],
      [0.16, 0.34, 0.11],
    ],
    0.92,
    1.0,
    ice,
    true
  );

  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(b.positions, 3));
  geo.setAttribute('aOrder', new THREE.Float32BufferAttribute(b.orders, 1));
  geo.setAttribute('aColor', new THREE.Float32BufferAttribute(b.colors, 3));
  geo.setAttribute('aSeed', new THREE.Float32BufferAttribute(b.seeds, 3));
  return geo;
}

function buildRightArmWireframeGeometry(): THREE.BufferGeometry {
  const b: SegmentBuilder = { positions: [], orders: [], colors: [], seeds: [] };
  const cyan: [number, number, number] = [0.325, 0.85, 0.91];
  const electric: [number, number, number] = [0.22, 0.74, 0.97];
  const ice: [number, number, number] = [0.66, 0.92, 0.94];

  // Pivot at shoulder (0, 0, 0) corresponding to world (0.48, 1.42, 0.02)
  addPolyline(
    b,
    [
      [0, 0, 0],
      [0.08, -0.26, 0.02],
      [0.12, -0.5, 0.07],
      [0.1, -0.62, 0.1],
    ],
    0.56,
    0.72,
    cyan
  );
  addPolyline(
    b,
    [
      [-0.08, -0.04, -0.04],
      [-0.01, -0.28, -0.04],
      [0.03, -0.5, 0.01],
      [0.04, -0.6, 0.06],
    ],
    0.58,
    0.74,
    electric
  );
  addLoop(
    b,
    [
      [0.12, -0.5, 0.07],
      [0.03, -0.5, 0.01],
      [0.05, -0.64, 0.04],
      [0.13, -0.64, 0.1],
    ],
    0.66,
    0.75,
    ice
  );

  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(b.positions, 3));
  geo.setAttribute('aOrder', new THREE.Float32BufferAttribute(b.orders, 1));
  geo.setAttribute('aColor', new THREE.Float32BufferAttribute(b.colors, 3));
  geo.setAttribute('aSeed', new THREE.Float32BufferAttribute(b.seeds, 3));
  return geo;
}

// ─── Custom GLSL Wireframe Path-Tracing + Disintegration Shader ───
const WIREFRAME_VERTEX = /* glsl */ `
  attribute float aOrder;
  attribute vec3 aColor;
  attribute vec3 aSeed;

  uniform float uDrawProgress;
  uniform float uEnergyWave;
  uniform float uDisintegrate;
  uniform float uCollapse;
  uniform float uTime;

  varying float vVisible;
  varying float vPulse;
  varying vec3 vColor;

  void main() {
    vColor = aColor;

    // Progressive path-trace visibility
    float edge = smoothstep(aOrder - 0.04, aOrder + 0.01, uDrawProgress);
    vVisible = edge;

    // Energy wave traveling upward from chest reactor (y ~ 1.36)
    float distFromChest = abs(position.y - 1.36) + abs(position.x) * 0.5;
    vPulse = exp(-pow((distFromChest - uEnergyWave * 2.2) * 3.5, 2.0)) * step(0.01, uEnergyWave);

    vec3 pos = position;

    // Disintegrate into floating fragments, then collapse into center orb (0, 1.1, 0)
    if (uDisintegrate > 0.001) {
      vec3 scatter = pos + aSeed * (uDisintegrate * 2.4);
      vec3 orbTarget = vec3(0.0, 1.1, 0.0) + normalize(aSeed + vec3(0.001)) * 0.55;
      pos = mix(scatter, orbTarget, uCollapse);
    }

    gl_Position = projectionMatrix * modelViewMatrix * vec4(pos, 1.0);
  }
`;

const WIREFRAME_FRAGMENT = /* glsl */ `
  uniform float uOpacity;
  uniform float uReactorGlow;

  varying float vVisible;
  varying float vPulse;
  varying vec3 vColor;

  void main() {
    if (vVisible < 0.02) discard;
    vec3 col = mix(vColor, vec3(0.93, 0.96, 0.97), vPulse * 0.75 + uReactorGlow * 0.25);
    float alpha = vVisible * uOpacity * (0.85 + vPulse * 0.5);
    gl_FragColor = vec4(col, alpha);
  }
`;

interface SceneProps {
  directorRef: React.MutableRefObject<HologramDirectorState>;
  isMobile: boolean;
}

function HolographicSceneContent({ directorRef, isMobile }: SceneProps) {
  const { camera } = useThree();

  const bodyGeo = useMemo(() => buildBodyWireframeGeometry(), []);
  const rightArmGeo = useMemo(() => buildRightArmWireframeGeometry(), []);

  const wireframeMat = useMemo(
    () =>
      new THREE.ShaderMaterial({
        vertexShader: WIREFRAME_VERTEX,
        fragmentShader: WIREFRAME_FRAGMENT,
        transparent: true,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
        uniforms: {
          uDrawProgress: { value: 0 },
          uEnergyWave: { value: 0 },
          uDisintegrate: { value: 0 },
          uCollapse: { value: 0 },
          uTime: { value: 0 },
          uOpacity: { value: 1 },
          uReactorGlow: { value: 0.2 },
        },
      }),
    []
  );

  // Incoming initialization vector streaks (Scene 1)
  const streakCount = isMobile ? 24 : 48;
  const streakGeo = useMemo(() => {
    const pos = new Float32Array(streakCount * 6);
    for (let i = 0; i < streakCount; i++) {
      const y = -0.5 + Math.random() * 3.0;
      const z = -2 + Math.random() * 4;
      const x = (Math.random() - 0.5) * 8;
      const len = 0.6 + Math.random() * 1.4;
      pos[i * 6] = x;
      pos[i * 6 + 1] = y;
      pos[i * 6 + 2] = z;
      pos[i * 6 + 3] = x + len;
      pos[i * 6 + 4] = y;
      pos[i * 6 + 5] = z;
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    return g;
  }, [streakCount]);

  // Thousands of holographic disintegration & orb particles (Scene 1 & Scene 5-6)
  const particleCount = isMobile ? 1100 : 2200;
  const particleGeo = useMemo(() => {
    const positions = new Float32Array(particleCount * 3);
    const origins = new Float32Array(particleCount * 3);
    const dirs = new Float32Array(particleCount * 3);
    const orbTargets = new Float32Array(particleCount * 3);

    for (let i = 0; i < particleCount; i++) {
      // Distribute along human silhouette volume
      const band = Math.random();
      let ox = 0;
      let oy = 1.1;
      let oz = 0;
      if (band < 0.15) {
        // Head
        ox = (Math.random() - 0.5) * 0.24;
        oy = 1.7 + Math.random() * 0.3;
        oz = (Math.random() - 0.5) * 0.22;
      } else if (band < 0.55) {
        // Torso & shoulders
        ox = (Math.random() - 0.5) * 0.72;
        oy = 0.9 + Math.random() * 0.7;
        oz = (Math.random() - 0.5) * 0.24;
      } else {
        // Arms & legs
        const side = Math.random() > 0.5 ? 1 : -1;
        ox = side * (0.14 + Math.random() * 0.42);
        oy = -0.1 + Math.random() * 1.4;
        oz = (Math.random() - 0.5) * 0.2;
      }
      origins[i * 3] = ox;
      origins[i * 3 + 1] = oy;
      origins[i * 3 + 2] = oz;
      positions[i * 3] = ox;
      positions[i * 3 + 1] = oy;
      positions[i * 3 + 2] = oz;

      const theta = Math.random() * Math.PI * 2;
      const phi = Math.acos(2 * Math.random() - 1);
      const speed = 1.2 + Math.random() * 3.2;
      dirs[i * 3] = Math.sin(phi) * Math.cos(theta) * speed;
      dirs[i * 3 + 1] = Math.cos(phi) * speed;
      dirs[i * 3 + 2] = Math.sin(phi) * Math.sin(theta) * speed;

      const r = 0.52 + Math.random() * 0.28;
      orbTargets[i * 3] = Math.sin(phi) * Math.cos(theta) * r;
      orbTargets[i * 3 + 1] = 1.1 + Math.cos(phi) * r;
      orbTargets[i * 3 + 2] = Math.sin(phi) * Math.sin(theta) * r;
    }

    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geo.setAttribute('aOrigin', new THREE.BufferAttribute(origins, 3));
    geo.setAttribute('aDir', new THREE.BufferAttribute(dirs, 3));
    geo.setAttribute('aOrbTarget', new THREE.BufferAttribute(orbTargets, 3));
    return geo;
  }, [particleCount]);

  const rightArmGroupRef = useRef<THREE.Group>(null);
  const eyeLeftRef = useRef<THREE.Mesh>(null);
  const eyeRightRef = useRef<THREE.Mesh>(null);
  const ring1Ref = useRef<THREE.Mesh>(null);
  const ring2Ref = useRef<THREE.Mesh>(null);
  const ring3Ref = useRef<THREE.Mesh>(null);
  const reactorCoreRef = useRef<THREE.Mesh>(null);
  const palmSphereRef = useRef<THREE.Mesh>(null);
  const blastBeamRef = useRef<THREE.Mesh>(null);
  const gridGroupRef = useRef<THREE.Group>(null);
  const scanLineRef = useRef<THREE.Mesh>(null);
  const streaksRef = useRef<THREE.LineSegments>(null);
  const particlesRef = useRef<THREE.Points>(null);

  useEffect(() => {
    return () => {
      bodyGeo.dispose();
      rightArmGeo.dispose();
      wireframeMat.dispose();
      streakGeo.dispose();
      particleGeo.dispose();
    };
  }, [bodyGeo, rightArmGeo, wireframeMat, streakGeo, particleGeo]);

  useFrame((state, delta) => {
    const d = directorRef.current;
    const t = state.clock.elapsedTime;

    // Camera + restrained shake
    const sx = d.cameraShake > 0 ? (Math.random() - 0.5) * d.cameraShake * 0.25 : 0;
    const sy = d.cameraShake > 0 ? (Math.random() - 0.5) * d.cameraShake * 0.25 : 0;
    camera.position.set(d.cameraX + sx, d.cameraY + sy, d.cameraZ);
    camera.lookAt(0, d.cameraLookY, 0);

    // Update Wireframe Shader Uniforms
    wireframeMat.uniforms.uDrawProgress.value = d.drawProgress;
    wireframeMat.uniforms.uEnergyWave.value = d.energyWave;
    wireframeMat.uniforms.uDisintegrate.value = d.disintegrate;
    wireframeMat.uniforms.uCollapse.value = d.collapseToOrb;
    wireframeMat.uniforms.uTime.value = t;
    wireframeMat.uniforms.uReactorGlow.value = d.reactorGlow;
    wireframeMat.uniforms.uOpacity.value = Math.max(0, 1 - d.collapseToOrb * 0.95);

    // Holographic Grid & Scan Plane
    if (gridGroupRef.current) {
      gridGroupRef.current.visible = d.gridOpacity > 0.01;
    }
    if (scanLineRef.current) {
      scanLineRef.current.visible = d.drawProgress > 0.02 && d.drawProgress < 0.99;
      scanLineRef.current.position.y = d.scanY;
    }
    if (streaksRef.current) {
      streaksRef.current.visible = d.initLinesProgress > 0.01 && d.initLinesProgress < 0.99;
      streaksRef.current.position.x = (d.initLinesProgress - 0.5) * 6;
      (streaksRef.current.material as THREE.LineBasicMaterial).opacity =
        Math.sin(d.initLinesProgress * Math.PI) * 0.7;
    }

    // Helmet Eyes
    [eyeLeftRef.current, eyeRightRef.current].forEach((m) => {
      if (!m) return;
      m.visible = d.eyesGlow > 0.02 && d.disintegrate < 0.35;
      (m.material as THREE.MeshBasicMaterial).opacity = Math.min(1, d.eyesGlow);
    });

    // Concentric Holographic Reactor Rings
    const ringAlpha = Math.max(0, Math.min(1, (d.drawProgress - 0.4) * 3)) * (1 - d.collapseToOrb * 0.7);
    [ring1Ref.current, ring2Ref.current, ring3Ref.current, reactorCoreRef.current].forEach((m) => {
      if (!m) return;
      m.visible = ringAlpha > 0.02;
    });
    if (ring1Ref.current) ring1Ref.current.rotation.z += delta * (0.8 + d.reactorSpin * 2.5);
    if (ring2Ref.current) ring2Ref.current.rotation.z -= delta * (1.2 + d.reactorSpin * 3.2);
    if (ring3Ref.current) ring3Ref.current.rotation.z += delta * (0.5 + d.reactorSpin * 1.8);
    if (reactorCoreRef.current) {
      const s = 0.8 + d.reactorGlow * 0.6 + Math.sin(t * 6) * 0.05;
      reactorCoreRef.current.scale.set(s, s, 1);
    }

    // Right Arm Raise & Energy Blast
    if (rightArmGroupRef.current) {
      rightArmGroupRef.current.rotation.x = -d.rightArmRaise * 1.48; // Raises hand forward toward camera
      rightArmGroupRef.current.rotation.z = d.rightArmRaise * 0.12;
    }
    if (palmSphereRef.current) {
      palmSphereRef.current.visible = d.palmCharge > 0.02 && d.blastProgress < 0.6;
      const ps = 0.04 + d.palmCharge * 0.16;
      palmSphereRef.current.scale.set(ps, ps, ps);
    }
    if (blastBeamRef.current) {
      blastBeamRef.current.visible = d.blastProgress > 0.01 && d.blastProgress < 0.99;
      const bz = THREE.MathUtils.lerp(0.65, 6.4, d.blastProgress);
      const bs = 0.25 + d.blastProgress * 3.8;
      blastBeamRef.current.position.set(0.55 * (1 - d.blastProgress * 0.6), 1.38, bz);
      blastBeamRef.current.scale.set(bs, bs, bs);
      (blastBeamRef.current.material as THREE.MeshBasicMaterial).opacity =
        (1 - d.blastProgress) * 0.9;
    }

    // Disintegration & Flow to Center Orb
    if (particlesRef.current) {
      particlesRef.current.visible = d.gridOpacity > 0.05 || d.disintegrate > 0.01;
      const posAttr = particleGeo.getAttribute('position') as THREE.BufferAttribute;
      const originAttr = particleGeo.getAttribute('aOrigin') as THREE.BufferAttribute;
      const dirAttr = particleGeo.getAttribute('aDir') as THREE.BufferAttribute;
      const orbAttr = particleGeo.getAttribute('aOrbTarget') as THREE.BufferAttribute;

      for (let i = 0; i < particleCount; i++) {
        const ox = originAttr.getX(i);
        const oy = originAttr.getY(i);
        const oz = originAttr.getZ(i);

        const dx = dirAttr.getX(i);
        const dy = dirAttr.getY(i);
        const dz = dirAttr.getZ(i);

        const tx = orbAttr.getX(i);
        const ty = orbAttr.getY(i);
        const tz = orbAttr.getZ(i);

        // Scatter outward, then spiral/collapse into AI Orb
        const sxPos = ox + dx * d.disintegrate * 1.35;
        const syPos = oy + dy * d.disintegrate * 1.35;
        const szPos = oz + dz * d.disintegrate * 1.35;

        const fx = THREE.MathUtils.lerp(sxPos, tx, d.collapseToOrb);
        const fy = THREE.MathUtils.lerp(syPos, ty, d.collapseToOrb);
        const fz = THREE.MathUtils.lerp(szPos, tz, d.collapseToOrb);

        posAttr.setXYZ(i, fx, fy, fz);
      }
      posAttr.needsUpdate = true;

      const pMat = particlesRef.current.material as THREE.PointsMaterial;
      pMat.opacity = d.disintegrate > 0.01 ? 0.85 : d.gridOpacity * 0.35;
    }
  });

  return (
    <>
      {/* Faint Holographic Blueprint Grid */}
      <group ref={gridGroupRef} position={[0, -0.2, 0]} visible={false}>
        <gridHelper args={[16, 32, '#53D9E8', '#152A36']} />
      </group>

      {/* Incoming Luminous Vector Streaks (Scene 1) */}
      <lineSegments ref={streaksRef} geometry={streakGeo} visible={false}>
        <lineBasicMaterial
          color="#53D9E8"
          transparent
          opacity={0}
          blending={THREE.AdditiveBlending}
        />
      </lineSegments>

      {/* Holographic Scan Plane */}
      <mesh ref={scanLineRef} rotation={[-Math.PI / 2, 0, 0]} visible={false}>
        <ringGeometry args={[0.1, 1.3, 48]} />
        <meshBasicMaterial
          color="#53D9E8"
          transparent
          opacity={0.22}
          side={THREE.DoubleSide}
          blending={THREE.AdditiveBlending}
        />
      </mesh>

      {/* Main Holographic Wireframe Body */}
      <lineSegments geometry={bodyGeo} material={wireframeMat} />

      {/* Articulated Right Arm + Palm Energy Sphere */}
      <group ref={rightArmGroupRef} position={[0.48, 1.42, 0.02]}>
        <lineSegments geometry={rightArmGeo} material={wireframeMat} />
        <mesh ref={palmSphereRef} position={[0.09, -0.62, 0.1]} visible={false}>
          <icosahedronGeometry args={[1, 2]} />
          <meshBasicMaterial
            color="#A8EAF0"
            wireframe
            transparent
            opacity={0.95}
            blending={THREE.AdditiveBlending}
          />
        </mesh>
      </group>

      {/* Illuminated Helmet Eyes */}
      <mesh ref={eyeLeftRef} position={[-0.045, 1.84, 0.145]} rotation={[0, 0, -0.14]} visible={false}>
        <planeGeometry args={[0.045, 0.014]} />
        <meshBasicMaterial color="#A8EAF0" transparent opacity={0} blending={THREE.AdditiveBlending} />
      </mesh>
      <mesh ref={eyeRightRef} position={[0.045, 1.84, 0.145]} rotation={[0, 0, 0.14]} visible={false}>
        <planeGeometry args={[0.045, 0.014]} />
        <meshBasicMaterial color="#A8EAF0" transparent opacity={0} blending={THREE.AdditiveBlending} />
      </mesh>

      {/* Concentric Holographic Reactor Rings */}
      <group position={[0, 1.36, 0.185]}>
        <mesh ref={reactorCoreRef} visible={false}>
          <circleGeometry args={[0.055, 24]} />
          <meshBasicMaterial color="#EDF5F7" transparent opacity={0.95} blending={THREE.AdditiveBlending} />
        </mesh>
        <mesh ref={ring1Ref} visible={false}>
          <ringGeometry args={[0.075, 0.088, 32]} />
          <meshBasicMaterial color="#53D9E8" transparent opacity={0.9} blending={THREE.AdditiveBlending} />
        </mesh>
        <mesh ref={ring2Ref} visible={false}>
          <ringGeometry args={[0.105, 0.115, 32]} />
          <meshBasicMaterial color="#38BDF8" transparent opacity={0.75} blending={THREE.AdditiveBlending} />
        </mesh>
        <mesh ref={ring3Ref} visible={false}>
          <ringGeometry args={[0.132, 0.14, 32]} />
          <meshBasicMaterial color="#A8EAF0" transparent opacity={0.55} blending={THREE.AdditiveBlending} />
        </mesh>
      </group>

      {/* Scene 4 Energy Blast */}
      <mesh ref={blastBeamRef} position={[0.55, 1.38, 0.65]} visible={false}>
        <icosahedronGeometry args={[0.5, 2]} />
        <meshBasicMaterial
          color="#53D9E8"
          wireframe
          transparent
          opacity={0}
          blending={THREE.AdditiveBlending}
        />
      </mesh>

      {/* 2,200 Disintegration & Orb Collapse Particles */}
      <points ref={particlesRef} geometry={particleGeo} visible={false}>
        <pointsMaterial
          color="#53D9E8"
          size={0.032}
          transparent
          opacity={0.85}
          blending={THREE.AdditiveBlending}
          depthWrite={false}
        />
      </points>
    </>
  );
}

export interface HolographicSuit3DProps {
  directorRef: React.MutableRefObject<HologramDirectorState>;
  isMobile: boolean;
  onWebGLError: () => void;
}

export function HolographicSuit3D({
  directorRef,
  isMobile,
  onWebGLError,
}: HolographicSuit3DProps) {
  return (
    <Canvas
      dpr={[1, isMobile ? 1.25 : 1.75]}
      camera={{ position: [0, 1.15, 5.8], fov: 46, near: 0.1, far: 80 }}
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
      <HolographicSceneContent directorRef={directorRef} isMobile={isMobile} />
    </Canvas>
  );
}

export default HolographicSuit3D;
