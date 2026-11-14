import * as THREE from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import {
  FloatingDamage,
  GameScreenState,
  GameSettings,
  HudSnapshot,
  InteractableObject,
  TacticalTab,
  TransmissionMessage,
  WeaponId
} from './types';
import { AudioSystem } from './AudioSystem';
import { PhysicsSystem } from './PhysicsSystem';
import { WorldBuilder } from './WorldBuilder';
import { PlayerController } from './PlayerController';
import { EnemyInstance, EnemyManager } from './EnemyManager';
import { ProgressionSystem } from './ProgressionSystem';
import { VfxSystem } from './VfxSystem';

export interface EngineCallbacks {
  onSnapshot: (snap: HudSnapshot) => void;
  onFloatingDamage: (dmg: FloatingDamage) => void;
  onOpenTacticalTab: (tab: TacticalTab) => void;
  onWebglError: (msg: string) => void;
}

const _rayOrigin = new THREE.Vector3();
const _rayDir = new THREE.Vector3();
const _projVec = new THREE.Vector3();
const _toEnemy = new THREE.Vector3();

function detectSoftwareWebGL(): boolean {
  try {
    const probeCanvas = document.createElement('canvas');
    const gl = probeCanvas.getContext('webgl2') || probeCanvas.getContext('webgl');
    if (!gl) return true;
    const ext = gl.getExtension('WEBGL_debug_renderer_info');
    const param = ext ? ext.UNMASKED_RENDERER_WEBGL : gl.RENDERER;
    const gpu = String(gl.getParameter(param) || '');
    gl.getExtension('WEBGL_lose_context')?.loseContext();
    return /SwiftShader|llvmpipe|softpipe|Software|Basic Render/i.test(gpu);
  } catch {
    return true;
  }
}

export class GameEngine {
  private container: HTMLElement;
  private callbacks: EngineCallbacks;
  private isSoftwareGl: boolean;

  private renderer!: THREE.WebGLRenderer;
  private composer: EffectComposer | null = null;
  private bloomPass: UnrealBloomPass | null = null;
  private scene!: THREE.Scene;
  private camera!: THREE.PerspectiveCamera;
  private clock = new THREE.Clock();

  public audio = new AudioSystem();
  public physics = new PhysicsSystem();
  public world!: WorldBuilder;
  public player!: PlayerController;
  public enemyMgr!: EnemyManager;
  public progression = new ProgressionSystem();
  public vfx!: VfxSystem;

  public screen: GameScreenState = 'LOADING';
  public settings: GameSettings = {
    volume: 0.7,
    quality: 'high',
    mouseSensitivity: 0.0024
  };

  private keys = new Set<string>();
  private mouseDownLeft = false;
  private mouseDownRight = false;
  private isDraggingOrbit = false;
  private lastMouseX = 0;
  private lastMouseY = 0;

  private lockedEnemy: EnemyInstance | null = null;
  private lockRingMesh!: THREE.Mesh;
  private nearestInteractable: InteractableObject | null = null;
  private activeBoss: EnemyInstance | null = null;
  private transmission: TransmissionMessage | null = null;
  private damageFlash = 0;
  private hazardTickAccum = 0;
  private dmgIdSeq = 1;
  private snapshotAccum = 0;
  private clockText = '19:12';
  private weatherText = 'Eclipse Dusk';
  private frameId = 0;
  private disposed = false;

  constructor(container: HTMLElement, callbacks: EngineCallbacks) {
    this.container = container;
    this.callbacks = callbacks;
    this.isSoftwareGl = detectSoftwareWebGL();
    this.initScene();
    (window as unknown as { __ECLIPSE_ENGINE__?: GameEngine }).__ECLIPSE_ENGINE__ = this;
  }

  private initScene(): void {
    const width = this.container.clientWidth || window.innerWidth;
    const height = this.container.clientHeight || window.innerHeight;

    try {
      this.renderer = new THREE.WebGLRenderer({
        antialias: !this.isSoftwareGl,
        powerPreference: 'high-performance'
      });
    } catch {
      this.callbacks.onWebglError('WebGL2 rendering context could not be initialized on this browser.');
      return;
    }

    this.renderer.setSize(width, height);
    this.renderer.setPixelRatio(this.isSoftwareGl ? 1 : Math.min(window.devicePixelRatio, 2));
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.1;
    this.renderer.shadowMap.enabled = !this.isSoftwareGl;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;

    this.container.appendChild(this.renderer.domElement);

    this.renderer.domElement.addEventListener('webglcontextlost', (e) => {
      e.preventDefault();
      cancelAnimationFrame(this.frameId);
      clearTimeout(this.frameId);
    });
    this.renderer.domElement.addEventListener('webglcontextrestored', () => {
      this.startLoop();
    });

    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(64, width / height, 0.1, 460);

    // Mandatory studio environment reflection for PBR metals
    const pmrem = new THREE.PMREMGenerator(this.renderer);
    this.scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
    pmrem.dispose();

    const maxAniso = this.isSoftwareGl ? 1 : this.renderer.capabilities.getMaxAnisotropy();

    // Post-processing Composer on GPU
    if (!this.isSoftwareGl) {
      this.composer = new EffectComposer(this.renderer);
      this.composer.addPass(new RenderPass(this.scene, this.camera));
      this.bloomPass = new UnrealBloomPass(new THREE.Vector2(width, height), 0.38, 0.35, 0.88);
      this.composer.addPass(this.bloomPass);
    }

    // Build Core Subsystems
    this.world = new WorldBuilder(this.scene, this.physics, maxAniso);
    this.world.buildWorld();

    this.player = new PlayerController(this.scene);
    this.enemyMgr = new EnemyManager(this.scene, this.physics);
    this.vfx = new VfxSystem(this.scene);

    // 3D Target Lock Reticle Mesh
    this.lockRingMesh = new THREE.Mesh(
      new THREE.RingGeometry(0.45, 0.58, 24),
      new THREE.MeshBasicMaterial({ color: 0xff9d00, side: THREE.DoubleSide, depthTest: false })
    );
    this.lockRingMesh.visible = false;
    this.scene.add(this.lockRingMesh);

    if (!this.isSoftwareGl) {
      this.renderer.compile(this.scene, this.camera);
    }

    this.bindInputs();
    this.applySettings(this.settings);

    // Transition from LOADING -> MENU smoothly
    this.screen = 'MENU';
    this.pushSnapshot();
    this.startLoop();
  }

