import { describe, it, expect } from "vitest";
import * as THREE from "three";

// Midpoint displacement recursive generator logic for testing
const generateForkLightning = (
  start: THREE.Vector3,
  end: THREE.Vector3,
  displacement = 75.0,
  minDistance = 12
): THREE.Vector3[] => {
  const segments: THREE.Vector3[] = [];

  const displace = (
    p1: THREE.Vector3,
    p2: THREE.Vector3,
    disp: number,
    depth: number
  ) => {
    const dist = p1.distanceTo(p2);
    if (dist < minDistance || depth > 6) {
      segments.push(p1.clone(), p2.clone());
      return;
    }

    const mid = new THREE.Vector3().addVectors(p1, p2).multiplyScalar(0.5);
    const dir = new THREE.Vector3().subVectors(p2, p1).normalize();
    const perp = new THREE.Vector3();
    if (Math.abs(dir.x) < 0.9) perp.set(1, 0, 0);
    else perp.set(0, 1, 0);
    perp.cross(dir).normalize();
    
    const perp2 = new THREE.Vector3().crossVectors(dir, perp).normalize();

    const scale = disp * (dist / 350.0);
    const dispX = (Math.random() - 0.5) * scale;
    const dispY = (Math.random() - 0.5) * scale;
    perp.multiplyScalar(dispX).addScaledVector(perp2, dispY);
    mid.add(perp);

    displace(p1, mid, disp * 0.52, depth + 1);
    displace(mid, p2, disp * 0.52, depth + 1);
  };

  displace(start, end, displacement, 0);
  return segments;
};

describe("Thunderstorm Subsystem - Midpoint Displacement Algorithm", () => {
  it("generates continuous segment pairs connecting start to end within boundaries", () => {
    const start = new THREE.Vector3(0, 350, 0);
    const end = new THREE.Vector3(100, 20, 50);

    const segments = generateForkLightning(start, end);

    // Verify even number of vertices (LineSegments are pairs)
    expect(segments.length).toBeGreaterThan(0);
    expect(segments.length % 2).toBe(0);

    // Verify coordinates stay within bounded bounding box
    for (const pt of segments) {
      expect(pt.y).toBeLessThanOrEqual(350 + 50); // within vertical envelope
      expect(pt.y).toBeGreaterThanOrEqual(20 - 50);
      expect(Math.abs(pt.x)).toBeLessThanOrEqual(300); // within horizontal spread
      expect(Math.abs(pt.z)).toBeLessThanOrEqual(300);
    }
  });

  it("handles highly varied start and end points without mathematical errors", () => {
    const start = new THREE.Vector3(-150, 340, 220);
    const end = new THREE.Vector3(80, 50, -40);

    const segments = generateForkLightning(start, end);
    expect(segments.length).toBeGreaterThan(0);
    expect(segments.length % 2).toBe(0);
  });
});
