import * as THREE from 'three';
import { EnemyArchetype } from './types';
import { PhysicsSystem } from './PhysicsSystem';
import { PlayerController } from './PlayerController';
import { AudioSystem } from './AudioSystem';
import { VfxSystem } from './VfxSystem';
import { createCarbonArmorTexture, createContactShadowTexture, createPanelNormalMap } from './Textures';

export interface EnemyInstance {
  id: string;
  archetype: EnemyArchetype;
  name: string;
  hp: number;
  maxHp: number;
  stagger: number;
  maxStagger: number;
  state: 'PATROL' | 'PURSUE' | 'ATTACK' | 'RETREAT' | 'STAGGERED' | 'DEAD';
  position: THREE.Vector3;
  homePos: THREE.Vector3;
  patrolTarget: THREE.Vector3;
  rotationY: number;
  speed: number;
  detectRange: number;
  attackRange: number;
  baseDamage: number;
  attackCooldown: number;
  specialCooldown: number;
  staggerTimer: number;
  hitRadius: number;
  heightOffset: number;
  xpValue: number;
  phase: number;
  introShown: boolean;
  summonDone: boolean;
  animPhase: number;
  mesh: THREE.Group;
  weakPointMesh?: THREE.Mesh;
}

export class EnemyManager {
  public enemies: EnemyInstance[] = [];
  private scene: THREE.Scene;
  private physics: PhysicsSystem;
  private idCounter = 0;

  // High-detail sculpted PBR materials with carbon weave & normal relief
  private darkMetalMat: THREE.MeshPhysicalMaterial;
  private armorPlateMat: THREE.MeshPhysicalMaterial;
  private titanArmorMat: THREE.MeshPhysicalMaterial;
  private fleshMat: THREE.MeshPhysicalMaterial;
  private carapaceMat: THREE.MeshPhysicalMaterial;
  private chromeJointMat: THREE.MeshStandardMaterial;
  private eyeRedMat: THREE.MeshBasicMaterial;
  private eyeAmberMat: THREE.MeshBasicMaterial;
  private coreCyanMat: THREE.MeshBasicMaterial;
  private bioGlowMat: THREE.MeshBasicMaterial;
  private shadowTex: THREE.CanvasTexture;

  constructor(scene: THREE.Scene, physics: PhysicsSystem) {
    this.scene = scene;
    this.physics = physics;

    const armorTex = createCarbonArmorTexture(4);
    const normalMap = createPanelNormalMap();
    this.shadowTex = createContactShadowTexture();

    this.darkMetalMat = new THREE.MeshPhysicalMaterial({
      color: 0x1e2636,
      map: armorTex,
      normalMap,
      normalScale: new THREE.Vector2(0.45, 0.45),
      roughness: 0.34,
      metalness: 0.85,
      clearcoat: 0.3
    });

    this.armorPlateMat = new THREE.MeshPhysicalMaterial({
      color: 0x334155,
      map: armorTex,
      normalMap,
      normalScale: new THREE.Vector2(0.55, 0.55),
      roughness: 0.28,
      metalness: 0.8,
      clearcoat: 0.45,
      clearcoatRoughness: 0.2
    });

    this.titanArmorMat = new THREE.MeshPhysicalMaterial({
      color: 0x263142,
      map: armorTex,
      normalMap,
      normalScale: new THREE.Vector2(0.7, 0.7),
      roughness: 0.26,
      metalness: 0.88,
      clearcoat: 0.55
    });

    this.fleshMat = new THREE.MeshPhysicalMaterial({
      color: 0x421d2f,
      normalMap,
      normalScale: new THREE.Vector2(0.75, 0.75),
      roughness: 0.42,
      metalness: 0.15,
      clearcoat: 0.7,
      clearcoatRoughness: 0.22
    });

    this.carapaceMat = new THREE.MeshPhysicalMaterial({
      color: 0x1d1124,
      normalMap,
      normalScale: new THREE.Vector2(0.6, 0.6),
      roughness: 0.24,
      metalness: 0.42,
      clearcoat: 0.82
    });

    this.chromeJointMat = new THREE.MeshStandardMaterial({
      color: 0x64748b,
      roughness: 0.22,
      metalness: 0.92
    });

    this.eyeRedMat = new THREE.MeshBasicMaterial({ color: 0xff2a54 });
    this.eyeAmberMat = new THREE.MeshBasicMaterial({ color: 0xff9d00 });
    this.coreCyanMat = new THREE.MeshBasicMaterial({ color: 0x00f0ff });
    this.bioGlowMat = new THREE.MeshBasicMaterial({ color: 0xb845ff });
  }

  public clearAll(): void {
    for (const e of this.enemies) {
      this.scene.remove(e.mesh);
    }
    this.enemies = [];
  }