  public startNewGame(): void {
    this.audio.init();
    this.audio.playUI(true);
    this.progression.resetDefaults();

    this.player.level = 1;
    this.player.xp = 0;
    this.player.xpToNext = 100;
    this.player.skillPoints = 1;
    this.player.armorLevel = 1;
    this.progression.recalculatePlayerBonuses(this.player);
    this.player.hp = this.player.maxHp;
    this.player.stamina = this.player.maxStamina;
    this.player.energy = this.player.maxEnergy;

    // Reset weapons to tier 1
    this.player.weapons.plasma_blade.upgradeLevel = 1;
    this.player.weapons.plasma_blade.baseDamage = 30;
    this.player.weapons.pulse_rifle.upgradeLevel = 1;
    this.player.weapons.pulse_rifle.baseDamage = 20;
    this.player.weapons.pulse_rifle.magSize = 30;
    this.player.weapons.pulse_rifle.currentMag = 30;
    this.player.weapons.pulse_rifle.reserveAmmo = 150;
    this.player.weapons.rail_cannon.upgradeLevel = 1;
    this.player.weapons.rail_cannon.baseDamage = 76;
    this.player.weapons.rail_cannon.magSize = 5;
    this.player.weapons.rail_cannon.currentMag = 5;
    this.player.weapons.rail_cannon.reserveAmmo = 25;
    this.player.switchWeapon('plasma_blade');

    const startY = this.physics.getTerrainHeight(0, 174);
    this.player.position.set(0, startY, 174);
    this.player.velocity.set(0, 0, 0);
    this.player.rotationY = Math.PI;
    this.player.cameraYaw = 0;
    this.player.cameraPitch = 0.22;
    this.camera.position.set(0, startY + 3.0, 180);
    this.camera.lookAt(0, startY + 1.6, 174);

    this.world.gateUnlocked = false;
    this.world.securityGateMesh.visible = true;
    this.world.securityGateCollider.active = true;
    for (const inter of this.world.interactables) {
      inter.used = false;
      inter.cooldown = 0;
      if (inter.type === 'cache') inter.mesh.visible = true;
    }

    this.lockedEnemy = null;
    this.activeBoss = null;
    this.enemyMgr.spawnInitialPopulation([]);

    this.screen = 'PLAYING';
    this.requestLock();
    this.showTransmission(
      'OPERATIVE VANGUARD-09',
      'Memory integrity partial. Locate the encrypted carrier signal pulsing from Meridian City Plaza to the north.'
    );
    this.pushSnapshot();
  }

  public continueGame(): void {
    this.audio.init();
    this.audio.playUI(true);
    const loaded = this.progression.loadGame(this.player);
    if (!loaded) {
      this.startNewGame();
      return;
    }

    this.camera.position.set(
      this.player.position.x,
      this.player.position.y + 3.0,
      this.player.position.z + 6.0
    );

    if (loaded.gateUnlocked) {
      this.world.unlockSecurityGate();
    } else {
      this.world.gateUnlocked = false;
      this.world.securityGateMesh.visible = true;
      this.world.securityGateCollider.active = true;
    }

    for (const inter of this.world.interactables) {
      inter.used = loaded.usedInteractables.includes(inter.id);
      if (inter.type === 'cache') {
        inter.mesh.visible = !inter.used;
      }
    }

    this.enemyMgr.spawnInitialPopulation(loaded.defeatedBosses || []);
    this.lockedEnemy = null;
    this.activeBoss = null;
    this.screen = 'PLAYING';
    this.requestLock();
    this.showTransmission('NEURAL LINK RESTORED', 'Checkpoint telemetry synchronized. Resume operations.');
    this.pushSnapshot();
  }

  public respawnAtBeacon(): void {
    this.audio.playUI(true);
    const y = this.physics.getTerrainHeight(12, 138);
    this.player.position.set(12, y, 138);
    this.player.velocity.set(0, 0, 0);
    this.player.cameraYaw = 0;
    this.camera.position.set(12, y + 3.0, 144);
    this.player.hp = this.player.maxHp;
    this.player.stamina = this.player.maxStamina;
    this.player.energy = this.player.maxEnergy;
    this.screen = 'PLAYING';
    this.requestLock();
    this.showTransmission('RECONSTRUCTION COMPLETE', 'Operative reconstructed at Meridian Neural Beacon.');
    this.pushSnapshot();
  }

  public resumeGame(): void {
    this.audio.playUI(true);
    this.screen = 'PLAYING';
    this.requestLock();
    this.pushSnapshot();
  }

  public openScreen(screen: GameScreenState, tab?: TacticalTab): void {
    this.screen = screen;
    this.mouseDownLeft = false;
    this.mouseDownRight = false;
    this.player.isAiming = false;
    this.player.isBlocking = false;
    if (document.pointerLockElement) {
      document.exitPointerLock();
    }
    if (tab) {
      this.callbacks.onOpenTacticalTab(tab);
    }
    this.pushSnapshot();
  }

  public applySettings(next: GameSettings): void {
    this.settings = { ...next };
    this.audio.setVolume(next.volume);

    if (!this.isSoftwareGl) {
      this.renderer.shadowMap.enabled = next.quality !== 'low';
      if (this.bloomPass) {
        this.bloomPass.enabled = next.quality === 'high';
      }
      this.renderer.setPixelRatio(
        next.quality === 'low' ? 1 : Math.min(window.devicePixelRatio, next.quality === 'high' ? 2 : 1.5)
      );
    }
    this.pushSnapshot();
  }

  public saveCheckpoint(): void {
    const usedIds = this.world.interactables.filter((i) => i.used).map((i) => i.id);
    this.progression.saveGame(this.player, usedIds, this.world.gateUnlocked);
    this.audio.playUI(true);
    this.pushSnapshot();
  }

  public useInventoryItem(itemId: string): void {
    if (this.progression.useConsumable(itemId, this.player)) {
      this.audio.playInteract();
      this.pushSnapshot();
    }
  }

