import * as THREE from 'three';

interface ActiveEffect {
  mesh: THREE.Object3D;
  life: number;
  maxLife: number;
  type: 'beam' | 'ring' | 'slash' | 'spark';
  velocity?: THREE.Vector3;
  expandSpeed?: number;
}

export class VfxSystem {
  private scene: THREE.Scene;
  private effects: ActiveEffect[] = [];

  private sparkGeo = new THREE.OctahedronGeometry(0.09, 0);
  private beamGeo = new THREE.CylinderGeometry(0.045, 0.045, 1, 6);
  private ringGeo = new THREE.RingGeometry(0.65, 1.0, 32);
  private slashGeo = new THREE.TorusGeometry(1.5, 0.08, 6, 20, Math.PI * 0.85);

  constructor(scene: THREE.Scene) {
    this.scene = scene;
    this.beamGeo.rotateX(Math.PI / 2);
    this.ringGeo.rotateX(-Math.PI / 2);
  }

  public spawnBeam(start: THREE.Vector3, end: THREE.Vector3, colorHex: number, thickness = 1, duration = 0.14): void {
    const dist = start.distanceTo(end);
    if (dist < 0.05) return;
    const mat = new THREE.MeshBasicMaterial({
      color: colorHex,
      transparent: true,
      opacity: 0.92
    });
    const mesh = new THREE.Mesh(this.beamGeo, mat);
    mesh.scale.set(thickness, thickness, dist);
    mesh.position.copy(start).lerp(end, 0.5);
    mesh.lookAt(end);
    this.scene.add(mesh);

    this.effects.push({
      mesh,
      life: duration,
      maxLife: duration,
      type: 'beam'
    });
  }

  public spawnShockwaveRing(center: THREE.Vector3, colorHex: number, expandSpeed = 22, duration = 0.45): void {
    const mat = new THREE.MeshBasicMaterial({
      color: colorHex,
      side: THREE.DoubleSide,
      transparent: true,
      opacity: 0.85
    });
    const mesh = new THREE.Mesh(this.ringGeo, mat);
    mesh.position.set(center.x, center.y + 0.18, center.z);
    this.scene.add(mesh);

    this.effects.push({
      mesh,
      life: duration,
      maxLife: duration,
      type: 'ring',
      expandSpeed
    });
  }

  public spawnSlashArc(pos: THREE.Vector3, yaw: number, comboStep: number, heavy: boolean): void {
    const mat = new THREE.MeshBasicMaterial({
      color: heavy ? 0xff9d00 : 0x00f0ff,
      transparent: true,
      opacity: 0.9
    });
    const mesh = new THREE.Mesh(this.slashGeo, mat);
    mesh.position.set(pos.x, pos.y + 1.15, pos.z);
    mesh.rotation.y = yaw - Math.PI * 0.4;
    mesh.rotation.x = Math.PI / 2 + (comboStep % 2 === 0 ? 0.25 : -0.25);
    if (heavy) mesh.scale.setScalar(1.45);
    this.scene.add(mesh);

    this.effects.push({
      mesh,
      life: 0.2,
      maxLife: 0.2,
      type: 'slash'
    });
  }

  public spawnHitSparks(pos: THREE.Vector3, colorHex: number, count = 8): void {
    for (let i = 0; i < count; i++) {
      const mat = new THREE.MeshBasicMaterial({
        color: colorHex,
        transparent: true,
        opacity: 1
      });
      const mesh = new THREE.Mesh(this.sparkGeo, mat);
      mesh.position.copy(pos);
      this.scene.add(mesh);

      const vel = new THREE.Vector3(
        (Math.random() - 0.5) * 9,
        Math.random() * 6 + 1.5,
        (Math.random() - 0.5) * 9
      );
      this.effects.push({
        mesh,
        life: 0.35 + Math.random() * 0.15,
        maxLife: 0.5,
        type: 'spark',
        velocity: vel
      });
    }
  }

  public update(dt: number): void {
    for (let i = this.effects.length - 1; i >= 0; i--) {
      const fx = this.effects[i];
      fx.life -= dt;
      const ratio = Math.max(0, fx.life / fx.maxLife);

      if (fx.type === 'ring' && fx.expandSpeed) {
        const s = 1 + (1 - ratio) * fx.expandSpeed;
        fx.mesh.scale.setScalar(s);
      } else if (fx.type === 'slash') {
        fx.mesh.rotation.z += dt * 10;
      } else if (fx.type === 'spark' && fx.velocity) {
        fx.velocity.y -= 16 * dt;
        fx.mesh.position.addScaledVector(fx.velocity, dt);
      }

      if (fx.mesh instanceof THREE.Mesh && fx.mesh.material instanceof THREE.Material) {
        fx.mesh.material.opacity = ratio;
      }

      if (fx.life <= 0) {
        this.scene.remove(fx.mesh);
        if (fx.mesh instanceof THREE.Mesh && fx.mesh.material instanceof THREE.Material) {
          fx.mesh.material.dispose();
        }
        this.effects.splice(i, 1);
      }
    }
  }
}
