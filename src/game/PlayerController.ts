import * as THREE from 'three';
import { PhysicsSystem } from './PhysicsSystem';
import { AudioSystem } from './AudioSystem';
import { WeaponData, WeaponId } from './types';
import { createCarbonArmorTexture, createContactShadowTexture, createPanelNormalMap } from './Textures';

const _forward = new THREE.Vector3();
const _right = new THREE.Vector3();
const _moveInput = new THREE.Vector3();
const _camTarget = new THREE.Vector3();
const _shoulder = new THREE.Vector3();
const _camOffset = new THREE.Vector3();
const _desiredCam = new THREE.Vector3();
const _resolvedCam = new THREE.Vector3();

export class PlayerController {
  public mesh: THREE.Group;
  public position = new THREE.Vector3(0, 0, 175);
  public velocity = new THREE.Vector3();
  public rotationY = Math.PI;

  // Third-Person Camera Rig (cameraYaw = 0 looks North along -Z)
  public cameraYaw = 0;
  public cameraPitch = 0.24;
  public cameraDistance = 6.0;
  public recoilPitch = 0;

  // Mobile Virtual Analog Joystick Vector (-1..1)
  public mobileMoveX = 0;
  public mobileMoveY = 0;
  public mobileSprint = false;

  // RPG Progression & Attributes
  public level = 1;
  public xp = 0;
  public xpToNext = 100;
  public skillPoints = 1;
  public armorLevel = 1;

  public maxHp = 120;
  public hp = 120;
  public maxStamina = 100;
  public stamina = 100;
  public maxEnergy = 100;
  public energy = 100;

  public meleeMultiplier = 1.0;
  public rangedMultiplier = 1.0;
  public abilityMultiplier = 1.0;
  public damageReduction = 0.0;
  public cooldownReduction = 0.0;

  // Kinematic & Combat States
  public isGrounded = true;
  public isSprinting = false;
  public isCrouching = false;
  public isAiming = false;
  public isBlocking = false;
  public isDodging = false;
  public dodgeTimer = 0;
  public invincibleTimer = 0;
  public shieldBuffTimer = 0;

  public activeWeaponId: WeaponId = 'plasma_blade';
  public weapons: Record<WeaponId, WeaponData> = {
    plasma_blade: {
      id: 'plasma_blade',
      name: 'Eclipse Plasma Blade',
      type: 'melee',
      baseDamage: 30,
      upgradeLevel: 1,
      fireRate: 0.34,
      magSize: 0,
      currentMag: 0,
      reserveAmmo: 0,
      maxReserve: 0,
      reloadTime: 0,
      staggerPower: 24
    },
    pulse_rifle: {
      id: 'pulse_rifle',
      name: 'MK-IV Pulse Rifle',
      type: 'ranged',
      baseDamage: 20,
      upgradeLevel: 1,
      fireRate: 0.13,
      magSize: 30,
      currentMag: 30,
      reserveAmmo: 150,
      maxReserve: 240,
      reloadTime: 1.35,
      staggerPower: 9
    },
    rail_cannon: {
      id: 'rail_cannon',
      name: 'Hyperion Rail Cannon',
      type: 'ranged',
      baseDamage: 76,
      upgradeLevel: 1,
      fireRate: 0.85,
      magSize: 5,
      currentMag: 5,
      reserveAmmo: 25,
      maxReserve: 45,
      reloadTime: 1.9,
      staggerPower: 52
    }
  };

  public attackCooldown = 0;
  public comboStep = 0;
  public comboResetTimer = 0;
  public reloadTimer = 0;

  public abilityCooldowns = { q: 0, z: 0, x: 0 };
  public readonly abilityMaxCooldowns = { q: 8.0, z: 12.0, x: 10.0 };

  // Articulated Rig Parts (Anatomical Exo-Suit)
  private bodyGroup!: THREE.Group;
  private torsoGroup!: THREE.Group;
  private headGroup!: THREE.Group;
  private leftArm!: THREE.Group;
  private leftForearm!: THREE.Group;
  private rightArm!: THREE.Group;
  private rightForearm!: THREE.Group;
  private leftLeg!: THREE.Group;
  private leftShin!: THREE.Group;
  private rightLeg!: THREE.Group;
  private rightShin!: THREE.Group;
  private bladeGroup!: THREE.Group;
  private rifleGroup!: THREE.Group;
  private railGroup!: THREE.Group;
  private shieldBubble!: THREE.Mesh;
  private muzzleLight!: THREE.PointLight;
  private thrusterLeft!: THREE.Mesh;
  private thrusterRight!: THREE.Mesh;
  private muzzleFlashTimer = 0;
  private animTime = 0;
  private stepAccum = 0;