  public upgradeWeapon(id: WeaponId): void {
    if (this.progression.upgradeWeapon(id, this.player)) {
      this.audio.playUI(true);
      this.pushSnapshot();
    }
  }

  public upgradeArmor(): void {
    if (this.progression.upgradeArmor(this.player)) {
      this.audio.playUI(true);
      this.pushSnapshot();
    }
  }

  public unlockSkill(skillId: string): void {
    if (this.progression.unlockSkill(skillId, this.player)) {
      this.audio.playQuestComplete();
      this.pushSnapshot();
    }
  }

  public requestLock(): void {
    const isTouchDevice = 'ontouchstart' in window || navigator.maxTouchPoints > 0;
    if (!isTouchDevice && this.screen === 'PLAYING' && document.pointerLockElement !== this.renderer.domElement) {
      try {
        this.renderer.domElement.requestPointerLock?.();
      } catch {
        // Fallback drag-orbit still works seamlessly
      }
    }
  }

  public setMobileMove(x: number, y: number, sprint = false): void {
    if (!this.player) return;
    this.player.mobileMoveX = THREE.MathUtils.clamp(x, -1, 1);
    this.player.mobileMoveY = THREE.MathUtils.clamp(y, -1, 1);
    this.player.mobileSprint = sprint;
  }

  public addTouchLookDelta(dx: number, dy: number): void {
    if (this.screen !== 'PLAYING' || !this.player) return;
    const sens = this.settings.mouseSensitivity * 1.65;
    this.player.cameraYaw -= dx * sens;
    this.player.cameraPitch = THREE.MathUtils.clamp(
      this.player.cameraPitch + dy * sens,
      -0.45,
      1.1
    );
  }

  public setTouchFireHeld(held: boolean): void {
    if (this.screen !== 'PLAYING') {
      this.mouseDownLeft = false;
      return;
    }
    this.audio.init();
    this.mouseDownLeft = held;
    if (held) {
      this.handlePrimaryFireOrMelee();
    }
  }

  public switchActiveWeapon(id: WeaponId): void {
    if (this.screen !== 'PLAYING') return;
    this.audio.init();
    this.player.switchWeapon(id);
    this.audio.playUI(true);
    this.pushSnapshot();
  }

  public triggerTouchAction(
    action:
      | 'attack'
      | 'heavy'
      | 'aimToggle'
      | 'dodge'
      | 'jump'
      | 'crouch'
      | 'reload'
      | 'interact'
      | 'lock'
      | 'emp'
      | 'shield'
      | 'lance'
      | 'heal'
      | 'flux'
  ): void {
    if (this.screen !== 'PLAYING') return;
    this.audio.init();

    switch (action) {
      case 'attack':
        this.handlePrimaryFireOrMelee();
        break;
      case 'heavy':
        this.performMeleeAttack(true);
        break;
      case 'aimToggle': {
        const w = this.player.weapons[this.player.activeWeaponId];
        if (w.type === 'ranged') {
          this.player.isAiming = !this.player.isAiming;
          this.player.isBlocking = false;
        } else {
          this.player.isBlocking = !this.player.isBlocking;
          this.player.isAiming = false;
        }
        this.pushSnapshot();
        break;
      }
      case 'dodge':
        this.player.triggerDodge(this.keys, this.audio);
        break;
      case 'jump':
        this.player.triggerJump(this.audio);
        break;
      case 'crouch':
        this.player.isCrouching = !this.player.isCrouching;
        this.pushSnapshot();
        break;
      case 'reload':
        this.player.startReload(this.audio);
        this.pushSnapshot();
        break;
      case 'interact':
        this.interactWithNearest();
        break;
      case 'lock':
        this.toggleTargetLock();
        break;
      case 'emp':
        this.triggerAbility('emp');
        break;
      case 'shield':
        this.triggerAbility('shield');
        break;
      case 'lance':
        this.triggerAbility('lance');
        break;
      case 'heal':
        this.useInventoryItem('nanite_injector');
        break;
      case 'flux':
        this.useInventoryItem('flux_cell');
        break;
    }
  }

  private bindInputs(): void {
    window.addEventListener('resize', this.handleResize);
    window.addEventListener('keydown', this.handleKeyDown);
    window.addEventListener('keyup', this.handleKeyUp);

    const dom = this.renderer.domElement;
    dom.addEventListener('mousedown', this.handleMouseDown);
    window.addEventListener('mouseup', this.handleMouseUp);
    window.addEventListener('mousemove', this.handleMouseMove);
    dom.addEventListener('contextmenu', (e) => e.preventDefault());
  }

  private handleResize = (): void => {
    if (this.disposed) return;
    const width = this.container.clientWidth || window.innerWidth;
    const height = this.container.clientHeight || window.innerHeight;
    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(width, height);
    if (this.composer) {
      this.composer.setSize(width, height);
    }
    if (this.bloomPass) {
      this.bloomPass.resolution.set(width, height);
    }
  };

  private handleKeyDown = (e: KeyboardEvent): void => {
    if (this.screen === 'MENU' || this.screen === 'GAME_OVER' || this.screen === 'VICTORY') return;

    if (e.code === 'Escape') {
      if (this.screen === 'PLAYING') {
        this.openScreen('PAUSED');
      } else if (this.screen === 'PAUSED' || this.screen === 'TACTICAL') {
        this.resumeGame();
      }
      return;
    }

    // Tactical menu shortcuts
    const tabMap: Record<string, TacticalTab> = {
      KeyI: 'inventory',
      KeyK: 'skills',
      KeyJ: 'quests',
      KeyM: 'map'
    };
    if (tabMap[e.code]) {
      e.preventDefault();
      if (this.screen === 'PLAYING') {
        this.openScreen('TACTICAL', tabMap[e.code]);
      } else if (this.screen === 'TACTICAL') {
        this.resumeGame();
      }
      return;
    }

    if (this.screen !== 'PLAYING') return;
    this.keys.add(e.code);

    if (e.code === 'Digit1') {
      this.player.switchWeapon('plasma_blade');
      this.audio.playUI(true);
      this.pushSnapshot();
    } else if (e.code === 'Digit2') {
      this.player.switchWeapon('pulse_rifle');
      this.audio.playUI(true);
      this.pushSnapshot();
    } else if (e.code === 'Digit3') {
      this.player.switchWeapon('rail_cannon');
      this.audio.playUI(true);
      this.pushSnapshot();
    } else if (e.code === 'KeyR') {
      this.player.startReload(this.audio);
      this.pushSnapshot();
    } else if (e.code === 'KeyC') {
      this.player.isCrouching = !this.player.isCrouching;
      this.pushSnapshot();
    } else if (e.code === 'ControlLeft' || e.code === 'AltLeft' || e.code === 'KeyV') {
      this.player.triggerDodge(this.keys, this.audio);
    } else if (e.code === 'KeyF') {
      this.performMeleeAttack(true);
    } else if (e.code === 'KeyQ') {
      this.triggerAbility('emp');
    } else if (e.code === 'KeyZ') {
      this.triggerAbility('shield');
    } else if (e.code === 'KeyX') {
      this.triggerAbility('lance');
    } else if (e.code === 'KeyE') {
      this.interactWithNearest();
    } else if (e.code === 'Tab') {
      e.preventDefault();
      this.toggleTargetLock();
    } else if (e.code === 'KeyH') {
      this.useInventoryItem('nanite_injector');
    } else if (e.code === 'KeyG') {
      this.useInventoryItem('flux_cell');
    }
  };