  public spawnInitialPopulation(defeatedBosses: string[]): void {
    this.clearAll();

    // Region A: Meridian City (z > 30)
    this.spawnEnemy('SCOUT_DRONE', 'Meridian Recon Drone', -14, 132);
    this.spawnEnemy('SCOUT_DRONE', 'Plaza Overwatch Drone', 15, 118);
    this.spawnEnemy('HUNTER_MACHINE', 'MK-II Stalker Unit', -8, 102);
    this.spawnEnemy('HUNTER_MACHINE', 'Transit Enforcer', 12, 76);
    this.spawnEnemy('HEAVY_GUARDIAN', 'Meridian Aegis Bastion', 0, 56);

    // Region B: The Ashen Wastelands (-95 <= z <= 30)
    this.spawnEnemy('MUTATED_CREATURE', 'Ashen Xeno-Ravager', -24, 12);
    this.spawnEnemy('MUTATED_CREATURE', 'Fissure Stalker', -16, -24);
    this.spawnEnemy('HUNTER_MACHINE', 'Outpost Sentinel', 26, 4);
    this.spawnEnemy('SCOUT_DRONE', 'Wasteland Telemetry Drone', 38, -18);
    this.spawnEnemy('HEAVY_GUARDIAN', 'Silo Siege Warden', -34, -52);

    // Boss 1: The Iron Colossus in Eastern Wastelands Arena (95, -25)
    if (!defeatedBosses.includes('BOSS_COLOSSUS')) {
      this.spawnEnemy('BOSS_COLOSSUS', 'THE IRON COLOSSUS', 95, -25);
    }

    // Region C: NEXUS Research Complex (z < -95)
    this.spawnEnemy('HUNTER_MACHINE', 'Sanctum Phantom', -14, -124);
    this.spawnEnemy('HUNTER_MACHINE', 'Sanctum Spectre', 14, -124);
    this.spawnEnemy('HEAVY_GUARDIAN', 'Core Gate Juggernaut', 0, -142);

    // Boss 2: NEXUS Prime in Core Chamber (0, -180)
    if (!defeatedBosses.includes('BOSS_NEXUS')) {
      this.spawnEnemy('BOSS_NEXUS', 'NEXUS PRIME', 0, -180);
    }
  }

  public spawnEnemy(archetype: EnemyArchetype, name: string, x: number, z: number): EnemyInstance {
    const id = `enemy_${++this.idCounter}`;
    const y = this.physics.getTerrainHeight(x, z);
    const group = new THREE.Group();

    // Contact shadow disc
    const shadowSize = archetype.startsWith('BOSS') ? 5.2 : archetype === 'HEAVY_GUARDIAN' ? 2.4 : 1.5;
    const shadowPlane = new THREE.Mesh(
      new THREE.PlaneGeometry(shadowSize, shadowSize),
      new THREE.MeshBasicMaterial({
        map: this.shadowTex,
        transparent: true,
        depthWrite: false,
        opacity: 0.68
      })
    );
    shadowPlane.rotation.x = -Math.PI / 2;
    shadowPlane.position.y = 0.04;
    group.add(shadowPlane);

    let weakPointMesh: THREE.Mesh | undefined;
    let maxHp = 110;
    let maxStagger = 70;
    let speed = 6.2;
    let detectRange = 28;
    let attackRange = 2.8;
    let baseDamage = 14;
    let hitRadius = 0.9;
    let heightOffset = 1.2;
    let xpValue = 65;

    if (archetype === 'SCOUT_DRONE') {
      maxHp = 95;
      maxStagger = 50;
      speed = 7.4;
      detectRange = 30;
      attackRange = 17.5;
      baseDamage = 11;
      hitRadius = 0.85;
      heightOffset = 2.4;
      xpValue = 55;

      const hoverBody = new THREE.Group();
      hoverBody.position.y = 2.4;
      hoverBody.name = 'hover_body';

      // Sculpted aerodynamic saucer hull (`SphereGeometry` + `TorusGeometry` shroud)
      const hullGeo = new THREE.SphereGeometry(0.62, 24, 16);
      hullGeo.scale(1.12, 0.44, 1.25);
      const hull = new THREE.Mesh(hullGeo, this.armorPlateMat);
      hull.castShadow = true;
      hoverBody.add(hull);

      const upperDome = new THREE.Mesh(
        new THREE.SphereGeometry(0.35, 18, 12, 0, Math.PI * 2, 0, Math.PI * 0.55),
        this.darkMetalMat
      );
      upperDome.position.y = 0.14;
      hoverBody.add(upperDome);

      // Glowing optical sensor eye + lens bezel
      const bezel = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.2, 0.14, 16), this.chromeJointMat);
      bezel.rotation.x = Math.PI / 2;
      bezel.position.set(0, -0.02, 0.72);
      hoverBody.add(bezel);

      const eye = new THREE.Mesh(new THREE.SphereGeometry(0.13, 14, 14), this.eyeRedMat);
      eye.position.set(0, -0.02, 0.76);
      hoverBody.add(eye);
      weakPointMesh = eye;

