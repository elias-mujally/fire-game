import * as THREE from 'three';

export type RegionId = 'MERIDIAN_CITY' | 'ASHEN_WASTELANDS' | 'NEXUS_COMPLEX';

export type WeaponId = 'plasma_blade' | 'pulse_rifle' | 'rail_cannon';

export type QualityLevel = 'high' | 'medium' | 'low';

export type GameScreenState = 'LOADING' | 'MENU' | 'PLAYING' | 'PAUSED' | 'TACTICAL' | 'GAME_OVER' | 'VICTORY';

export type TacticalTab = 'inventory' | 'skills' | 'quests' | 'map' | 'settings';

export interface WeaponData {
  id: WeaponId;
  name: string;
  type: 'melee' | 'ranged';
  baseDamage: number;
  upgradeLevel: number;
  fireRate: number;
  magSize: number;
  currentMag: number;
  reserveAmmo: number;
  maxReserve: number;
  reloadTime: number;
  staggerPower: number;
}

export interface InventoryItem {
  id: string;
  name: string;
  category: 'consumable' | 'resource' | 'keycard';
  quantity: number;
  description: string;
}

export interface SkillNodeData {
  id: string;
  name: string;
  branch: 'Vanguard' | 'Ballistics' | 'Technomancy';
  description: string;
  cost: number;
  unlocked: boolean;
}

export interface QuestObjective {
  id: string;
  description: string;
  current: number;
  required: number;
  completed: boolean;
  targetPos?: { x: number; z: number };
}

export interface QuestData {
  id: string;
  title: string;
  isMain: boolean;
  status: 'locked' | 'active' | 'completed';
  description: string;
  objectives: QuestObjective[];
  xpReward: number;
  scrapReward: number;
}

export interface LoreDocument {
  id: string;
  title: string;
  region: RegionId;
  content: string;
  discovered: boolean;
}

export interface InteractableObject {
  id: string;
  type: 'datapad' | 'cache' | 'beacon' | 'terminal' | 'overload_pylon';
  label: string;
  position: THREE.Vector3;
  mesh: THREE.Object3D;
  used: boolean;
  cooldown?: number;
  payloadId?: string;
}

export type EnemyArchetype =
  | 'SCOUT_DRONE'
  | 'HUNTER_MACHINE'
  | 'HEAVY_GUARDIAN'
  | 'MUTATED_CREATURE'
  | 'BOSS_COLOSSUS'
  | 'BOSS_NEXUS';

export interface FloatingDamage {
  id: number;
  x: number;
  y: number;
  text: string;
  color: string;
}

export interface TransmissionMessage {
  speaker: string;
  text: string;
  expiresAt: number;
}

export interface GameSettings {
  volume: number;
  quality: QualityLevel;
  mouseSensitivity: number;
}

export interface HudSnapshot {
  screen: GameScreenState;
  regionId: RegionId;
  regionName: string;
  clockText: string;
  weatherText: string;
  level: number;
  xp: number;
  xpToNext: number;
  skillPoints: number;
  hp: number;
  maxHp: number;
  stamina: number;
  maxStamina: number;
  energy: number;
  maxEnergy: number;
  armorLevel: number;
  damageReduction: number;
  meleeMultiplier: number;
  rangedMultiplier: number;
  abilityMultiplier: number;
  scrap: number;
  activeWeaponId: WeaponId;
  weapons: Record<WeaponId, WeaponData>;
  isReloading: boolean;
  isAiming: boolean;
  isBlocking: boolean;
  isCrouching: boolean;
  shieldActive: boolean;
  abilityCooldowns: { q: number; z: number; x: number };
  abilityMaxCooldowns: { q: number; z: number; x: number };
  targetLock: { name: string; hp: number; maxHp: number; stagger: number; maxStagger: number } | null;
  activeBoss: { name: string; phaseText: string; hp: number; maxHp: number; stagger: number; maxStagger: number } | null;
  interactPrompt: string | null;
  transmission: TransmissionMessage | null;
  activeMainQuest: QuestData | null;
  quests: QuestData[];
  skills: SkillNodeData[];
  inventory: InventoryItem[];
  loreDocs: LoreDocument[];
  playerPos: { x: number; z: number; yaw: number };
  interactablesMap: { id: string; type: string; x: number; z: number; used: boolean }[];
  bossesMap: { name: string; x: number; z: number; alive: boolean }[];
  damageFlash: number;
  hasSaveData: boolean;
}

export interface SaveState {
  playerPos: { x: number; y: number; z: number };
  level: number;
  xp: number;
  xpToNext: number;
  skillPoints: number;
  hp: number;
  armorLevel: number;
  scrap: number;
  weapons: Record<WeaponId, { upgradeLevel: number; baseDamage: number; currentMag: number; reserveAmmo: number }>;
  inventory: InventoryItem[];
  unlockedSkills: string[];
  quests: {
    id: string;
    status: 'locked' | 'active' | 'completed';
    objectives: { id: string; current: number; completed: boolean }[];
  }[];
  discoveredLore: string[];
  usedInteractables: string[];
  defeatedBosses: string[];
  gateUnlocked: boolean;
}