  private handleKeyUp = (e: KeyboardEvent): void => {
    this.keys.delete(e.code);
  };

  private handleMouseDown = (e: MouseEvent): void => {
    if (this.screen !== 'PLAYING') return;
    this.audio.init();
    this.requestLock();

    this.lastMouseX = e.clientX;
    this.lastMouseY = e.clientY;

    if (e.button === 0) {
      this.mouseDownLeft = true;
      this.isDraggingOrbit = true;
      this.handlePrimaryFireOrMelee();
    } else if (e.button === 2) {
      this.mouseDownRight = true;
      this.isDraggingOrbit = true;
      const w = this.player.weapons[this.player.activeWeaponId];
      if (w.type === 'ranged') {
        this.player.isAiming = true;
      } else {
        this.player.isBlocking = true;
      }
      this.pushSnapshot();
    }
  };

  private handleMouseUp = (e: MouseEvent): void => {
    if (e.button === 0) {
      this.mouseDownLeft = false;
      if (!this.mouseDownRight) this.isDraggingOrbit = false;
    } else if (e.button === 2) {
      this.mouseDownRight = false;
      if (!this.mouseDownLeft) this.isDraggingOrbit = false;
      this.player.isAiming = false;
      this.player.isBlocking = false;
      this.pushSnapshot();
    }
  };

  private handleMouseMove = (e: MouseEvent): void => {
    if (this.screen !== 'PLAYING') return;
    if (document.pointerLockElement === this.renderer.domElement) {
      this.player.cameraYaw -= e.movementX * this.settings.mouseSensitivity;
      this.player.cameraPitch = THREE.MathUtils.clamp(
        this.player.cameraPitch + e.movementY * this.settings.mouseSensitivity,
        -0.45,
        1.1
      );
    } else if (this.isDraggingOrbit) {
      const dx = e.clientX - this.lastMouseX;
      const dy = e.clientY - this.lastMouseY;
      this.lastMouseX = e.clientX;
      this.lastMouseY = e.clientY;
      this.player.cameraYaw -= dx * this.settings.mouseSensitivity * 1.4;
      this.player.cameraPitch = THREE.MathUtils.clamp(
        this.player.cameraPitch + dy * this.settings.mouseSensitivity * 1.4,
        -0.45,
        1.1
      );
    }
  };

  private handlePrimaryFireOrMelee(): void {
    const w = this.player.weapons[this.player.activeWeaponId];
    if (w.type === 'melee') {
      this.performMeleeAttack(false);
    } else {
      this.fireRangedWeapon();
    }
  }

  private performMeleeAttack(heavy: boolean): void {
    if (this.player.attackCooldown > 0 || this.player.isDodging) return;
    const stamCost = heavy ? 24 : 10;
    if (this.player.stamina < stamCost) return;

    this.player.stamina -= stamCost;
    const w = this.player.weapons.plasma_blade;
    this.player.attackCooldown = heavy ? 0.62 : w.fireRate;
    this.player.comboStep = (this.player.comboStep + 1) % 3;
    this.player.comboResetTimer = 1.1;

    this.audio.playMeleeSwing(heavy);
    this.vfx.spawnSlashArc(this.player.position, this.player.rotationY, this.player.comboStep, heavy);

    // Lunge forward slightly
    const dirX = Math.sin(this.player.rotationY);
    const dirZ = Math.cos(this.player.rotationY);
    this.player.position.x += dirX * (heavy ? 0.85 : 0.45);
    this.player.position.z += dirZ * (heavy ? 0.85 : 0.45);
    this.physics.resolveHorizontalCollision(this.player.position, 0.55);

    const reach = heavy ? 4.4 : 3.7;
    const comboBonus = this.player.comboStep === 2 ? 1.25 : 1.0;
    const rawDmg = w.baseDamage * (heavy ? 1.85 : comboBonus) * this.player.meleeMultiplier;
    const stagger = w.staggerPower * (heavy ? 2.1 : 1.0);

    let hitAny = false;
    for (const e of this.enemyMgr.enemies) {
      if (e.state === 'DEAD') continue;
      const dist = e.position.distanceTo(this.player.position);
      if (dist <= reach + e.hitRadius) {
        _toEnemy.set(e.position.x - this.player.position.x, 0, e.position.z - this.player.position.z).normalize();
        const dot = _toEnemy.x * dirX + _toEnemy.z * dirZ;
        if (dot > 0.1 || dist < 1.8) {
          const isCrit = heavy || e.state === 'STAGGERED';
          const res = this.enemyMgr.applyDamage(e, rawDmg, stagger, isCrit, this.audio);
          hitAny = true;
          this.vfx.spawnHitSparks(
            new THREE.Vector3(e.position.x, e.position.y + e.heightOffset, e.position.z),
            isCrit ? 0xff9d00 : 0x00f0ff,
            10
          );
          this.emitFloatingDamage(
            new THREE.Vector3(e.position.x, e.position.y + e.heightOffset + 0.6, e.position.z),
            `${res.finalDamage}${isCrit ? '!' : ''}`,
            isCrit ? '#ff9d00' : '#00f0ff'
          );
          if (res.killed) this.handleEnemyKilled(e);
        }
      }
    }
    if (hitAny) this.audio.playMeleeHit(heavy);
  }