  constructor(scene: THREE.Scene) {
    this.mesh = this.buildArticulatedOperativeMesh();
    scene.add(this.mesh);
  }

  /**
   * Builds a realistic, organic, sculpted sci-fi exo-suit operative using LatheGeometry,
   * CapsuleGeometry, ExtrudeGeometry, Sphere joints, and PBR clearcoat/normal materials (zero boxy blocks).
   */
  private buildArticulatedOperativeMesh(): THREE.Group {
    const root = new THREE.Group();
    this.bodyGroup = new THREE.Group();
    root.add(this.bodyGroup);

    // Grounded Contact Shadow
    const shadowTex = createContactShadowTexture();
    const shadowPlane = new THREE.Mesh(
      new THREE.PlaneGeometry(1.5, 1.5),
      new THREE.MeshBasicMaterial({ map: shadowTex, transparent: true, depthWrite: false, opacity: 0.72 })
    );
    shadowPlane.rotation.x = -Math.PI / 2;
    shadowPlane.position.y = 0.03;
    root.add(shadowPlane);

    const carbonTex = createCarbonArmorTexture(4);
    const normalTex = createPanelNormalMap();

    const armorMat = new THREE.MeshPhysicalMaterial({
      color: 0x24344d,
      map: carbonTex,
      normalMap: normalTex,
      normalScale: new THREE.Vector2(0.35, 0.35),
      roughness: 0.28,
      metalness: 0.85,
      clearcoat: 0.65,
      clearcoatRoughness: 0.2
    });

    const gunmetalMat = new THREE.MeshStandardMaterial({
      color: 0x141c29,
      roughness: 0.55,
      metalness: 0.75
    });

    const underSuitMat = new THREE.MeshStandardMaterial({
      color: 0x0c1118,
      map: carbonTex,
      roughness: 0.78,
      metalness: 0.22
    });

    const visorGlassMat = new THREE.MeshPhysicalMaterial({
      color: 0x00f0ff,
      emissive: 0x0088cc,
      emissiveIntensity: 0.9,
      roughness: 0.1,
      metalness: 0.9,
      clearcoat: 1.0
    });

    const cyanGlowMat = new THREE.MeshBasicMaterial({ color: 0x00f0ff });
    const railGlowMat = new THREE.MeshBasicMaterial({ color: 0xff9d00 });

    // 1. Sculpted Anatomical Torso (LatheGeometry + Beveled Chest Cuirass)
    this.torsoGroup = new THREE.Group();
    this.torsoGroup.position.y = 1.15;
    this.bodyGroup.add(this.torsoGroup);

    const torsoProfile = [
      new THREE.Vector2(0.01, -0.34),
      new THREE.Vector2(0.22, -0.30), // Pelvis
      new THREE.Vector2(0.19, -0.10), // Tapered waist
      new THREE.Vector2(0.29, 0.16),  // Sculpted ribcage/pectorals
      new THREE.Vector2(0.26, 0.34),  // Upper chest
      new THREE.Vector2(0.13, 0.40)   // Neck collar
    ];
    const torsoLatheGeo = new THREE.LatheGeometry(torsoProfile, 20);
    torsoLatheGeo.scale(1.12, 1.0, 0.74);
    const torsoCore = new THREE.Mesh(torsoLatheGeo, underSuitMat);
    torsoCore.castShadow = true;
    this.torsoGroup.add(torsoCore);

    // Sculpted Chest Armor Plate
    const chestArmorGeo = new THREE.CylinderGeometry(0.32, 0.24, 0.42, 12);
    chestArmorGeo.scale(1.12, 1.0, 0.68);
    const chestArmor = new THREE.Mesh(chestArmorGeo, armorMat);
    chestArmor.position.set(0, 0.12, 0.03);
    chestArmor.castShadow = true;
    this.torsoGroup.add(chestArmor);

    // Glowing Sternum Arc Reactor Core
    const arcRing = new THREE.Mesh(new THREE.TorusGeometry(0.065, 0.016, 10, 20), cyanGlowMat);
    arcRing.position.set(0, 0.16, 0.24);
    this.torsoGroup.add(arcRing);

    // Tactical Utility Belt (Torus + Cylindrical Pouches)
    const belt = new THREE.Mesh(new THREE.CylinderGeometry(0.23, 0.24, 0.09, 16), gunmetalMat);
    belt.scale.set(1.12, 1, 0.78);
    belt.position.y = -0.22;
    this.torsoGroup.add(belt);

    // 2. Twin Jump-Jet Backpack & Spine Conduit
    const packGroup = new THREE.Group();
    packGroup.position.set(0, 0.1, -0.22);
    const packShell = new THREE.Mesh(new THREE.CapsuleGeometry(0.14, 0.26, 8, 12), armorMat);
    packShell.scale.set(1.2, 1.0, 0.65);
    packGroup.add(packShell);

    for (const side of [-1, 1]) {
      const nozzle = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.08, 0.28, 12), gunmetalMat);
      nozzle.position.set(side * 0.13, -0.05, -0.06);
      nozzle.rotation.z = side * -0.15;
      nozzle.rotation.x = 0.2;
      packGroup.add(nozzle);