      // Twin ducted turbofan thrusters on swept pylons
      for (const side of [-1, 1]) {
        const pylon = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.045, 0.55, 8), this.chromeJointMat);
        pylon.rotation.z = Math.PI / 2;
        pylon.position.set(side * 0.65, 0.05, -0.05);
        hoverBody.add(pylon);

        const duct = new THREE.Mesh(new THREE.TorusGeometry(0.26, 0.055, 10, 20), this.darkMetalMat);
        duct.rotation.x = Math.PI / 2;
        duct.rotation.y = side * 0.15;
        duct.position.set(side * 0.9, 0.08, -0.05);
        hoverBody.add(duct);

        const rotorDisc = new THREE.Mesh(new THREE.CylinderGeometry(0.21, 0.21, 0.02, 14), this.coreCyanMat);
        rotorDisc.position.set(side * 0.9, 0.08, -0.05);
        hoverBody.add(rotorDisc);
      }

      // Underslung plasma barrel
      const barrel = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.05, 0.56, 10), this.chromeJointMat);
      barrel.rotation.x = Math.PI / 2;
      barrel.position.set(0, -0.26, 0.45);
      hoverBody.add(barrel);

      group.add(hoverBody);
    } else if (archetype === 'HUNTER_MACHINE') {
      maxHp = 155;
      maxStagger = 80;
      speed = 8.4;
      detectRange = 28;
      attackRange = 2.9;
      baseDamage = 18;
      hitRadius = 0.9;
      heightOffset = 1.35;
      xpValue = 80;

      // Sculpted bipedal agile assassin chassis (`LatheGeometry`)
      const torsoPoints = [
        new THREE.Vector2(0.01, 0.85),
        new THREE.Vector2(0.22, 0.95),
        new THREE.Vector2(0.18, 1.22),
        new THREE.Vector2(0.34, 1.52),
        new THREE.Vector2(0.26, 1.72),
        new THREE.Vector2(0.01, 1.78)
      ];
      const torsoGeo = new THREE.LatheGeometry(torsoPoints, 16);
      torsoGeo.scale(1.0, 1.0, 0.72);
      const torso = new THREE.Mesh(torsoGeo, this.darkMetalMat);
      torso.castShadow = true;
      group.add(torso);

      // Angled predator carapace cowl
      const headGroup = new THREE.Group();
      headGroup.position.set(0, 1.88, 0.08);
      const skull = new THREE.Mesh(new THREE.ConeGeometry(0.22, 0.52, 12), this.armorPlateMat);
      skull.rotation.x = Math.PI * 0.58;
      headGroup.add(skull);

      const visor = new THREE.Mesh(new THREE.SphereGeometry(0.14, 12, 10), this.eyeAmberMat);
      visor.scale.set(1.3, 0.45, 0.8);
      visor.position.set(0, -0.02, 0.2);
      headGroup.add(visor);
      weakPointMesh = visor;
      group.add(headGroup);

      // Curved mantis plasma scythe blades (`ExtrudeGeometry`)
      const bladeShape = new THREE.Shape();
      bladeShape.moveTo(0, 0);
      bladeShape.quadraticCurveTo(0.08, -0.35, 0.22, -0.75);
      bladeShape.lineTo(0.12, -0.78);
      bladeShape.quadraticCurveTo(0.0, -0.38, -0.05, 0);
      bladeShape.closePath();
      const bladeGeo = new THREE.ExtrudeGeometry(bladeShape, {
        depth: 0.025,
        bevelEnabled: true,
        bevelThickness: 0.008,
        bevelSize: 0.008,
        bevelSegments: 2
      });

      for (const side of [-1, 1]) {
        const armGroup = new THREE.Group();
        armGroup.position.set(side * 0.36, 1.54, 0.05);
        armGroup.name = side === -1 ? 'left_arm' : 'right_arm';

        const shoulder = new THREE.Mesh(new THREE.SphereGeometry(0.13, 12, 10), this.armorPlateMat);
        armGroup.add(shoulder);

        const upperArm = new THREE.Mesh(new THREE.CapsuleGeometry(0.065, 0.32, 6, 10), this.darkMetalMat);
        upperArm.position.set(side * 0.05, -0.2, 0.12);
        upperArm.rotation.x = -0.5;
        armGroup.add(upperArm);

        const blade = new THREE.Mesh(bladeGeo, this.eyeAmberMat);
        blade.rotation.y = Math.PI / 2;
        blade.position.set(side * 0.06, -0.28, 0.25);
        armGroup.add(blade);
        group.add(armGroup);

        // Articulated reverse-jointed hydraulic legs
        const legGroup = new THREE.Group();
        legGroup.position.set(side * 0.22, 0.9, 0);
        legGroup.name = side === -1 ? 'left_leg' : 'right_leg';

        const thigh = new THREE.Mesh(new THREE.CapsuleGeometry(0.095, 0.36, 8, 12), this.armorPlateMat);
        thigh.position.set(0, -0.22, 0.06);
        thigh.rotation.x = -0.3;
        legGroup.add(thigh);

        const knee = new THREE.Mesh(new THREE.SphereGeometry(0.09, 10, 10), this.chromeJointMat);
        knee.position.set(0, -0.44, 0.14);
        legGroup.add(knee);

        const shin = new THREE.Mesh(new THREE.CylinderGeometry(0.075, 0.045, 0.48, 10), this.darkMetalMat);
        shin.position.set(0, -0.66, 0.04);
        shin.rotation.x = 0.25;
        legGroup.add(shin);

        group.add(legGroup);
      }
    } else if (archetype === 'HEAVY_GUARDIAN') {
      maxHp = 320;
      maxStagger = 120;
      speed = 4.3;
      detectRange = 26;
      attackRange = 3.5;
      baseDamage = 28;
      hitRadius = 1.35;
      heightOffset = 1.65;
      xpValue = 135;

      // Hulking domed juggernaut chassis
      const torso = new THREE.Mesh(new THREE.CylinderGeometry(0.68, 0.52, 1.35, 16), this.titanArmorMat);
      torso.scale.set(1.15, 1.0, 0.85);
      torso.position.y = 1.65;
      torso.castShadow = true;
      group.add(torso);

      const hunch = new THREE.Mesh(
        new THREE.SphereGeometry(0.72, 18, 14, 0, Math.PI * 2, 0, Math.PI * 0.55),
        this.armorPlateMat
      );
      hunch.scale.set(1.1, 0.75, 0.9);
      hunch.position.y = 2.22;
      group.add(hunch);

      const helm = new THREE.Mesh(new THREE.CylinderGeometry(0.26, 0.3, 0.36, 14), this.darkMetalMat);
      helm.position.set(0, 2.38, 0.32);
      group.add(helm);

      const slit = new THREE.Mesh(
        new THREE.CylinderGeometry(0.27, 0.27, 0.07, 14, 1, false, -0.8, 1.6),
        this.eyeRedMat
      );
      slit.position.set(0, 2.4, 0.33);
      group.add(slit);

      // Glowing turbine chest core (weak point)
      const coreRing = new THREE.Mesh(new THREE.TorusGeometry(0.24, 0.05, 10, 20), this.chromeJointMat);
      coreRing.position.set(0, 1.72, 0.58);
      group.add(coreRing);

      const core = new THREE.Mesh(new THREE.SphereGeometry(0.2, 16, 16), this.eyeAmberMat);
      core.position.set(0, 1.72, 0.56);
      group.add(core);
      weakPointMesh = core;

      // Left arm: Curved Riot Aegis Shield (`CylinderGeometry` arc segment)
      const leftArm = new THREE.Group();
      leftArm.position.set(-0.88, 1.95, 0.1);
      leftArm.name = 'left_arm';
      const pauldronL = new THREE.Mesh(new THREE.SphereGeometry(0.34, 14, 12), this.armorPlateMat);
      leftArm.add(pauldronL);

      const shieldGeo = new THREE.CylinderGeometry(0.75, 0.68, 1.55, 16, 1, true, -0.75, 1.5);
      const shield = new THREE.Mesh(shieldGeo, this.titanArmorMat);
      shield.rotation.y = -Math.PI * 0.35;
      shield.position.set(-0.18, -0.35, 0.38);
      shield.castShadow = true;
      leftArm.add(shield);
      group.add(leftArm);

      // Right arm: Kinetic Siege Hammer
      const rightArm = new THREE.Group();
      rightArm.position.set(0.88, 1.95, 0.1);
      rightArm.name = 'right_arm';
      const pauldronR = new THREE.Mesh(new THREE.SphereGeometry(0.34, 14, 12), this.armorPlateMat);
      rightArm.add(pauldronR);

      const forearmR = new THREE.Mesh(new THREE.CapsuleGeometry(0.18, 0.55, 8, 14), this.darkMetalMat);
      forearmR.position.set(0.08, -0.42, 0.18);
      forearmR.rotation.x = -0.4;
      rightArm.add(forearmR);

      const hammerShaft = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 1.2, 10), this.chromeJointMat);
      hammerShaft.rotation.x = Math.PI / 2;
      hammerShaft.position.set(0.08, -0.65, 0.55);
      rightArm.add(hammerShaft);

      const hammerHead = new THREE.Mesh(new THREE.CylinderGeometry(0.24, 0.24, 0.62, 14), this.titanArmorMat);
      hammerHead.rotation.z = Math.PI / 2;
      hammerHead.position.set(0.08, -0.65, 1.05);
      rightArm.add(hammerHead);
      group.add(rightArm);

      for (const side of [-1, 1]) {
        const legGroup = new THREE.Group();
        legGroup.position.set(side * 0.42, 1.0, 0);
        legGroup.name = side === -1 ? 'left_leg' : 'right_leg';

        const legCyl = new THREE.Mesh(new THREE.CylinderGeometry(0.24, 0.28, 0.95, 14), this.darkMetalMat);
        legCyl.position.y = -0.48;
        legCyl.castShadow = true;
        legGroup.add(legCyl);

        const foot = new THREE.Mesh(new THREE.CylinderGeometry(0.28, 0.34, 0.2, 12), this.armorPlateMat);
        foot.scale.set(1.0, 1.0, 1.3);
        foot.position.set(0, -0.9, 0.08);
        legGroup.add(foot);
        group.add(legGroup);
      }
    } else if (archetype === 'MUTATED_CREATURE') {
      maxHp = 180;
      maxStagger = 75;
      speed = 9.2;
      detectRange = 30;
      attackRange = 2.7;
      baseDamage = 20;
      hitRadius = 1.0;
      heightOffset = 1.1;
      xpValue = 95;

      // Organic alien predator with arched segmented carapace and articulated limbs
      const thoraxPoints = [
        new THREE.Vector2(0.01, 0.0),
        new THREE.Vector2(0.28, 0.25),
        new THREE.Vector2(0.38, 0.65),
        new THREE.Vector2(0.32, 1.05),
        new THREE.Vector2(0.18, 1.35),
        new THREE.Vector2(0.01, 1.5)
      ];
      const thoraxGeo = new THREE.LatheGeometry(thoraxPoints, 16);
      const thorax = new THREE.Mesh(thoraxGeo, this.fleshMat);
      thorax.rotation.x = Math.PI * 0.45;
      thorax.position.set(0, 0.95, -0.45);
      thorax.castShadow = true;
      group.add(thorax);

      for (let i = 0; i < 4; i++) {
        const shell = new THREE.Mesh(new THREE.SphereGeometry(0.32 - i * 0.04, 12, 10), this.carapaceMat);
        shell.scale.set(1.1, 0.45, 1.2);
        shell.position.set(0, 1.12 - i * 0.05, 0.25 - i * 0.28);
        group.add(shell);

        const spine = new THREE.Mesh(new THREE.ConeGeometry(0.07, 0.46, 8), this.bioGlowMat);
        spine.rotation.x = -0.35;
        spine.position.set(0, 1.34 - i * 0.05, 0.22 - i * 0.28);
        group.add(spine);
        if (i === 1) weakPointMesh = spine;
      }

      const head = new THREE.Mesh(new THREE.CapsuleGeometry(0.18, 0.42, 8, 12), this.carapaceMat);
      head.rotation.x = Math.PI * 0.42;
      head.position.set(0, 1.12, 0.65);
      group.add(head);

      for (const side of [-1, 1]) {
        const eye = new THREE.Mesh(new THREE.SphereGeometry(0.055, 8, 8), this.eyeRedMat);
        eye.position.set(side * 0.13, 1.16, 0.82);
        group.add(eye);

        for (const fb of [-1, 1]) {
          const limb = new THREE.Group();
          limb.position.set(side * 0.34, 0.88, fb * 0.36);
          limb.name = fb === 1 ? (side === -1 ? 'left_arm' : 'right_arm') : (side === -1 ? 'left_leg' : 'right_leg');

          const upper = new THREE.Mesh(new THREE.CapsuleGeometry(0.09, 0.42, 6, 10), this.fleshMat);
          upper.position.set(side * 0.14, -0.2, fb * 0.08);
          upper.rotation.z = side * 0.45;
          limb.add(upper);

          const lower = new THREE.Mesh(new THREE.CapsuleGeometry(0.065, 0.45, 6, 10), this.carapaceMat);
          lower.position.set(side * 0.24, -0.58, fb * 0.12);
          lower.rotation.z = -side * 0.15;
          limb.add(lower);

          const claw = new THREE.Mesh(new THREE.ConeGeometry(0.06, 0.24, 6), this.chromeJointMat);
          claw.rotation.x = Math.PI * 0.65;
          claw.position.set(side * 0.22, -0.82, fb * 0.12 + 0.1);
          limb.add(claw);

          group.add(limb);
        }
      }
    } else if (archetype === 'BOSS_COLOSSUS') {
      maxHp = 1150;
      maxStagger = 180;
      speed = 4.6;
      detectRange = 42;
      attackRange = 6.2;
      baseDamage = 36;
      hitRadius = 2.6;
      heightOffset = 3.4;
      xpValue = 450;

      // Towering multi-part War Walker Mech ("THE IRON COLOSSUS")
      const pelvis = new THREE.Mesh(new THREE.CylinderGeometry(1.1, 0.95, 0.7, 12), this.darkMetalMat);
      pelvis.position.y = 2.2;
      pelvis.castShadow = true;
      group.add(pelvis);

      const hull = new THREE.Mesh(new THREE.CylinderGeometry(1.45, 1.65, 2.1, 8), this.titanArmorMat);
      hull.scale.set(1.15, 1.0, 0.92);
      hull.position.y = 3.55;
      hull.castShadow = true;
      group.add(hull);

      const dome = new THREE.Mesh(
        new THREE.SphereGeometry(1.1, 18, 12, 0, Math.PI * 2, 0, Math.PI * 0.5),
        this.armorPlateMat
      );
      dome.position.y = 4.55;
      group.add(dome);

      const sensorPod = new THREE.Mesh(new THREE.CylinderGeometry(0.55, 0.65, 0.5, 14), this.darkMetalMat);
      sensorPod.position.set(0, 4.85, 0.45);
      group.add(sensorPod);

      const visor = new THREE.Mesh(
        new THREE.CylinderGeometry(0.58, 0.58, 0.16, 16, 1, false, -0.9, 1.8),
        this.eyeRedMat
      );
      visor.position.set(0, 4.86, 0.46);
      group.add(visor);

      const turbineHousing = new THREE.Mesh(new THREE.TorusGeometry(0.68, 0.14, 12, 24), this.chromeJointMat);
      turbineHousing.position.set(0, 3.5, 1.38);
      turbineHousing.name = 'colossus_turbine';
      group.add(turbineHousing);

      const reactorCore = new THREE.Mesh(new THREE.SphereGeometry(0.52, 20, 20), this.eyeAmberMat);
      reactorCore.position.set(0, 3.5, 1.32);
      group.add(reactorCore);
      weakPointMesh = reactorCore;

      for (const side of [-1, 1]) {
        const pod = new THREE.Group();
        pod.position.set(side * 1.85, 4.65, 0.1);
        const podHousing = new THREE.Mesh(new THREE.CylinderGeometry(0.46, 0.52, 1.3, 12), this.armorPlateMat);
        podHousing.rotation.x = Math.PI / 2;
        pod.add(podHousing);

        for (let b = 0; b < 4; b++) {
          const angle = (b / 4) * Math.PI * 2;
          const barrel = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.08, 1.4, 8), this.chromeJointMat);
          barrel.rotation.x = Math.PI / 2;
          barrel.position.set(Math.cos(angle) * 0.2, Math.sin(angle) * 0.2, 0.65);
          pod.add(barrel);
        }
        group.add(pod);

        const armGroup = new THREE.Group();
        armGroup.position.set(side * 2.0, 3.65, 0.2);
        armGroup.name = side === -1 ? 'left_arm' : 'right_arm';

        const shoulder = new THREE.Mesh(new THREE.SphereGeometry(0.48, 14, 12), this.titanArmorMat);
        armGroup.add(shoulder);

        const forearm = new THREE.Mesh(new THREE.CylinderGeometry(0.36, 0.44, 1.65, 12), this.darkMetalMat);
        forearm.position.set(0, -1.0, 0.25);
        forearm.rotation.x = -0.3;
        armGroup.add(forearm);

        const plasmaClaw = new THREE.Mesh(new THREE.TorusGeometry(0.32, 0.08, 8, 16), this.eyeRedMat);
        plasmaClaw.position.set(0, -1.8, 0.48);
        armGroup.add(plasmaClaw);
        group.add(armGroup);

        const legGroup = new THREE.Group();
        legGroup.position.set(side * 0.95, 2.1, 0);
        legGroup.name = side === -1 ? 'left_leg' : 'right_leg';

        const thigh = new THREE.Mesh(new THREE.CylinderGeometry(0.42, 0.36, 1.1, 14), this.armorPlateMat);
        thigh.position.y = -0.55;
        legGroup.add(thigh);

        const knee = new THREE.Mesh(new THREE.SphereGeometry(0.38, 12, 12), this.chromeJointMat);
        knee.position.y = -1.1;
        legGroup.add(knee);

        const shin = new THREE.Mesh(new THREE.CylinderGeometry(0.38, 0.5, 1.0, 14), this.titanArmorMat);
        shin.position.y = -1.6;
        shin.castShadow = true;
        legGroup.add(shin);

        const foot = new THREE.Mesh(new THREE.CylinderGeometry(0.58, 0.68, 0.28, 8), this.darkMetalMat);
        foot.position.set(0, -2.0, 0.15);
        legGroup.add(foot);
        group.add(legGroup);
      }
    } else if (archetype === 'BOSS_NEXUS') {
      maxHp = 1500;
      maxStagger = 200;
      speed = 5.8;
      detectRange = 46;
      attackRange = 20.0;
      baseDamage = 32;
      hitRadius = 2.4;
      heightOffset = 3.8;
      xpValue = 800;

      const hoverCore = new THREE.Group();
      hoverCore.position.y = 3.8;
      hoverCore.name = 'hover_body';

      const coreSphere = new THREE.Mesh(new THREE.SphereGeometry(0.95, 32, 32), this.coreCyanMat);
      hoverCore.add(coreSphere);
      weakPointMesh = coreSphere;

      const innerCage = new THREE.Mesh(
        new THREE.IcosahedronGeometry(1.18, 1),
        new THREE.MeshStandardMaterial({
          color: 0x00f0ff,
          wireframe: true,
          emissive: 0x00a8cc,
          emissiveIntensity: 0.6
        })
      );
      innerCage.name = 'nexus_cage';
      hoverCore.add(innerCage);

      const ringRadii = [1.55, 2.05, 2.55];
      ringRadii.forEach((r, idx) => {
        const ring = new THREE.Mesh(new THREE.TorusGeometry(r, 0.085, 14, 48), this.titanArmorMat);
        ring.rotation.x = idx * 0.9;
        ring.rotation.y = idx * 0.6;
        ring.name = `nexus_ring_${idx}`;
        hoverCore.add(ring);
      });

      for (let i = 0; i < 6; i++) {
        const angle = (i / 6) * Math.PI * 2;
        const petalGeo = new THREE.CylinderGeometry(0.45, 0.25, 1.45, 6);
        petalGeo.scale(1.0, 1.0, 0.28);
        const petal = new THREE.Mesh(petalGeo, this.armorPlateMat);
        petal.position.set(Math.cos(angle) * 2.85, Math.sin(angle * 2) * 0.35, Math.sin(angle) * 2.85);
        petal.lookAt(0, 0, 0);
        petal.name = `nexus_petal_${i}`;
        hoverCore.add(petal);
      }

      group.add(hoverCore);
    }

    const pos = new THREE.Vector3(x, y, z);
    group.position.copy(pos);
    this.scene.add(group);

    const instance: EnemyInstance = {
      id,
      archetype,
      name,
      hp: maxHp,
      maxHp,
      stagger: 0,
      maxStagger,
      state: 'PATROL',
      position: pos,
      homePos: pos.clone(),
      patrolTarget: this.pickPatrolPoint(pos, archetype.startsWith('BOSS') ? 6 : 12),
      rotationY: 0,
      speed,
      detectRange,
      attackRange,
      baseDamage,
      attackCooldown: 1.4,
      specialCooldown: 5.5,
      staggerTimer: 0,
      hitRadius,
      heightOffset,
      xpValue,
      phase: 1,
      introShown: false,
      summonDone: false,
      animPhase: Math.random() * Math.PI * 2,
      mesh: group,
      weakPointMesh
    };

    this.enemies.push(instance);
    return instance;
  }

  private pickPatrolPoint(home: THREE.Vector3, radius: number): THREE.Vector3 {
    const a = Math.random() * Math.PI * 2;
    const r = 3 + Math.random() * radius;
    const tx = home.x + Math.cos(a) * r;
    const tz = home.z + Math.sin(a) * r;
    return new THREE.Vector3(tx, this.physics.getTerrainHeight(tx, tz), tz);
  }

  public applyDamage(
    e: EnemyInstance,
    rawDamage: number,
    staggerPower: number,
    isCrit: boolean,
    audio: AudioSystem
  ): { finalDamage: number; killed: boolean } {
    if (e.state === 'DEAD') return { finalDamage: 0, killed: false };

    const mult = (isCrit ? 1.55 : 1.0) * (e.state === 'STAGGERED' ? 1.35 : 1.0);
    const finalDamage = Math.max(1, Math.round(rawDamage * mult));
    e.hp = Math.max(0, e.hp - finalDamage);
    e.stagger = Math.min(e.maxStagger, e.stagger + staggerPower * (isCrit ? 1.4 : 1.0));

    if (e.hp <= 0) {
      e.state = 'DEAD';
      e.mesh.visible = false;
      audio.playEnemyDeath();
      return { finalDamage, killed: true };
    }

    if (e.state !== 'STAGGERED' && e.stagger >= e.maxStagger) {
      e.state = 'STAGGERED';
      e.staggerTimer = e.archetype.startsWith('BOSS') ? 3.2 : 2.3;
      audio.playBossRoar();
    } else if (e.state === 'PATROL') {
      e.state = 'PURSUE';
    }

    return { finalDamage, killed: false };
  }

  public update(
    dt: number,
    player: PlayerController,
    audio: AudioSystem,
    vfx: VfxSystem,
    onPlayerHit: (dmg: number, blocked: boolean) => void,
    onBossIntro: (boss: EnemyInstance) => void
  ): EnemyInstance | null {
    let activeBoss: EnemyInstance | null = null;

    for (const e of this.enemies) {
      if (e.state === 'DEAD') continue;

      e.animPhase += dt * 3.2;

      // Hover & gimbal animations for Scout Drone & NEXUS Prime
      const hoverBody = e.mesh.getObjectByName('hover_body');
      if (hoverBody) {
        hoverBody.position.y = e.heightOffset + Math.sin(e.animPhase * 1.4) * 0.28;
        if (e.archetype === 'BOSS_NEXUS') {
          hoverBody.children.forEach((child, idx) => {
            if (child.name.startsWith('nexus_ring_')) {
              child.rotation.x += dt * (0.85 + idx * 0.25) * e.phase;
              child.rotation.y += dt * (0.65 + idx * 0.2) * e.phase;
            } else if (child.name === 'nexus_cage') {
              child.rotation.y -= dt * 1.4 * e.phase;
              child.rotation.z += dt * 0.9;
            }
          });
        }
      }

      // Boss phase check
      if (e.archetype.startsWith('BOSS')) {
        if (e.hp < e.maxHp * 0.55 && e.phase === 1) {
          e.phase = 2;
          audio.playBossRoar();
          vfx.spawnShockwaveRing(e.position, 0xff2a54, 28, 0.65);
          if (e.archetype === 'BOSS_NEXUS' && !e.summonDone) {
            e.summonDone = true;
            this.spawnEnemy('SCOUT_DRONE', 'NEXUS Core Sentinel', e.position.x - 9, e.position.z + 6);
            this.spawnEnemy('SCOUT_DRONE', 'NEXUS Core Sentinel', e.position.x + 9, e.position.z + 6);
          }
        }
      }

      const distToPlayer = e.position.distanceTo(player.position);
      if (e.archetype.startsWith('BOSS') && distToPlayer <= e.detectRange + 8) {
        activeBoss = e;
        if (!e.introShown) {
          e.introShown = true;
          audio.playBossRoar();
          onBossIntro(e);
        }
      }

      // Stagger recovery
      if (e.state === 'STAGGERED') {
        e.staggerTimer -= dt;
        e.mesh.rotation.z = Math.sin(e.animPhase * 8) * 0.08;
        if (e.staggerTimer <= 0) {
          e.state = 'PURSUE';
          e.stagger = 0;
          e.mesh.rotation.z = 0;
        }
        continue;
      }

      if (e.attackCooldown > 0) e.attackCooldown = Math.max(0, e.attackCooldown - dt);
      if (e.specialCooldown > 0) e.specialCooldown = Math.max(0, e.specialCooldown - dt);

      // Perception & AI state machine
      if (distToPlayer <= e.detectRange) {
        if (e.archetype === 'SCOUT_DRONE' && distToPlayer < 6.0 && e.hp < e.maxHp * 0.5) {
          e.state = 'RETREAT';
        } else if (distToPlayer <= e.attackRange) {
          e.state = 'ATTACK';
        } else {
          if (e.state === 'PATROL') audio.playEnemyAlert();
          e.state = 'PURSUE';
        }
      } else {
        e.state = 'PATROL';
      }

      let isMoving = false;
      const toPlayerX = player.position.x - e.position.x;
      const toPlayerZ = player.position.z - e.position.z;

      if (e.state === 'PATROL') {
        const dx = e.patrolTarget.x - e.position.x;
        const dz = e.patrolTarget.z - e.position.z;
        const d = Math.hypot(dx, dz);
        if (d < 1.2) {
          e.patrolTarget = this.pickPatrolPoint(e.homePos, e.archetype.startsWith('BOSS') ? 6 : 12);
        } else {
          e.position.x += (dx / d) * e.speed * 0.42 * dt;
          e.position.z += (dz / d) * e.speed * 0.42 * dt;
          e.rotationY = Math.atan2(dx, dz);
          isMoving = true;
        }
      } else if (e.state === 'PURSUE') {
        const len = Math.max(0.001, Math.hypot(toPlayerX, toPlayerZ));
        let dirX = toPlayerX / len;
        let dirZ = toPlayerZ / len;

        if (e.archetype === 'MUTATED_CREATURE' || e.archetype === 'HUNTER_MACHINE') {
          const weave = Math.sin(e.animPhase * 1.6) * 0.42;
          dirX += -dirZ * weave;
          dirZ += dirX * weave;
        }

        const mult = e.phase === 2 ? 1.25 : 1.0;
        e.position.x += dirX * e.speed * mult * dt;
        e.position.z += dirZ * e.speed * mult * dt;
        e.rotationY = Math.atan2(toPlayerX, toPlayerZ);
        isMoving = true;
      } else if (e.state === 'RETREAT') {
        const len = Math.max(0.001, Math.hypot(toPlayerX, toPlayerZ));
        e.position.x -= (toPlayerX / len) * e.speed * 0.85 * dt;
        e.position.z -= (toPlayerZ / len) * e.speed * 0.85 * dt;
        e.rotationY = Math.atan2(toPlayerX, toPlayerZ);
        isMoving = true;
      } else if (e.state === 'ATTACK') {
        e.rotationY = Math.atan2(toPlayerX, toPlayerZ);

        if ((e.archetype === 'SCOUT_DRONE' || e.archetype === 'BOSS_NEXUS') && distToPlayer > 8.5) {
          const len = Math.max(0.001, Math.hypot(toPlayerX, toPlayerZ));
          e.position.x += (toPlayerX / len) * e.speed * 0.38 * dt;
          e.position.z += (toPlayerZ / len) * e.speed * 0.38 * dt;
        }

        if (e.attackCooldown <= 0) {
          e.attackCooldown = e.phase === 2 ? 1.15 : 1.55;
          if (e.archetype === 'SCOUT_DRONE' || e.archetype === 'BOSS_NEXUS') {
            const start = new THREE.Vector3(e.position.x, e.position.y + e.heightOffset, e.position.z);
            const end = player.position.clone().add(new THREE.Vector3(0, 1.2, 0));
            vfx.spawnBeam(start, end, e.archetype === 'BOSS_NEXUS' ? 0xff2a54 : 0xff9d00, 1.4, 0.16);
            audio.playPulseShot();
            if (distToPlayer <= e.attackRange + 1.5) {
              const res = player.takeDamage(e.baseDamage, audio);
              onPlayerHit(res.dmg, res.blocked);
            }
          } else {
            vfx.spawnSlashArc(e.position, e.rotationY, 1, e.archetype.startsWith('BOSS'));
            audio.playMeleeSwing(e.archetype.startsWith('BOSS'));
            if (distToPlayer <= e.attackRange + 0.8) {
              const res = player.takeDamage(e.baseDamage, audio);
              onPlayerHit(res.dmg, res.blocked);
            }
          }
        }
      }

      // Boss special area shockwave attacks
      if (e.archetype.startsWith('BOSS') && e.specialCooldown <= 0 && distToPlayer <= 22) {
        e.specialCooldown = e.phase === 2 ? 4.5 : 6.2;
        vfx.spawnShockwaveRing(
          e.position,
          e.archetype === 'BOSS_COLOSSUS' ? 0xff9d00 : 0x00f0ff,
          26,
          0.6
        );
        audio.playAbility('emp');
        if (distToPlayer <= 11.5 && player.isGrounded) {
          const res = player.takeDamage(e.baseDamage * 1.25, audio);
          onPlayerHit(res.dmg, res.blocked);
        }
      }

      // Resolve terrain & obstacle collision
      this.physics.resolveHorizontalCollision(e.position, e.hitRadius * 0.7);
      e.position.y = this.physics.getTerrainHeight(e.position.x, e.position.z);

      // Articulated procedural limb animations
      const leftLeg = e.mesh.getObjectByName('left_leg');
      const rightLeg = e.mesh.getObjectByName('right_leg');
      const leftArm = e.mesh.getObjectByName('left_arm');
      const rightArm = e.mesh.getObjectByName('right_arm');
      const turbine = e.mesh.getObjectByName('colossus_turbine');

      if (turbine) turbine.rotation.z += dt * 4.5 * e.phase;

      if (isMoving) {
        const wave = Math.sin(e.animPhase * (e.archetype === 'BOSS_COLOSSUS' ? 1.8 : 3.2));
        const amp = e.archetype === 'BOSS_COLOSSUS' ? 0.35 : 0.55;
        if (leftLeg) leftLeg.rotation.x = wave * amp;
        if (rightLeg) rightLeg.rotation.x = -wave * amp;
        if (leftArm && e.attackCooldown < 0.7) leftArm.rotation.x = -wave * amp * 0.45;
        if (rightArm && e.attackCooldown < 0.7) rightArm.rotation.x = wave * amp * 0.45;
      } else {
        if (leftLeg) leftLeg.rotation.x *= 0.85;
        if (rightLeg) rightLeg.rotation.x *= 0.85;
      }

      if (e.attackCooldown > 0.85 && rightArm) {
        rightArm.rotation.x = -1.25 * Math.sin((e.attackCooldown - 0.85) * Math.PI);
      }

      e.mesh.position.copy(e.position);
      e.mesh.rotation.y = e.rotationY;
    }

    return activeBoss;
  }
}