  private fireRangedWeapon(): void {
    const w = this.player.weapons[this.player.activeWeaponId];
    if (w.type !== 'ranged' || this.player.attackCooldown > 0 || this.player.reloadTimer > 0) return;

    if (w.currentMag <= 0) {
      this.player.startReload(this.audio);
      return;
    }

    w.currentMag--;
    this.player.attackCooldown = w.fireRate;
    this.player.recoilPitch += w.id === 'rail_cannon' ? 0.065 : 0.018;

    if (w.id === 'rail_cannon') {
      this.audio.playRailCannon();
      this.player.triggerMuzzleFlash(0xff9d00);
    } else {
      this.audio.playPulseShot();
      this.player.triggerMuzzleFlash(0x00f0ff);
    }

    // Raycast from camera center along look direction against enemies
    this.camera.getWorldPosition(_rayOrigin);
    this.camera.getWorldDirection(_rayDir);

    const muzzlePos = this.player.position
      .clone()
      .add(new THREE.Vector3(Math.sin(this.player.rotationY) * 0.65, 1.4, Math.cos(this.player.rotationY) * 0.65));

    let bestHitEnemy: EnemyInstance | null = null;
    let bestT = 130;
    let bestPoint = _rayOrigin.clone().addScaledVector(_rayDir, 90);
    let hitWeakPoint = false;

    for (const e of this.enemyMgr.enemies) {
      if (e.state === 'DEAD') continue;
      const center = new THREE.Vector3(e.position.x, e.position.y + e.heightOffset, e.position.z);
      const toCenter = center.clone().sub(_rayOrigin);
      const t = toCenter.dot(_rayDir);
      if (t < 1.5 || t > bestT) continue;

      const closestPt = _rayOrigin.clone().addScaledVector(_rayDir, t);
      const distSq = closestPt.distanceToSquared(center);
      const hitRad = e.hitRadius + (w.id === 'rail_cannon' ? 0.35 : 0.2);

      if (distSq <= hitRad * hitRad) {
        bestT = t;
        bestHitEnemy = e;
        bestPoint = closestPt;
        hitWeakPoint = Boolean(e.weakPointMesh && closestPt.y >= e.position.y + e.heightOffset - 0.3);
      }
    }

    this.vfx.spawnBeam(
      muzzlePos,
      bestPoint,
      w.id === 'rail_cannon' ? 0xff9d00 : 0x00f0ff,
      w.id === 'rail_cannon' ? 2.2 : 0.9,
      w.id === 'rail_cannon' ? 0.24 : 0.1
    );

    if (bestHitEnemy) {
      const dmg = w.baseDamage * this.player.rangedMultiplier;
      const res = this.enemyMgr.applyDamage(bestHitEnemy, dmg, w.staggerPower, hitWeakPoint, this.audio);
      this.vfx.spawnHitSparks(bestPoint, hitWeakPoint ? 0xff9d00 : 0x00f0ff, w.id === 'rail_cannon' ? 14 : 6);
      this.emitFloatingDamage(
        bestPoint,
        `${res.finalDamage}${hitWeakPoint ? ' CRIT' : ''}`,
        hitWeakPoint ? '#ff9d00' : '#e6f1ff'
      );
      if (res.killed) this.handleEnemyKilled(bestHitEnemy);
    }

    if (w.currentMag === 0 && w.reserveAmmo > 0) {
      this.player.startReload(this.audio);
    }
    this.pushSnapshot();
  }

  private triggerAbility(type: 'emp' | 'shield' | 'lance'): void {
    const cdMult = 1 - this.player.cooldownReduction;

    if (type === 'emp') {
      if (this.player.abilityCooldowns.q > 0 || this.player.energy < 30) return;
      this.player.energy -= 30;
      this.player.abilityCooldowns.q = this.player.abilityMaxCooldowns.q * cdMult;
      this.audio.playAbility('emp');
      this.vfx.spawnShockwaveRing(this.player.position, 0x00f0ff, 26, 0.55);

      const dmg = 55 * this.player.abilityMultiplier;
      for (const e of this.enemyMgr.enemies) {
        if (e.state === 'DEAD') continue;
        if (e.position.distanceTo(this.player.position) <= 10.5) {
          const res = this.enemyMgr.applyDamage(e, dmg, 65, false, this.audio);
          this.emitFloatingDamage(
            new THREE.Vector3(e.position.x, e.position.y + e.heightOffset + 0.5, e.position.z),
            `${res.finalDamage} EMP`,
            '#00f0ff'
          );
          if (res.killed) this.handleEnemyKilled(e);
        }
      }
    } else if (type === 'shield') {
      if (this.player.abilityCooldowns.z > 0 || this.player.energy < 25) return;
      this.player.energy -= 25;
      this.player.abilityCooldowns.z = this.player.abilityMaxCooldowns.z * cdMult;
      this.player.shieldBuffTimer = 6.5;
      this.audio.playAbility('shield');
      this.showTransmission('AEGIS BARRIER', 'Defensive energy lattice active (75% damage mitigation for 6.5s).');
    } else if (type === 'lance') {
      if (this.player.abilityCooldowns.x > 0 || this.player.energy < 40) return;
      this.player.energy -= 40;
      this.player.abilityCooldowns.x = this.player.abilityMaxCooldowns.x * cdMult;
      this.audio.playAbility('lance');

      this.camera.getWorldPosition(_rayOrigin);
      this.camera.getWorldDirection(_rayDir);
      const start = this.player.position.clone().add(new THREE.Vector3(0, 1.4, 0));
      const end = _rayOrigin.clone().addScaledVector(_rayDir, 65);
      this.vfx.spawnBeam(start, end, 0xb845ff, 4.2, 0.32);

      const dmg = 115 * this.player.abilityMultiplier;
      for (const e of this.enemyMgr.enemies) {
        if (e.state === 'DEAD') continue;
        const center = new THREE.Vector3(e.position.x, e.position.y + e.heightOffset, e.position.z);
        const t = center.clone().sub(_rayOrigin).dot(_rayDir);
        if (t > 1 && t < 65) {
          const closest = _rayOrigin.clone().addScaledVector(_rayDir, t);
          if (closest.distanceTo(center) <= e.hitRadius + 1.4) {
            const res = this.enemyMgr.applyDamage(e, dmg, 45, true, this.audio);
            this.vfx.spawnHitSparks(center, 0xb845ff, 12);
            this.emitFloatingDamage(center, `${res.finalDamage} LANCE`, '#d580ff');
            if (res.killed) this.handleEnemyKilled(e);
          }
        }
      }
    }
    this.pushSnapshot();
  }

