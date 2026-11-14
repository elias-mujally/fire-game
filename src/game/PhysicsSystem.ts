import * as THREE from 'three';
import { RegionId } from './types';

export interface CylinderCollider {
  x: number;
  z: number;
  radius: number;
  height: number;
  yMin: number;
}

export interface BoxCollider {
  id?: string;
  minX: number;
  maxX: number;
  minZ: number;
  maxZ: number;
  maxY: number;
  active: boolean;
}

export interface HazardZone {
  x: number;
  z: number;
  radius: number;
  dps: number;
}

export class PhysicsSystem {
  public cylinders: CylinderCollider[] = [];
  public boxes: BoxCollider[] = [];
  public hazards: HazardZone[] = [];
  public readonly worldRadius = 260;

  public addCylinder(x: number, z: number, radius: number, height = 25, yMin = -10): void {
    this.cylinders.push({ x, z, radius, height, yMin });
  }

  public addBox(centerX: number, centerZ: number, width: number, depth: number, height = 25, id?: string): BoxCollider {
    const col: BoxCollider = {
      id,
      minX: centerX - width * 0.5,
      maxX: centerX + width * 0.5,
      minZ: centerZ - depth * 0.5,
      maxZ: centerZ + depth * 0.5,
      maxY: height,
      active: true
    };
    this.boxes.push(col);
    return col;
  }

  public addHazard(x: number, z: number, radius: number, dps = 12): void {
    this.hazards.push({ x, z, radius, dps });
  }

  /**
   * Continuous multi-region terrain height function:
   * - South (z > 30): MERIDIAN CITY (urban grid + sunken transit plaza)
   * - Center / East (-95 <= z <= 30): THE ASHEN WASTELANDS (rolling ash dunes + flattened Boss 1 arena at 95, -25)
   * - North (z < -95): NEXUS RESEARCH COMPLEX (synthetic obsidian basin + sunken Boss 2 arena at 0, -180)
   */
  public getTerrainHeight(x: number, z: number): number {
    if (z > 30) {
      const roadBlend = Math.min(1, Math.abs(x) / 14);
      return (Math.sin(x * 0.025) * 0.35 + Math.cos(z * 0.025) * 0.35) * roadBlend;
    }

    if (z < -95) {
      const distFromCore = Math.hypot(x, z + 180);
      if (distFromCore < 44) {
        return -2.2;
      }
      if (distFromCore < 56) {
        const t = (distFromCore - 44) / 12;
        return -2.2 + t * 1.2;
      }
      return -1.0 + Math.sin(x * 0.04) * 0.2;
    }

    const dunes =
      Math.sin(x * 0.035) * Math.cos(z * 0.035) * 2.2 +
      Math.sin(x * 0.075 - z * 0.055) * 0.75;

    // Flatten Iron Colossus Boss Arena around (95, -25)
    const distColossus = Math.hypot(x - 95, z + 25);
    if (distColossus < 38) {
      const blend = Math.max(0, (distColossus - 26) / 12);
      return dunes * blend * 0.65;
    }

    // Smooth corridor down center
    const corridorBlend = Math.min(1, Math.abs(x) / 16);
    return dunes * 0.65 * (0.25 + 0.75 * corridorBlend);
  }

  public getRegionAt(x: number, z: number): { id: RegionId; name: string } {
    if (z > 30) {
      return { id: 'MERIDIAN_CITY', name: 'Meridian City · Sector 01' };
    }
    if (z < -95) {
      return { id: 'NEXUS_COMPLEX', name: 'NEXUS Research Complex · Core Sector' };
    }
    return { id: 'ASHEN_WASTELANDS', name: 'The Ashen Wastelands · Industrial Scar' };
  }

  public resolveHorizontalCollision(pos: THREE.Vector3, radius: number): void {
    const distFromOrigin = Math.hypot(pos.x, pos.z);
    if (distFromOrigin > this.worldRadius) {
      const angle = Math.atan2(pos.z, pos.x);
      pos.x = Math.cos(angle) * this.worldRadius;
      pos.z = Math.sin(angle) * this.worldRadius;
    }

    for (let i = 0; i < this.cylinders.length; i++) {
      const c = this.cylinders[i];
      if (pos.y > c.height) continue;
      const dx = pos.x - c.x;
      const dz = pos.z - c.z;
      const distSq = dx * dx + dz * dz;
      const minDist = radius + c.radius;
      if (distSq < minDist * minDist && distSq > 0.00001) {
        const dist = Math.sqrt(distSq);
        const push = (minDist - dist) / dist;
        pos.x += dx * push;
        pos.z += dz * push;
      }
    }

    for (let i = 0; i < this.boxes.length; i++) {
      const b = this.boxes[i];
      if (!b.active || pos.y > b.maxY) continue;
      const closestX = Math.max(b.minX, Math.min(pos.x, b.maxX));
      const closestZ = Math.max(b.minZ, Math.min(pos.z, b.maxZ));
      const dx = pos.x - closestX;
      const dz = pos.z - closestZ;
      const distSq = dx * dx + dz * dz;

      if (distSq < radius * radius) {
        if (distSq > 0.0001) {
          const dist = Math.sqrt(distSq);
          pos.x += (dx / dist) * (radius - dist);
          pos.z += (dz / dist) * (radius - dist);
        } else {
          // Inside box: push out toward nearest edge
          const dLeft = Math.abs(pos.x - b.minX);
          const dRight = Math.abs(b.maxX - pos.x);
          const dTop = Math.abs(pos.z - b.minZ);
          const dBot = Math.abs(b.maxZ - pos.z);
          const minEdge = Math.min(dLeft, dRight, dTop, dBot);
          if (minEdge === dLeft) pos.x = b.minX - radius;
          else if (minEdge === dRight) pos.x = b.maxX + radius;
          else if (minEdge === dTop) pos.z = b.minZ - radius;
          else pos.z = b.maxZ + radius;
        }
      }
    }
  }

  /**
   * Prevents the third-person camera from clipping through terrain or solid buildings.
   */
  public resolveCameraCollision(target: THREE.Vector3, desiredCamPos: THREE.Vector3, outPos: THREE.Vector3): void {
    outPos.copy(desiredCamPos);
    const steps = 6;
    for (let i = 1; i <= steps; i++) {
      const t = i / steps;
      const px = target.x + (desiredCamPos.x - target.x) * t;
      const py = target.y + (desiredCamPos.y - target.y) * t;
      const pz = target.z + (desiredCamPos.z - target.z) * t;

      const groundY = this.getTerrainHeight(px, pz) + 0.55;
      if (py < groundY) {
        outPos.y = Math.max(outPos.y, groundY);
      }

      for (let bIdx = 0; bIdx < this.boxes.length; bIdx++) {
        const b = this.boxes[bIdx];
        if (!b.active || py > b.maxY) continue;
        if (px > b.minX - 0.35 && px < b.maxX + 0.35 && pz > b.minZ - 0.35 && pz < b.maxZ + 0.35) {
          const safeT = Math.max(0.25, (i - 1) / steps);
          outPos.set(
            target.x + (desiredCamPos.x - target.x) * safeT,
            Math.max(target.y + (desiredCamPos.y - target.y) * safeT, this.getTerrainHeight(px, pz) + 0.65),
            target.z + (desiredCamPos.z - target.z) * safeT
          );
          return;
        }
      }
    }
  }
}