      const thrusterGlow = new THREE.Mesh(new THREE.ConeGeometry(0.065, 0.24, 10), cyanGlowMat);
      thrusterGlow.rotation.x = Math.PI;
      thrusterGlow.position.set(side * 0.14, -0.24, -0.09);
      packGroup.add(thrusterGlow);
      if (side === -1) this.thrusterLeft = thrusterGlow;
      else this.thrusterRight = thrusterGlow;
    }
    this.torsoGroup.add(packGroup);

    // 3. Sculpted Aerodynamic Helmet & Curved Panoramic Visor
    this.headGroup = new THREE.Group();
    this.headGroup.position.y = 0.56;
    this.torsoGroup.add(this.headGroup);

    const helmetShell = new THREE.Mesh(new THREE.SphereGeometry(0.19, 20, 16), armorMat);
    helmetShell.scale.set(0.92, 1.05, 1.12);
    helmetShell.castShadow = true;
    this.headGroup.add(helmetShell);

    const visorDome = new THREE.Mesh(
      new THREE.SphereGeometry(0.182, 18, 14, -Math.PI * 0.38, Math.PI * 0.76, Math.PI * 0.28, Math.PI * 0.36),
      visorGlassMat
    );
    visorDome.rotation.y = Math.PI * 0.5;
    visorDome.position.set(0, 0.01, 0.035);
    this.headGroup.add(visorDome);

    // Helmet Crest Ridge
    const crest = new THREE.Mesh(new THREE.CapsuleGeometry(0.025, 0.18, 6, 8), gunmetalMat);
    crest.rotation.x = Math.PI / 2 - 0.2;
    crest.position.set(0, 0.17, -0.02);
    this.headGroup.add(crest);

    // 4. Curved Layered Shoulder Pauldrons
    const pauldronGeo = new THREE.SphereGeometry(0.16, 16, 12, 0, Math.PI * 2, 0, Math.PI * 0.6);
    const leftPauldron = new THREE.Mesh(pauldronGeo, armorMat);
    leftPauldron.position.set(-0.37, 0.28, 0);
    leftPauldron.rotation.z = 0.45;
    leftPauldron.castShadow = true;
    const rightPauldron = new THREE.Mesh(pauldronGeo, armorMat);
    rightPauldron.position.set(0.37, 0.28, 0);
    rightPauldron.rotation.z = -0.45;
    rightPauldron.castShadow = true;
    this.torsoGroup.add(leftPauldron, rightPauldron);

    // 5. Articulated Left Arm (Upper Arm + Elbow Sphere + Forearm Gauntlet)
    this.leftArm = new THREE.Group();
    this.leftArm.position.set(-0.37, 0.24, 0);
    const lUpper = new THREE.Mesh(new THREE.CapsuleGeometry(0.072, 0.22, 8, 12), underSuitMat);
    lUpper.position.y = -0.14;
    lUpper.castShadow = true;
    this.leftArm.add(lUpper);

    this.leftForearm = new THREE.Group();
    this.leftForearm.position.set(0, -0.28, 0);
    const lGauntlet = new THREE.Mesh(new THREE.CylinderGeometry(0.072, 0.055, 0.26, 12), armorMat);
    lGauntlet.position.y = -0.13;
    lGauntlet.castShadow = true;
    const lHand = new THREE.Mesh(new THREE.SphereGeometry(0.055, 10, 10), gunmetalMat);
    lHand.position.y = -0.27;
    this.leftForearm.add(lGauntlet, lHand);
    this.leftArm.add(this.leftForearm);
    this.torsoGroup.add(this.leftArm);

    // 6. Articulated Right Arm + Weapon Mount
    this.rightArm = new THREE.Group();
    this.rightArm.position.set(0.37, 0.24, 0);
    const rUpper = new THREE.Mesh(new THREE.CapsuleGeometry(0.072, 0.22, 8, 12), underSuitMat);
    rUpper.position.y = -0.14;
    rUpper.castShadow = true;
    this.rightArm.add(rUpper);

    this.rightForearm = new THREE.Group();
    this.rightForearm.position.set(0, -0.28, 0);
    const rGauntlet = new THREE.Mesh(new THREE.CylinderGeometry(0.072, 0.055, 0.26, 12), armorMat);
    rGauntlet.position.y = -0.13;
    rGauntlet.castShadow = true;
    const rHand = new THREE.Mesh(new THREE.SphereGeometry(0.055, 10, 10), gunmetalMat);
    rHand.position.y = -0.27;
    this.rightForearm.add(rGauntlet, rHand);
    this.rightArm.add(this.rightForearm);

    // 7. Weapon 1: Sculpted Eclipse Plasma Katana (Extrude Beveled Blade + Cylindrical Hilt)
    this.bladeGroup = new THREE.Group();
    const hilt = new THREE.Mesh(new THREE.CylinderGeometry(0.028, 0.032, 0.28, 12), gunmetalMat);
    hilt.rotation.x = Math.PI / 2;
    const handguard = new THREE.Mesh(new THREE.TorusGeometry(0.055, 0.012, 8, 16), armorMat);
    handguard.position.z = 0.12;

    const bladeShape = new THREE.Shape();
    bladeShape.moveTo(0, -0.04);
    bladeShape.lineTo(0.95, -0.025);
    bladeShape.lineTo(1.12, 0.0);
    bladeShape.lineTo(0.95, 0.035);
    bladeShape.lineTo(0, 0.04);
    bladeShape.closePath();
    const bladeGeo = new THREE.ExtrudeGeometry(bladeShape, {
      depth: 0.012,
      bevelEnabled: true,
      bevelThickness: 0.008,
      bevelSize: 0.008,
      bevelSegments: 2
    });
    bladeGeo.rotateY(-Math.PI / 2);
    const bladeCore = new THREE.Mesh(bladeGeo, gunmetalMat);
    bladeCore.position.set(0.006, 0, 0.14);

    const plasmaEdge = new THREE.Mesh(new THREE.CapsuleGeometry(0.016, 1.02, 6, 10), cyanGlowMat);
    plasmaEdge.rotation.x = Math.PI / 2;
    plasmaEdge.position.set(0, 0.032, 0.66);

    this.bladeGroup.add(hilt, handguard, bladeCore, plasmaEdge);
    this.bladeGroup.position.set(0, -0.26, 0.08);
    this.rightForearm.add(this.bladeGroup);

    // 8. Weapon 2: MK-IV Pulse Carbine (Multi-cylinder Barrel, Shroud, Holographic Sight, Stock)
    this.rifleGroup = new THREE.Group();
    const shroud = new THREE.Mesh(new THREE.CylinderGeometry(0.055, 0.065, 0.56, 12), armorMat);
    shroud.rotation.x = Math.PI / 2;
    shroud.position.z = 0.22;
    const barrel = new THREE.Mesh(new THREE.CylinderGeometry(0.022, 0.022, 0.42, 10), gunmetalMat);
    barrel.rotation.x = Math.PI / 2;
    barrel.position.set(0, 0.015, 0.52);
    const muzzleBrake = new THREE.Mesh(new THREE.CylinderGeometry(0.032, 0.028, 0.08, 10), cyanGlowMat);
    muzzleBrake.rotation.x = Math.PI / 2;
    muzzleBrake.position.set(0, 0.015, 0.72);
    const holoSight = new THREE.Mesh(new THREE.TorusGeometry(0.036, 0.008, 8, 16), cyanGlowMat);
    holoSight.position.set(0, 0.085, 0.16);
    const mag = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.03, 0.18, 8), gunmetalMat);
    mag.rotation.x = 0.25;
    mag.position.set(0, -0.09, 0.25);

    this.rifleGroup.add(shroud, barrel, muzzleBrake, holoSight, mag);
    this.rifleGroup.position.set(0, -0.24, 0.12);
    this.rifleGroup.visible = false;
    this.rightForearm.add(this.rifleGroup);

    // 9. Weapon 3: Hyperion Rail Cannon (Twin Cylindrical Accelerator Coils + Glowing Core)
    this.railGroup = new THREE.Group();
    const cannonHousing = new THREE.Mesh(new THREE.CylinderGeometry(0.075, 0.085, 0.68, 12), armorMat);
    cannonHousing.rotation.x = Math.PI / 2;
    cannonHousing.position.z = 0.25;
    const topCoil = new THREE.Mesh(new THREE.CylinderGeometry(0.026, 0.026, 0.88, 10), gunmetalMat);
    topCoil.rotation.x = Math.PI / 2;
    topCoil.position.set(0, 0.055, 0.44);
    const botCoil = new THREE.Mesh(new THREE.CylinderGeometry(0.026, 0.026, 0.88, 10), gunmetalMat);
    botCoil.rotation.x = Math.PI / 2;
    botCoil.position.set(0, -0.045, 0.44);
    const plasmaConduit = new THREE.Mesh(new THREE.CylinderGeometry(0.018, 0.018, 0.82, 10), railGlowMat);
    plasmaConduit.rotation.x = Math.PI / 2;
    plasmaConduit.position.set(0, 0.005, 0.42);

    for (let r = 0; r < 4; r++) {
      const coilRing = new THREE.Mesh(new THREE.TorusGeometry(0.068, 0.01, 8, 16), railGlowMat);
      coilRing.position.set(0, 0.005, 0.25 + r * 0.16);
      this.railGroup.add(coilRing);
    }

    this.railGroup.add(cannonHousing, topCoil, botCoil, plasmaConduit);
    this.railGroup.position.set(0, -0.24, 0.12);
    this.railGroup.visible = false;
    this.rightForearm.add(this.railGroup);

    this.muzzleLight = new THREE.PointLight(0x00f0ff, 0, 8);
    this.muzzleLight.position.set(0, -0.24, 0.95);
    this.rightForearm.add(this.muzzleLight);
    this.torsoGroup.add(this.rightArm);

    // 10. Articulated Left & Right Legs (Thigh Capsule + Knee Guard + Tapered Greave + Boot)
    const buildLeg = (side: number): { hip: THREE.Group; shin: THREE.Group } => {
      const hip = new THREE.Group();
      hip.position.set(side * 0.17, 0.82, 0);

      const thigh = new THREE.Mesh(new THREE.CapsuleGeometry(0.095, 0.26, 8, 14), armorMat);
      thigh.position.y = -0.18;
      thigh.castShadow = true;
      hip.add(thigh);

      const kneePad = new THREE.Mesh(new THREE.SphereGeometry(0.082, 12, 10), gunmetalMat);
      kneePad.position.set(0, -0.36, 0.04);
      hip.add(kneePad);

      const shin = new THREE.Group();
      shin.position.set(0, -0.38, 0);

      const greave = new THREE.Mesh(new THREE.CylinderGeometry(0.088, 0.064, 0.36, 14), armorMat);
      greave.position.y = -0.19;
      greave.castShadow = true;
      shin.add(greave);

      const boot = new THREE.Mesh(new THREE.CapsuleGeometry(0.068, 0.14, 8, 12), gunmetalMat);
      boot.rotation.x = Math.PI / 2;
      boot.position.set(0, -0.38, 0.04);
      boot.castShadow = true;
      shin.add(boot);

      hip.add(shin);
      this.bodyGroup.add(hip);
      return { hip, shin };
    };

    const lLegRig = buildLeg(-1);
    this.leftLeg = lLegRig.hip;
    this.leftShin = lLegRig.shin;

    const rLegRig = buildLeg(1);
    this.rightLeg = rLegRig.hip;
    this.rightShin = rLegRig.shin;

    // 11. Geodesic Aegis Defensive Energy Dome
    this.shieldBubble = new THREE.Mesh(
      new THREE.IcosahedronGeometry(1.38, 2),
      new THREE.MeshBasicMaterial({
        color: 0x00f0ff,
        wireframe: true,
        transparent: true,
        opacity: 0.36
      })
    );
    this.shieldBubble.position.y = 1.08;
    this.shieldBubble.visible = false;
    root.add(this.shieldBubble);

    return root;
  }

  public triggerMuzzleFlash(colorHex: number): void {
    this.muzzleLight.color.setHex(colorHex);
    this.muzzleLight.intensity = 4.5;
    this.muzzleFlashTimer = 0.06;
  }

  public switchWeapon(id: WeaponId): void {
    this.activeWeaponId = id;
    this.reloadTimer = 0;
    this.bladeGroup.visible = id === 'plasma_blade';
    this.rifleGroup.visible = id === 'pulse_rifle';
    this.railGroup.visible = id === 'rail_cannon';
  }

  public startReload(audio: AudioSystem): void {
    const w = this.weapons[this.activeWeaponId];
    if (w.type !== 'ranged' || this.reloadTimer > 0) return;
    if (w.currentMag >= w.magSize || w.reserveAmmo <= 0) return;
    this.reloadTimer = w.reloadTime;
    audio.playReload();
  }

  public triggerJump(audio: AudioSystem): void {
    if (this.isGrounded && !this.isDodging) {
      this.velocity.y = 9.4;
      this.isGrounded = false;
      audio.playJump();
    }
  }

  public triggerDodge(keys: Set<string>, audio: AudioSystem): boolean {
    if (this.isDodging || this.stamina < 22) return false;
    this.stamina -= 22;
    this.isDodging = true;
    this.dodgeTimer = 0.34;
    this.invincibleTimer = 0.4;

    _forward.set(-Math.sin(this.cameraYaw), 0, -Math.cos(this.cameraYaw));
    _right.set(Math.cos(this.cameraYaw), 0, -Math.sin(this.cameraYaw));
    _moveInput.set(0, 0, 0);
    if (keys.has('KeyW')) _moveInput.add(_forward);
    if (keys.has('KeyS')) _moveInput.sub(_forward);
    if (keys.has('KeyD')) _moveInput.add(_right);
    if (keys.has('KeyA')) _moveInput.sub(_right);

    if (Math.abs(this.mobileMoveX) > 0.05 || Math.abs(this.mobileMoveY) > 0.05) {
      _moveInput.addScaledVector(_forward, -this.mobileMoveY);
      _moveInput.addScaledVector(_right, this.mobileMoveX);
    }

    if (_moveInput.lengthSq() < 0.01) {
      _moveInput.set(Math.sin(this.rotationY), 0, Math.cos(this.rotationY));
    } else {
      _moveInput.normalize();
    }
    this.velocity.x = _moveInput.x * 17.5;
    this.velocity.z = _moveInput.z * 17.5;
    audio.playDodge();
    return true;
  }

  public addXp(amount: number): boolean {
    this.xp += amount;
    let leveledUp = false;
    while (this.xp >= this.xpToNext) {
      this.xp -= this.xpToNext;
      this.level++;
      this.skillPoints++;
      this.maxHp += 15;
      this.hp = this.maxHp;
      this.maxStamina += 8;
      this.stamina = this.maxStamina;
      this.xpToNext = Math.floor(this.xpToNext * 1.35);
      leveledUp = true;
    }
    return leveledUp;
  }

  public takeDamage(rawDamage: number, audio: AudioSystem): { dmg: number; blocked: boolean } {
    if (this.invincibleTimer > 0) return { dmg: 0, blocked: false };
    let dmg = rawDamage * (1 - this.damageReduction);
    let blocked = false;
    if (this.isBlocking && this.stamina > 8) {
      dmg *= 0.3;
      this.stamina = Math.max(0, this.stamina - 14);
      blocked = true;
      audio.playBlock();
    }
    if (this.shieldBuffTimer > 0) {
      dmg *= 0.25;
    }
    const finalDmg = Math.max(1, Math.round(dmg));
    this.hp = Math.max(0, this.hp - finalDmg);
    this.invincibleTimer = 0.24;
    return { dmg: finalDmg, blocked };
  }

  public update(
    dt: number,
    keys: Set<string>,
    physics: PhysicsSystem,
    camera: THREE.PerspectiveCamera,
    audio: AudioSystem,
    lockTargetPos: THREE.Vector3 | null
  ): void {
    if (this.attackCooldown > 0) this.attackCooldown -= dt;
    if (this.comboResetTimer > 0) {
      this.comboResetTimer -= dt;
      if (this.comboResetTimer <= 0) this.comboStep = 0;
    }
    if (this.invincibleTimer > 0) this.invincibleTimer -= dt;
    if (this.muzzleFlashTimer > 0) {
      this.muzzleFlashTimer -= dt;
      if (this.muzzleFlashTimer <= 0) this.muzzleLight.intensity = 0;
    }

    if (this.shieldBuffTimer > 0) {
      this.shieldBuffTimer = Math.max(0, this.shieldBuffTimer - dt);
      this.shieldBubble.visible = this.shieldBuffTimer > 0;
      this.shieldBubble.rotation.y += dt * 2.5;
    }

    if (this.abilityCooldowns.q > 0) this.abilityCooldowns.q = Math.max(0, this.abilityCooldowns.q - dt);
    if (this.abilityCooldowns.z > 0) this.abilityCooldowns.z = Math.max(0, this.abilityCooldowns.z - dt);
    if (this.abilityCooldowns.x > 0) this.abilityCooldowns.x = Math.max(0, this.abilityCooldowns.x - dt);

    // Recoil recovery
    this.recoilPitch = THREE.MathUtils.damp(this.recoilPitch, 0, 14, dt);

    // Reload completion
    if (this.reloadTimer > 0) {
      this.reloadTimer -= dt;
      if (this.reloadTimer <= 0) {
        this.reloadTimer = 0;
        const w = this.weapons[this.activeWeaponId];
        const needed = w.magSize - w.currentMag;
        const loaded = Math.min(needed, w.reserveAmmo);
        w.currentMag += loaded;
        w.reserveAmmo -= loaded;
      }
    }

    // Regenerate Stamina & Flux Core Energy
    if (!this.isSprinting && !this.isDodging && !this.isBlocking) {
      this.stamina = Math.min(this.maxStamina, this.stamina + 24 * dt);
    }
    this.energy = Math.min(this.maxEnergy, this.energy + 9.5 * dt);

    // Optional Arrow-Key Camera Orbit fallback
    if (keys.has('ArrowLeft')) this.cameraYaw += 2.2 * dt;
    if (keys.has('ArrowRight')) this.cameraYaw -= 2.2 * dt;
    if (keys.has('ArrowUp')) this.cameraPitch = THREE.MathUtils.clamp(this.cameraPitch - 1.5 * dt, -0.45, 1.1);
    if (keys.has('ArrowDown')) this.cameraPitch = THREE.MathUtils.clamp(this.cameraPitch + 1.5 * dt, -0.45, 1.1);

    // Target Lock camera assist
    if (lockTargetPos && !this.isAiming) {
      const dx = lockTargetPos.x - this.position.x;
      const dz = lockTargetPos.z - this.position.z;
      const targetYaw = Math.atan2(-dx, -dz);
      this.cameraYaw = this.lerpAngle(this.cameraYaw, targetYaw, 6.5 * dt);
    }

    // Directional Input relative to camera (Keyboard + Mobile Virtual Joystick)
    _forward.set(-Math.sin(this.cameraYaw), 0, -Math.cos(this.cameraYaw));
    _right.set(Math.cos(this.cameraYaw), 0, -Math.sin(this.cameraYaw));
    _moveInput.set(0, 0, 0);

    if (keys.has('KeyW')) _moveInput.add(_forward);
    if (keys.has('KeyS')) _moveInput.sub(_forward);
    if (keys.has('KeyD')) _moveInput.add(_right);
    if (keys.has('KeyA')) _moveInput.sub(_right);

    if (Math.abs(this.mobileMoveX) > 0.05 || Math.abs(this.mobileMoveY) > 0.05) {
      _moveInput.addScaledVector(_forward, -this.mobileMoveY);
      _moveInput.addScaledVector(_right, this.mobileMoveX);
    }

    const inputMag = Math.min(1, _moveInput.length());
    if (inputMag > 0) _moveInput.normalize();

    if (this.isDodging) {
      this.dodgeTimer -= dt;
      this.bodyGroup.rotation.x = 0.55;
      if (this.dodgeTimer <= 0) {
        this.isDodging = false;
        this.bodyGroup.rotation.x = 0;
      }
    } else {
      const wantsSprint =
        keys.has('ShiftLeft') ||
        keys.has('ShiftRight') ||
        this.mobileSprint ||
        Math.hypot(this.mobileMoveX, this.mobileMoveY) > 0.88;
      this.isSprinting =
        wantsSprint &&
        inputMag > 0.1 &&
        this.stamina > 4 &&
        !this.isCrouching &&
        !this.isAiming;
      if (this.isSprinting) {
        this.stamina = Math.max(0, this.stamina - 15 * dt);
      }

      let speed = 7.6 * Math.max(0.45, inputMag);
      if (this.isSprinting) speed = 12.0;
      else if (this.isCrouching || this.isAiming || this.isBlocking) speed = 4.4;

      this.velocity.x = _moveInput.x * speed;
      this.velocity.z = _moveInput.z * speed;

      if (this.isAiming || (lockTargetPos && inputMag < 0.05)) {
        this.rotationY = this.cameraYaw + Math.PI;
      } else if (inputMag > 0.05) {
        const targetAngle = Math.atan2(_moveInput.x, _moveInput.z);
        this.rotationY = this.lerpAngle(this.rotationY, targetAngle, 14 * dt);
      }
    }

    // Jump & Gravity
    if (keys.has('Space')) {
      this.triggerJump(audio);
    }
    this.velocity.y -= 23.0 * dt;

    // Position integration + Horizontal Collision
    this.position.x += this.velocity.x * dt;
    this.position.z += this.velocity.z * dt;
    physics.resolveHorizontalCollision(this.position, 0.55);

    this.position.y += this.velocity.y * dt;
    const groundY = physics.getTerrainHeight(this.position.x, this.position.z);
    if (this.position.y <= groundY) {
      this.position.y = groundY;
      this.velocity.y = 0;
      this.isGrounded = true;
    }

    // Transform Mesh & Procedural Skeletal Articulation
    this.mesh.position.copy(this.position);
    this.mesh.rotation.y = this.rotationY;
    this.animateLimbs(dt, inputMag, audio);

    // Thruster flame scale
    const thrustScale = this.isDodging || this.isSprinting || !this.isGrounded ? 1.45 : 0.45;
    this.thrusterLeft.scale.setScalar(thrustScale);
    this.thrusterRight.scale.setScalar(thrustScale);

    // Smooth Third-Person Camera with Collision Solving & FOV speed cues
    const targetFov = this.isAiming ? 48 : this.isSprinting ? 72 : 64;
    if (Math.abs(camera.fov - targetFov) > 0.1) {
      camera.fov = THREE.MathUtils.damp(camera.fov, targetFov, 10, dt);
      camera.updateProjectionMatrix();
    }

    const activePitch = THREE.MathUtils.clamp(this.cameraPitch - this.recoilPitch, -0.55, 1.15);
    _camTarget.set(
      this.position.x,
      this.position.y + (this.isCrouching ? 1.2 : 1.65),
      this.position.z
    );
    const desiredDist = this.isAiming ? 3.1 : this.cameraDistance;
    _shoulder.set(Math.cos(this.cameraYaw) * 0.62, 0, -Math.sin(this.cameraYaw) * 0.62);

    _camOffset.set(
      Math.sin(this.cameraYaw) * Math.cos(activePitch) * desiredDist,
      Math.sin(activePitch) * desiredDist,
      Math.cos(this.cameraYaw) * Math.cos(activePitch) * desiredDist
    );

    _desiredCam.copy(_camTarget).add(_shoulder).add(_camOffset);
    physics.resolveCameraCollision(_camTarget, _desiredCam, _resolvedCam);

    camera.position.lerp(_resolvedCam, 1 - Math.exp(-18 * dt));
    camera.lookAt(_camTarget.clone().add(_shoulder));
  }

  private animateLimbs(dt: number, moveMag: number, audio: AudioSystem): void {
    this.torsoGroup.position.y = this.isCrouching ? 0.92 : 1.15;

    if (moveMag > 0.08 && this.isGrounded && !this.isDodging) {
      const freq = this.isSprinting ? 13.5 : 9.2;
      this.animTime += dt * freq;
      this.stepAccum += dt * freq;
      if (this.stepAccum >= Math.PI) {
        this.stepAccum = 0;
        audio.playFootstep(this.isSprinting);
      }
      const swing = Math.sin(this.animTime) * (this.isSprinting ? 0.68 : 0.45);
      this.leftLeg.rotation.x = swing;
      this.rightLeg.rotation.x = -swing;
      this.leftShin.rotation.x = Math.max(0, -swing * 0.85);
      this.rightShin.rotation.x = Math.max(0, swing * 0.85);

      this.leftArm.rotation.x = -swing * 0.65;
      this.leftForearm.rotation.x = -0.35 - Math.abs(swing) * 0.25;
      this.torsoGroup.rotation.y = Math.sin(this.animTime) * 0.08;
    } else {
      this.leftLeg.rotation.x *= 0.85;
      this.rightLeg.rotation.x *= 0.85;
      this.leftShin.rotation.x *= 0.85;
      this.rightShin.rotation.x *= 0.85;
      this.leftArm.rotation.x *= 0.85;
      this.leftForearm.rotation.x = -0.25;
      this.torsoGroup.rotation.y *= 0.85;
    }

    if (this.attackCooldown > 0 && this.weapons[this.activeWeaponId].type === 'melee') {
      this.rightArm.rotation.x = -1.55 + Math.sin(this.attackCooldown * 20) * 1.25;
      this.rightArm.rotation.z = this.comboStep % 2 === 0 ? -0.35 : 0.35;
      this.rightForearm.rotation.x = -0.45;
    } else if (this.isAiming) {
      this.rightArm.rotation.x = -Math.PI / 2 + this.cameraPitch;
      this.rightArm.rotation.z = 0;
      this.rightForearm.rotation.x = -0.1;
    } else if (this.isBlocking) {
      this.rightArm.rotation.x = -1.05;
      this.rightArm.rotation.z = -0.65;
      this.rightForearm.rotation.x = -0.5;
    } else {
      this.rightArm.rotation.x = -0.22;
      this.rightArm.rotation.z = 0;
      this.rightForearm.rotation.x = -0.38;
    }
  }

  private lerpAngle(a: number, b: number, t: number): number {
    const diff = THREE.MathUtils.euclideanModulo(b - a + Math.PI, Math.PI * 2) - Math.PI;
    return a + diff * Math.min(1, t);
  }
}