  private toggleTargetLock(): void {
    if (this.lockedEnemy && this.lockedEnemy.state !== 'DEAD') {
      this.lockedEnemy = null;
      this.lockRingMesh.visible = false;
      this.audio.playUI(false);
      this.pushSnapshot();
      return;
    }

    let best: EnemyInstance | null = null;
    let bestDist = 38;
    for (const e of this.enemyMgr.enemies) {
      if (e.state === 'DEAD') continue;
      const d = e.position.distanceTo(this.player.position);
      if (d < bestDist) {
        bestDist = d;
        best = e;
      }
    }
    if (best) {
      this.lockedEnemy = best;
      this.audio.playUI(true);
    }
    this.pushSnapshot();
  }

  private interactWithNearest(): void {
    const inter = this.nearestInteractable;
    if (!inter) return;

    this.audio.playInteract();

    if (inter.type === 'datapad' && inter.payloadId) {
      inter.used = true;
      const doc = this.progression.loreDocs.find((l) => l.id === inter.payloadId);
      if (doc && !doc.discovered) {
        doc.discovered = true;
        this.progression.advanceObjective('obj_collect_lore', 1, this.player, (s, m) => this.showTransmission(s, m));
        this.showTransmission(`ARCHIVE: ${doc.title}`, doc.content);
      } else if (doc) {
        this.showTransmission(`ARCHIVE: ${doc.title}`, doc.content);
      }
    } else if (inter.type === 'terminal') {
      if (inter.payloadId === 'relay_decrypted' && !inter.used) {
        inter.used = true;
        this.progression.advanceObjective('obj_decrypt_relay', 1, this.player, (s, m) => this.showTransmission(s, m));
        this.audio.playQuestComplete();
      } else if (inter.payloadId === 'override_gate' && !this.world.gateUnlocked) {
        const hasKey = this.progression.inventory.some((i) => i.id === 'nexus_keycard' && i.quantity > 0);
        if (hasKey || this.progression.defeatedBosses.includes('BOSS_COLOSSUS')) {
          inter.used = true;
          this.world.unlockSecurityGate();
          this.showTransmission('SECURITY GATE OVERRIDE', 'NEXUS laser barrier deactivated. Core sector access granted.');
        } else {
          this.showTransmission(
            'ACCESS DENIED',
            'Omega Override Key required. Destroy The Iron Colossus in the Eastern Wastelands first.'
          );
        }
      }
    } else if (inter.type === 'cache' && !inter.used) {
      inter.used = true;
      inter.mesh.visible = false;
      this.progression.scrap += 65;
      this.progression.addItem('nanite_injector', 'Nanite Med-Injector', 'consumable', 1, 'Restores +65 Integrity.');
      this.player.weapons.pulse_rifle.reserveAmmo = Math.min(
        this.player.weapons.pulse_rifle.maxReserve,
        this.player.weapons.pulse_rifle.reserveAmmo + 45
      );
      this.player.weapons.rail_cannon.reserveAmmo = Math.min(
        this.player.weapons.rail_cannon.maxReserve,
        this.player.weapons.rail_cannon.reserveAmmo + 6
      );
      this.showTransmission('SUPPLY CACHE SALVAGED', '+65 Salvage Scrap · +1 Nanite Med-Injector · Munitions Replenished.');
    } else if (inter.type === 'beacon') {
      this.player.hp = this.player.maxHp;
      this.player.stamina = this.player.maxStamina;
      this.player.energy = this.player.maxEnergy;
      this.saveCheckpoint();
      this.showTransmission('NEURAL BEACON SYNCHRONIZED', 'Vitals fully restored and checkpoint written to memory.');
    } else if (inter.type === 'overload_pylon' && !inter.used) {
      inter.used = true;
      inter.cooldown = 16.0;
      const nexusBoss = this.enemyMgr.enemies.find((e) => e.archetype === 'BOSS_NEXUS' && e.state !== 'DEAD');
      if (nexusBoss) {
        const bossCenter = new THREE.Vector3(nexusBoss.position.x, nexusBoss.position.y + 4.0, nexusBoss.position.z);
        this.vfx.spawnBeam(inter.position.clone().add(new THREE.Vector3(0, 1.5, 0)), bossCenter, 0x00ff9d, 3.8, 0.5);
        this.vfx.spawnHitSparks(bossCenter, 0x00ff9d, 16);
        const res = this.enemyMgr.applyDamage(nexusBoss, 170, 200, true, this.audio);
        this.emitFloatingDamage(bossCenter, `${res.finalDamage} OVERLOAD`, '#00ff9d');
        this.showTransmission('CORE PYLON DISCHARGED', 'Energy surge shattered NEXUS Prime’s shields and stunned its core!');
        if (res.killed) this.handleEnemyKilled(nexusBoss);
      }
    }
    this.pushSnapshot();
  }

