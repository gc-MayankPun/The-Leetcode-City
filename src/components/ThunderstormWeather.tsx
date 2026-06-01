"use client";

import { useRef, useMemo, useState, useEffect } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three";
import type { CityBuilding } from "@/lib/github";

/**
 * ============================================================================
 * ThunderstormWeather.tsx
 * ============================================================================
 * A highly performant, high-fidelity Three.js module implementing:
 * 1. Wind-Driven Rain: Dense particle system (1,200 points) falling fast and
 *    slanted laterally using a dynamic, shifting cosine wave for gusts.
 * 2. Lightning Flashes: Random PointLight intensity spikes syncing with full-scene
 *    ambient light flashes, communicating via custom DOM events to decouple shake.
 * 3. Procedural Fork Lightning: Midpoint displacement fractal algorithm drawing
 *    high-fidelity branching bolts to actual building rooftops.
 * ============================================================================
 */

const STORM_PARTICLE_COUNT = 1200;
const STORM_AREA = 2200;
const STORM_HALF_AREA = STORM_AREA / 2;
const STORM_TOP = 420;
const STORM_BOTTOM = 10;

const PRNG_MULTIPLIER = 12.9898;
const PRNG_SCALE = 43758.5453123;
const pseudoRandom = (seed: number) => {
  const x = Math.sin(seed * PRNG_MULTIPLIER) * PRNG_SCALE;
  return x - Math.floor(x);
};

const wrapAroundCenter = (value: number, center: number) => {
  const wrapped = ((value - center + STORM_HALF_AREA) % STORM_AREA + STORM_AREA) % STORM_AREA;
  return center + wrapped - STORM_HALF_AREA;
};

// Initial rain particle generator
const createInitialStormRainState = (centerX: number, centerZ: number) => {
  const positions = new Float32Array(STORM_PARTICLE_COUNT * 3);
  const speeds = new Float32Array(STORM_PARTICLE_COUNT);
  const anchorX = new Float32Array(STORM_PARTICLE_COUNT);
  const anchorZ = new Float32Array(STORM_PARTICLE_COUNT);
  const respawnCycles = new Uint32Array(STORM_PARTICLE_COUNT);

  for (let i = 0; i < STORM_PARTICLE_COUNT; i++) {
    const base = i * 3;
    anchorX[i] = centerX + (pseudoRandom(i * 3 + 1) - 0.5) * STORM_AREA;
    anchorZ[i] = centerZ + (pseudoRandom(i * 3 + 3) - 0.5) * STORM_AREA;
    positions[base] = anchorX[i];
    positions[base + 1] = STORM_BOTTOM + pseudoRandom(i * 3 + 2) * (STORM_TOP - STORM_BOTTOM);
    positions[base + 2] = anchorZ[i];
    speeds[i] = 220 + pseudoRandom(i * 3 + 4) * 180; // storm rain is faster
  }

  return { positions, speeds, anchorX, anchorZ, respawnCycles };
};

interface ThunderstormProps {
  buildings?: CityBuilding[];
  intensity?: number;
}