  private handleEnemyKilled(e: EnemyInstance): void {
    const leveled = this.player.addXp(e.xpValue);
    this.progression.scrap += e.archetype.startsWith('BOSS') ? 150 : 28;
    if (leveled) {
      this.progression.recalculatePlayerBonuses(this.player);
      this.audio.playQuestComplete();
      this.showTransmission(
        'NEURAL LEVEL UP',
        `Operative reached Level ${this.player.level}! +1 Praxis Point awarded for the Neural Matrix [K].`
      );
    }

    if (e.position.z > 30) {
      this.progression.advanceObjective('obj_clear_patrols', 1, this.player, (s, m) => this.showTransmission(s, m));
    } else if (e.position.z >= -95 && !e.archetype.startsWith('BOSS')) {
      this.progression.advanceObjective('obj_purge_waste', 1, this.player, (s, m) => this.showTransmission(s, m));
    }

    if (e.archetype === 'BOSS_COLOSSUS') {
      if (!this.progression.defeatedBosses.includes('BOSS_COLOSSUS')) {
        this.progression.defeatedBosses.push('BOSS_COLOSSUS');
      }
      this.progression.advanceObjective(
        'obj_kill_colossus',
        1,
        this.player,
        (s, m) => this.showTransmission(s, m),
        () => this.world.unlockSecurityGate()
      );
      this.audio.playQuestComplete();
    } else if (e.archetype === 'BOSS_NEXUS') {
      if (!this.progression.defeatedBosses.includes('BOSS_NEXUS')) {
        this.progression.defeatedBosses.push('BOSS_NEXUS');
      }
      this.progression.advanceObjective('obj_kill_nexus', 1, this.player, (s, m) => this.showTransmission(s, m));
      this.audio.playQuestComplete();
      this.saveCheckpoint();
      this.openScreen('VICTORY');
    }

    if (this.lockedEnemy === e) {
      this.lockedEnemy = null;
      this.lockRingMesh.visible = false;
    }
  }

  private showTransmission(speaker: string, text: string): void {
    this.transmission = {
      speaker,
      text,
      expiresAt: performance.now() + 6500
    };
  }

  private emitFloatingDamage(worldPos: THREE.Vector3, text: string, color: string): void {
    _projVec.copy(worldPos).project(this.camera);
    if (_projVec.z > 1) return;
    const width = this.container.clientWidth || window.innerWidth;
    const height = this.container.clientHeight || window.innerHeight;
    const sx = (_projVec.x * 0.5 + 0.5) * width;
    const sy = (-_projVec.y * 0.5 + 0.5) * height;
    this.callbacks.onFloatingDamage({
      id: this.dmgIdSeq++,
      x: sx,
      y: sy,
      text,
      color
    });
  }

  private startLoop(): void {
    const tick = () => {
      if (this.disposed) return;

      const dt = Math.min(this.clock.getDelta(), 0.05);

      if (this.screen === 'PLAYING') {
        this.updatePlaying(dt);
      } else if (this.screen === 'MENU') {
        // Gentle scenic orbit preview behind Main Menu
        const t = performance.now() * 0.00018;
        this.camera.position.set(Math.sin(t) * 65, 28, 125 + Math.cos(t) * 35);
        this.camera.lookAt(0, 8, 95);
        this.world.update(dt, this.player.position);
      }

      if (this.composer && !this.isSoftwareGl && this.settings.quality === 'high') {
        this.composer.render();
      } else {
        this.renderer.render(this.scene, this.camera);
      }

      if (this.isSoftwareGl) {
        this.afterDraw(tick);
      } else {
        this.frameId = requestAnimationFrame(tick);
      }
    };

    if (this.isSoftwareGl) {
      this.frameId = window.setTimeout(tick, 16);
    } else {
      this.frameId = requestAnimationFrame(tick);
    }
  }

  private afterDraw(cb: () => void): void {
    const gl = this.renderer.getContext() as WebGL2RenderingContext;
    if (!gl || !gl.fenceSync) {
      this.frameId = window.setTimeout(cb, 80);
      return;
    }
    const sync = gl.fenceSync(gl.SYNC_GPU_COMMANDS_COMPLETE, 0);
    gl.flush();
    const poll = () => {
      if (this.disposed) return;
      const state = sync && gl.getSyncParameter(sync, gl.SYNC_STATUS);
      if (state === gl.UNSIGNALED) {
        this.frameId = window.setTimeout(poll, 5);
      } else {
        if (sync) gl.deleteSync(sync);
        this.frameId = window.setTimeout(cb, 80);
      }
    };
    this.frameId = window.setTimeout(poll, 5);
  }

  private updatePlaying(dt: number): void {
    // Auto-fire support for Pulse Rifle while holding LMB
    if (this.mouseDownLeft && this.player.activeWeaponId === 'pulse_rifle') {
      this.fireRangedWeapon();
    }

    const lockTargetPos =
      this.lockedEnemy && this.lockedEnemy.state !== 'DEAD' ? this.lockedEnemy.position : null;

    this.player.update(dt, this.keys, this.physics, this.camera, this.audio, lockTargetPos);

    // Update 3D target lock reticle
    if (this.lockedEnemy && this.lockedEnemy.state !== 'DEAD') {
      if (this.lockedEnemy.position.distanceTo(this.player.position) > 48) {
        this.lockedEnemy = null;
        this.lockRingMesh.visible = false;
      } else {
        this.lockRingMesh.visible = true;
        this.lockRingMesh.position.set(
          this.lockedEnemy.position.x,
          this.lockedEnemy.position.y + this.lockedEnemy.heightOffset,
          this.lockedEnemy.position.z
        );
        this.lockRingMesh.lookAt(this.camera.position);
        this.lockRingMesh.rotation.z += dt * 2.5;
      }
    } else {
      this.lockRingMesh.visible = false;
    }

    // Update Enemy AI & Boss state
    this.activeBoss = this.enemyMgr.update(
      dt,
      this.player,
      this.audio,
      this.vfx,
      (dmg, blocked) => {
        if (dmg > 0) {
          this.damageFlash = 1.0;
          this.emitFloatingDamage(
            this.player.position.clone().add(new THREE.Vector3(0, 2.0, 0)),
            blocked ? `${dmg} BLOCKED` : `-${dmg}`,
            blocked ? '#00f0ff' : '#ff2a54'
          );
          if (this.player.hp <= 0) {
            this.openScreen('GAME_OVER');
          }
        }
      },
      (boss) => {
        if (boss.archetype === 'BOSS_COLOSSUS') {
          this.showTransmission(
            'ALERT: THE IRON COLOSSUS',
            'Autonomous siege mech detected! Target its glowing chest thermal core for critical stagger.'
          );
        } else {
          this.showTransmission(
            'NEXUS PRIME AWAKENS',
            '“Operative Vanguard-09. Humanity’s survival probability remains 0.6%. Quarantine protocol engaged.”'
          );
        }
      }
    );
    this.audio.setBossMode(Boolean(this.activeBoss));

    // Environmental Thermal Hazard Check (Ashen Wastelands)
    this.hazardTickAccum += dt;
    if (this.hazardTickAccum >= 0.5) {
      this.hazardTickAccum = 0;
      for (const hz of this.physics.hazards) {
        const d = Math.hypot(this.player.position.x - hz.x, this.player.position.z - hz.z);
        if (d < hz.radius && this.player.position.y < this.physics.getTerrainHeight(hz.x, hz.z) + 2.0) {
          const res = this.player.takeDamage(hz.dps * 0.5, this.audio);
          if (res.dmg > 0) {
            this.damageFlash = 0.65;
            this.emitFloatingDamage(
              this.player.position.clone().add(new THREE.Vector3(0, 2.0, 0)),
              `-${res.dmg} THERMAL`,
              '#ff6a00'
            );
            if (this.player.hp <= 0) this.openScreen('GAME_OVER');
          }
        }
      }
    }

    // Check nearest interactable
    this.nearestInteractable = null;
    let bestIntDist = 4.4;
    for (const inter of this.world.interactables) {
      if (inter.used && inter.type !== 'beacon') continue;
      const d = inter.position.distanceTo(this.player.position);
      if (d < bestIntDist) {
        bestIntDist = d;
        this.nearestInteractable = inter;
      }
    }

    const env = this.world.update(dt, this.player.position);
    this.clockText = env.clockText;
    this.weatherText = env.weatherText;
    this.vfx.update(dt);

    if (this.damageFlash > 0) {
      this.damageFlash = Math.max(0, this.damageFlash - dt * 2.5);
    }
    if (this.transmission && performance.now() > this.transmission.expiresAt) {
      this.transmission = null;
    }

    this.snapshotAccum += dt;
    if (this.snapshotAccum >= 0.05) {
      this.snapshotAccum = 0;
      this.pushSnapshot();
    }
  }