export const ThunderstormWeather = ({
  buildings = [],
  intensity = 1.0,
}: ThunderstormProps) => {
  const pointsRef = useRef<THREE.Points>(null);
  const flashLightRef = useRef<THREE.PointLight>(null);
  const ambientFlashLightRef = useRef<THREE.AmbientLight>(null);
  const boltGroupRef = useRef<THREE.Group>(null);
  
  const { camera } = useThree();

  // 1. Rain setup
  const [initialState] = useState(() =>
    createInitialStormRainState(camera.position.x, camera.position.z)
  );
  const anchorXRef = useRef(initialState.anchorX);
  const anchorZRef = useRef(initialState.anchorZ);
  const respawnCyclesRef = useRef(initialState.respawnCycles);

  // 2. Storm weather state
  const stormTimingRef = useRef({
    nextStrikeTime: 2.0, // strike in 2 seconds initially
    flashActive: false,
    flashIntensity: 0.0,
    climaxFired: false,
    strikeDuration: 0.0,
    elapsedSinceStrike: 0.0,
  });

  // Procedural Bolt Vertices State
  const [boltVertices, setBoltVertices] = useState<Float32Array>(new Float32Array(0));

  // Midpoint Displacement Generator for Fork Lightning
  const generateForkLightning = (start: THREE.Vector3, end: THREE.Vector3): THREE.Vector3[] => {
    const segments: THREE.Vector3[] = [];
    const minDistance = 12;

    const displace = (
      p1: THREE.Vector3,
      p2: THREE.Vector3,
      displacement: number,
      depth: number
    ) => {
      const dist = p1.distanceTo(p2);
      if (dist < minDistance || depth > 6) {
        segments.push(p1.clone(), p2.clone());
        return;
      }

      // Find midpoint
      const mid = new THREE.Vector3().addVectors(p1, p2).multiplyScalar(0.5);

      // Displace perpendicular to segment direction
      const dir = new THREE.Vector3().subVectors(p2, p1).normalize();
      const perp = new THREE.Vector3();
      if (Math.abs(dir.x) < 0.9) {
        perp.set(1, 0, 0);
      } else {
        perp.set(0, 1, 0);
      }
      perp.cross(dir).normalize();
      
      const perp2 = new THREE.Vector3().crossVectors(dir, perp).normalize();

      // Scale displacement based on segment length
      const scale = displacement * (dist / 350.0);
      const dispX = (pseudoRandom(depth * 31 + elapsedGlobal.current) - 0.5) * scale;
      const dispY = (pseudoRandom(depth * 53 + elapsedGlobal.current) - 0.5) * scale;
      perp.multiplyScalar(dispX).addScaledVector(perp2, dispY);
      mid.add(perp);

      // Recursive displacement
      displace(p1, mid, displacement * 0.52, depth + 1);
      displace(mid, p2, displacement * 0.52, depth + 1);

      // 30% chance of branching for realistic forks
      if (depth < 4 && pseudoRandom(depth * 17 + p1.x * 3) < 0.32) {
        const branchEnd = mid.clone();
        // Shoot branches outward and slightly downward
        branchEnd.x += (pseudoRandom(depth * 99) - 0.5) * 85;
        branchEnd.y -= (pseudoRandom(depth * 66)) * 75;
        branchEnd.z += (pseudoRandom(depth * 33) - 0.5) * 85;
        displace(mid, branchEnd, displacement * 0.4, depth + 1);
      }
    };

    displace(start, end, 75.0, 0);
    return segments;
  };

  const elapsedGlobal = useRef(0);

  // useFrame loops to drive rain kinetics, lightning timers, and shader updates
  useFrame((state, delta) => {
    elapsedGlobal.current = Math.floor(state.clock.getElapsedTime() * 1000);
    
    // --- A. Rain Kinetic Update (Slanted Lateral Wind) ---
    const pts = pointsRef.current;
    if (pts) {
      const positionArray = pts.geometry.attributes.position.array as Float32Array;
      const { speeds } = initialState;
      const anchorX = anchorXRef.current;
      const anchorZ = anchorZRef.current;
      const respawnCycles = respawnCyclesRef.current;

      const centerX = state.camera.position.x;
      const centerZ = state.camera.position.z;

      // Slow dynamic wind oscillation
      const windX = Math.sin(state.clock.getElapsedTime() * 0.15) * 55 * intensity;
      const windZ = Math.cos(state.clock.getElapsedTime() * 0.08) * 35 * intensity;

      for (let i = 0; i < STORM_PARTICLE_COUNT; i++) {
        const base = i * 3;

        // Apply a slanted lateral wind offset based on height layer (more slant as it falls)
        const slantFactor = (STORM_TOP - positionArray[base + 1]) / STORM_TOP;
        const currentX = anchorX[i] + windX * slantFactor;
        const currentZ = anchorZ[i] + windZ * slantFactor;

        positionArray[base] = wrapAroundCenter(currentX, centerX);
        positionArray[base + 2] = wrapAroundCenter(currentZ, centerZ);
        positionArray[base + 1] -= speeds[i] * delta;

        if (positionArray[base + 1] < STORM_BOTTOM) {
          respawnCycles[i] += 1;
          anchorX[i] = centerX + (pseudoRandom(i * 3 + respawnCycles[i] * 31) - 0.5) * STORM_AREA;
          anchorZ[i] = centerZ + (pseudoRandom(i * 5 + respawnCycles[i] * 53) - 0.5) * STORM_AREA;
          positionArray[base] = wrapAroundCenter(anchorX[i], centerX);
          positionArray[base + 1] = STORM_TOP;
          positionArray[base + 2] = wrapAroundCenter(anchorZ[i], centerZ);
        }
      }
      pts.geometry.attributes.position.needsUpdate = true;
    }

    // --- B. Lightning Flasher & Fork Controller ---
    const clockTime = state.clock.getElapsedTime();
    const tInfo = stormTimingRef.current;

    if (!tInfo.flashActive && clockTime >= tInfo.nextStrikeTime) {
      // ⚡ TRIGGER LIGHTNING EVENT
      tInfo.flashActive = true;
      tInfo.climaxFired = false;
      tInfo.strikeDuration = 0.5 + Math.random() * 0.45; // storm duration 500-950ms
      tInfo.elapsedSinceStrike = 0.0;

      // Select target rooftop dynamically
      const endPos = new THREE.Vector3(
        (Math.random() - 0.5) * 500,
        0,
        (Math.random() - 0.5) * 500
      );

      if (buildings.length > 0) {
        const targetB = buildings[Math.floor(Math.random() * buildings.length)];
        endPos.set(targetB.position[0], targetB.height, targetB.position[2]);
      }

      const startPos = new THREE.Vector3(
        endPos.x + (Math.random() - 0.5) * 180,
        340,
        endPos.z + (Math.random() - 0.5) * 180
      );

      // Position flash PointLight directly above destination
      if (flashLightRef.current) {
        flashLightRef.current.position.set(endPos.x, 250, endPos.z);
      }

      // Generate procedural vertices
      const segments = generateForkLightning(startPos, endPos);
      const arr = new Float32Array(segments.length * 3);
      for (let s = 0; s < segments.length; s++) {
        arr[s * 3 + 0] = segments[s].x;
        arr[s * 3 + 1] = segments[s].y;
        arr[s * 3 + 2] = segments[s].z;
      }
      setBoltVertices(arr);

      // Trigger high-performance window-decoupled Screen Shake event
      window.dispatchEvent(
        new CustomEvent("lc:thunder-flash", {
          detail: { intensity: intensity * 1.0 },
        })
      );
    }

    if (tInfo.flashActive) {
      tInfo.elapsedSinceStrike += delta;
      const progress = tInfo.elapsedSinceStrike / tInfo.strikeDuration;

      if (progress >= 1.0) {
        // --- End of Strike ---
        tInfo.flashActive = false;
        tInfo.flashIntensity = 0.0;
        setBoltVertices(new Float32Array(0));
        // Schedule next strike interval (4 to 9 seconds)
        tInfo.nextStrikeTime = clockTime + 4.0 + Math.random() * 5.0;
        if (boltGroupRef.current) {
          boltGroupRef.current.visible = false;
        }
      } else {
        // Realistic multi-burst double strike amplitude envelope
        let amplitude = 0.0;
        if (progress < 0.15) {
          // Initial high Climax flash (0.0 -> 1.0)
          amplitude = progress / 0.15;
        } else if (progress < 0.28) {
          // Fast drop/fade (1.0 -> 0.1)
          amplitude = 1.0 - ((progress - 0.15) / 0.13) * 0.9;
        } else if (progress < 0.45) {
          // Secondary restrike (0.1 -> 0.72)
          amplitude = 0.1 + ((progress - 0.28) / 0.17) * 0.62;
        } else {
          // Final decay (0.72 -> 0.0)
          amplitude = 0.72 * (1.0 - (progress - 0.45) / 0.55);
        }

        tInfo.flashIntensity = amplitude * intensity;

        // Animate plasma layered bolt visibility & opacity in-sync with envelope
        if (boltGroupRef.current) {
          const showFork = progress < 0.72;
          boltGroupRef.current.visible = showFork;
          boltGroupRef.current.children.forEach((child, idx) => {
            const line = child as THREE.LineSegments;
            const mat = line.material as THREE.LineBasicMaterial;
            const baseOpacity = idx === 0 ? 1.0 : idx === 1 ? 0.7 : 0.45;
            mat.opacity = tInfo.flashIntensity * baseOpacity;
          });
        }
      }
    }

    // Apply flash dynamic intensity in-place to dynamic light
    if (flashLightRef.current) {
      flashLightRef.current.intensity = tInfo.flashIntensity * 120 * intensity;
    }
    if (ambientFlashLightRef.current) {
      ambientFlashLightRef.current.intensity = tInfo.flashIntensity * 4.8 * intensity;
    }
  });

  // Build Procedural geometry inside useMemo safely
  const boltGeometry = useMemo(() => {
    const geo = new THREE.BufferGeometry();
    geo.setAttribute("position", new THREE.BufferAttribute(new Float32Array(0), 3));
    return geo;
  }, []);

  // Update line vertices on state updates
  useEffect(() => {
    if (boltVertices.length > 0) {
      boltGeometry.setAttribute(
        "position",
        new THREE.BufferAttribute(boltVertices, 3)
      );
    } else {
      boltGeometry.setAttribute(
        "position",
        new THREE.BufferAttribute(new Float32Array(0), 3)
      );
    }
  }, [boltVertices, boltGeometry]);

  // Clean up geometries on unmount
  useEffect(() => {
    return () => {
      boltGeometry.dispose();
    };
  }, [boltGeometry]);

  return (
    <group name="subsystem-thunderstorm-weather">
      {/* 1. Fast slanted point-cloud rain */}
      <points ref={pointsRef} frustumCulled={false}>
        <bufferGeometry>
          <bufferAttribute attach="attributes-position" args={[initialState.positions, 3]} />
        </bufferGeometry>
        <pointsMaterial
          color="#8ca8df"
          size={5}
          sizeAttenuation={false}
          transparent
          opacity={0.65 * intensity}
          depthWrite={false}
        />
      </points>

      {/* 2. Lightning flash PointLight positioned above rooftops */}
      <pointLight
        ref={flashLightRef}
        color="#e3f0ff"
        intensity={0}
        distance={1500}
        decay={1.2}
      />

      {/* 2b. Dynamic full-screen ambient illumination flash */}
      <ambientLight
        ref={ambientFlashLightRef}
        color="#d1e7ff"
        intensity={0}
      />

      {/* 3. Procedural branching fork lightning line segments (Thicker neon plasma effect) */}
      <group ref={boltGroupRef}>
        {/* Core Bolt - Pure white core */}
        <lineSegments geometry={boltGeometry}>
          <lineBasicMaterial
            color="#ffffff"
            transparent
            blending={THREE.AdditiveBlending}
            depthWrite={false}
            opacity={0}
          />
        </lineSegments>
        {/* Glow Shell 1 - Bright electric cyan */}
        <lineSegments geometry={boltGeometry} position={[0.45, 0, 0.45]}>
          <lineBasicMaterial
            color="#3cd5ff"
            transparent
            blending={THREE.AdditiveBlending}
            depthWrite={false}
            opacity={0}
          />
        </lineSegments>
        {/* Glow Shell 2 - Vibrant neon blue */}
        <lineSegments geometry={boltGeometry} position={[-0.45, 0, -0.45]}>
          <lineBasicMaterial
            color="#0088ff"
            transparent
            blending={THREE.AdditiveBlending}
            depthWrite={false}
            opacity={0}
          />
        </lineSegments>
      </group>
    </group>
  );
};

export default ThunderstormWeather;