  public pushSnapshot(): void {
    const reg = this.physics.getRegionAt(this.player.position.x, this.player.position.z);

    const snap: HudSnapshot = {
      screen: this.screen,
      regionId: reg.id,
      regionName: reg.name,
      clockText: this.clockText,
      weatherText: this.weatherText,
      level: this.player.level,
      xp: this.player.xp,
      xpToNext: this.player.xpToNext,
      skillPoints: this.player.skillPoints,
      hp: Math.round(this.player.hp),
      maxHp: Math.round(this.player.maxHp),
      stamina: Math.round(this.player.stamina),
      maxStamina: Math.round(this.player.maxStamina),
      energy: Math.round(this.player.energy),
      maxEnergy: Math.round(this.player.maxEnergy),
      armorLevel: this.player.armorLevel,
      damageReduction: this.player.damageReduction,
      meleeMultiplier: this.player.meleeMultiplier,
      rangedMultiplier: this.player.rangedMultiplier,
      abilityMultiplier: this.player.abilityMultiplier,
      scrap: this.progression.scrap,
      activeWeaponId: this.player.activeWeaponId,
      weapons: {
        plasma_blade: { ...this.player.weapons.plasma_blade },
        pulse_rifle: { ...this.player.weapons.pulse_rifle },
        rail_cannon: { ...this.player.weapons.rail_cannon }
      },
      isReloading: this.player.reloadTimer > 0,
      isAiming: this.player.isAiming,
      isBlocking: this.player.isBlocking,
      isCrouching: this.player.isCrouching,
      shieldActive: this.player.shieldBuffTimer > 0,
      abilityCooldowns: { ...this.player.abilityCooldowns },
      abilityMaxCooldowns: { ...this.player.abilityMaxCooldowns },
      targetLock:
        this.lockedEnemy && this.lockedEnemy.state !== 'DEAD'
          ? {
              name: this.lockedEnemy.name,
              hp: this.lockedEnemy.hp,
              maxHp: this.lockedEnemy.maxHp,
              stagger: this.lockedEnemy.stagger,
              maxStagger: this.lockedEnemy.maxStagger
            }
          : null,
      activeBoss: this.activeBoss
        ? {
            name: this.activeBoss.name,
            phaseText:
              this.activeBoss.phase === 1
                ? 'Phase I · Containment Protocol'
                : 'Phase II · Overdrive Assault',
            hp: this.activeBoss.hp,
            maxHp: this.activeBoss.maxHp,
            stagger: this.activeBoss.stagger,
            maxStagger: this.activeBoss.maxStagger
          }
        : null,
      interactPrompt: this.nearestInteractable ? this.nearestInteractable.label : null,
      transmission: this.transmission,
      activeMainQuest: this.progression.getActiveMainQuest(),
      quests: this.progression.quests.map((q) => ({
        ...q,
        objectives: q.objectives.map((o) => ({ ...o }))
      })),
      skills: this.progression.skills.map((s) => ({ ...s })),
      inventory: this.progression.inventory.map((i) => ({ ...i })),
      loreDocs: this.progression.loreDocs.map((l) => ({ ...l })),
      playerPos: {
        x: this.player.position.x,
        z: this.player.position.z,
        yaw: this.player.rotationY
      },
      interactablesMap: this.world.interactables.map((i) => ({
        id: i.id,
        type: i.type,
        x: i.position.x,
        z: i.position.z,
        used: i.used
      })),
      bossesMap: this.enemyMgr.enemies
        .filter((e) => e.archetype.startsWith('BOSS'))
        .map((b) => ({
          name: b.name,
          x: b.position.x,
          z: b.position.z,
          alive: b.state !== 'DEAD'
        })),
      damageFlash: this.damageFlash,
      hasSaveData: this.progression.hasSave()
    };

    this.callbacks.onSnapshot(snap);
  }

  public dispose(): void {
    this.disposed = true;
    cancelAnimationFrame(this.frameId);
    clearTimeout(this.frameId);

    window.removeEventListener('resize', this.handleResize);
    window.removeEventListener('keydown', this.handleKeyDown);
    window.removeEventListener('keyup', this.handleKeyUp);
    window.removeEventListener('mouseup', this.handleMouseUp);
    window.removeEventListener('mousemove', this.handleMouseMove);

    this.audio.dispose();
    this.renderer?.dispose();
    if (this.renderer?.domElement && this.renderer.domElement.parentNode === this.container) {
      this.container.removeChild(this.renderer.domElement);
    }
  }
}
