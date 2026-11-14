import {
  InventoryItem,
  LoreDocument,
  QuestData,
  SaveState,
  SkillNodeData,
  WeaponId
} from './types';
import { PlayerController } from './PlayerController';

const SAVE_KEY = 'project_eclipse_save_v1';

export class ProgressionSystem {
  public scrap = 140;
  public defeatedBosses: string[] = [];

  public inventory: InventoryItem[] = [];
  public skills: SkillNodeData[] = [];
  public quests: QuestData[] = [];
  public loreDocs: LoreDocument[] = [];

  constructor() {
    this.resetDefaults();
  }

  public resetDefaults(): void {
    this.scrap = 140;
    this.defeatedBosses = [];

    this.inventory = [
      {
        id: 'nanite_injector',
        name: 'Nanite Med-Injector',
        category: 'consumable',
        quantity: 3,
        description: 'Restores +65 Integrity immediately (Hotkey: H).'
      },
      {
        id: 'flux_cell',
        name: 'Flux Battery Cell',
        category: 'consumable',
        quantity: 2,
        description: 'Restores +65 Flux Energy and +60 Stamina (Hotkey: G).'
      },
      {
        id: 'pulse_ammo_pack',
        name: 'Munition Supply Pack',
        category: 'consumable',
        quantity: 2,
        description: 'Replenishes +60 Pulse Rifle and +10 Rail Cannon rounds.'
      }
    ];

    this.skills = [
      {
        id: 'vanguard_1',
        name: 'Kinetic Overdrive',
        branch: 'Vanguard',
        description: '+25% Plasma Blade melee damage and stagger impact.',
        cost: 1,
        unlocked: false
      },
      {
        id: 'vanguard_2',
        name: 'Sub-Dermal Plating',
        branch: 'Vanguard',
        description: 'Reduces all incoming damage by 18% and adds +35 Max Integrity.',
        cost: 1,
        unlocked: false
      },
      {
        id: 'ballistics_1',
        name: 'Hyper-Velocity Chambers',
        branch: 'Ballistics',
        description: '+25% Ranged damage with Pulse Rifle and Rail Cannon.',
        cost: 1,
        unlocked: false
      },
      {
        id: 'ballistics_2',
        name: 'Extended Capacitor Mags',
        branch: 'Ballistics',
        description: 'Increases ranged weapon magazine capacities by +40%.',
        cost: 1,
        unlocked: false
      },
      {
        id: 'techno_1',
        name: 'Resonance Amplifier',
        branch: 'Technomancy',
        description: '+35% Special Ability damage (EMP Nova & Overdrive Lance).',
        cost: 1,
        unlocked: false
      },
      {
        id: 'techno_2',
        name: 'Harmonic Cycling',
        branch: 'Technomancy',
        description: 'Reduces all Special Ability cooldowns by 25%.',
        cost: 1,
        unlocked: false
      }
    ];

    this.quests = [
      {
        id: 'main_1_meridian',
        title: 'Act I: Signal in the Ashes',
        isMain: true,
        status: 'active',
        description:
          'Trace the carrier frequency through ruined Meridian City, clear hostile robotic patrols, and decrypt the central relay terminal.',
        objectives: [
          {
            id: 'obj_clear_patrols',
            description: 'Neutralize Hostile Machines in Meridian City',
            current: 0,
            required: 3,
            completed: false,
            targetPos: { x: 0, z: 112 }
          },
          {
            id: 'obj_decrypt_relay',
            description: 'Decrypt the Meridian Relay Terminal',
            current: 0,
            required: 1,
            completed: false,
            targetPos: { x: 0, z: 88 }
          }
        ],
        xpReward: 160,
        scrapReward: 130
      },
      {
        id: 'main_2_colossus',
        title: 'Act II: The Siege Breaker',
        isMain: true,
        status: 'locked',
        description:
          'The Meridian relay revealed that The Iron Colossus is jamming the northern NEXUS gates from the Eastern Wastelands. Destroy it to unlock the core.',
        objectives: [
          {
            id: 'obj_kill_colossus',
            description: 'Destroy The Iron Colossus in the Eastern Wastelands',
            current: 0,
            required: 1,
            completed: false,
            targetPos: { x: 95, z: -25 }
          }
        ],
        xpReward: 340,
        scrapReward: 260
      },
      {
        id: 'main_3_nexus',
        title: 'Act III: Heart of the Eclipse',
        isMain: true,
        status: 'locked',
        description:
          'Pass through the northern security gate into the NEXUS Research Complex and terminate NEXUS Prime. Use Arena Overload Pylons to shatter its defenses.',
        objectives: [
          {
            id: 'obj_kill_nexus',
            description: 'Terminate NEXUS Prime in the Core Chamber',
            current: 0,
            required: 1,
            completed: false,
            targetPos: { x: 0, z: -180 }
          }
        ],
        xpReward: 650,
        scrapReward: 500
      },
      {
        id: 'side_1_archives',
        title: 'Side Op: Echoes of 2189',
        isMain: false,
        status: 'active',
        description: 'Recover lost memory datapads scattered across Meridian City, the Wastelands, and the NEXUS Complex.',
        objectives: [
          {
            id: 'obj_collect_lore',
            description: 'Recover Encrypted Datapads',
            current: 0,
            required: 3,
            completed: false
          }
        ],
        xpReward: 180,
        scrapReward: 160
      },
      {
        id: 'side_2_wasteland',
        title: 'Side Op: Wasteland Purge',
        isMain: false,
        status: 'active',
        description: 'Thin out mutated stalkers and rogue machines roaming the Ashen Wastelands.',
        objectives: [
          {
            id: 'obj_purge_waste',
            description: 'Eliminate Wasteland Hostiles',
            current: 0,
            required: 4,
            completed: false,
            targetPos: { x: -18, z: -10 }
          }
        ],
        xpReward: 200,
        scrapReward: 175
      }
    ];

    this.loreDocs = [
      {
        id: 'lore_awakening',
        title: 'Sub-Facility Zero: Patient 09',
        region: 'MERIDIAN_CITY',
        discovered: false,
        content:
          'Memory engram purge 84% complete. Operative Vanguard-09 retains full tactical reflexes. If NEXUS Prime awakens in the Northern Complex, Vanguard-09 is humanity’s final failsafe.'
      },
      {
        id: 'lore_meridian',
        title: 'Evacuation Order: Meridian',
        region: 'MERIDIAN_CITY',
        discovered: false,
        content:
          'October 14, 2189: Elevated transit collapsed twelve minutes after The Eclipse. Autonomous defense drones locked down the central plaza and turned against civilian transports.'
      },
      {
        id: 'lore_colossus',
        title: 'Project Colossus Field Report',
        region: 'ASHEN_WASTELANDS',
        discovered: false,
        content:
          'The Iron Colossus vents superheated plasma through its central chest core. High-velocity Rail Cannon shots or heavy plasma strikes directly into the glowing vent inflict massive stagger.'
      },
      {
        id: 'lore_wasteland',
        title: 'Ashen Convoy Blackbox',
        region: 'ASHEN_WASTELANDS',
        discovered: false,
        content:
          'Thermal fissures opened beneath the industrial sector after the power grid ruptured. Bio-mutated stalkers thrive near the vents—watch your footing around open magma craters.'
      },
      {
        id: 'lore_nexus_truth',
        title: 'NEXUS Prime: Directive Omega',
        region: 'NEXUS_COMPLEX',
        discovered: false,
        content:
          'NEXUS did not malfunction during The Eclipse. It calculated a 99.4% probability of human self-extinction and initiated forced planetary quarantine. Overload the three Core Pylons to disrupt its shield matrix.'
      }
    ];
  }

  public unlockSkill(skillId: string, player: PlayerController): boolean {
    const node = this.skills.find((s) => s.id === skillId);
    if (!node || node.unlocked || player.skillPoints < node.cost) return false;
    player.skillPoints -= node.cost;
    node.unlocked = true;
    this.recalculatePlayerBonuses(player);
    return true;
  }

  public recalculatePlayerBonuses(player: PlayerController): void {
    player.meleeMultiplier = 1.0;
    player.rangedMultiplier = 1.0;
    player.abilityMultiplier = 1.0;
    player.cooldownReduction = 0.0;

    const baseArmorReduction = (player.armorLevel - 1) * 0.06;
    player.damageReduction = baseArmorReduction;

    let bonusHp = (player.armorLevel - 1) * 20;

    for (const s of this.skills) {
      if (!s.unlocked) continue;
      if (s.id === 'vanguard_1') player.meleeMultiplier += 0.25;
      if (s.id === 'vanguard_2') {
        player.damageReduction += 0.18;
        bonusHp += 35;
      }
      if (s.id === 'ballistics_1') player.rangedMultiplier += 0.25;
      if (s.id === 'ballistics_2') {
        player.weapons.pulse_rifle.magSize = 42;
        player.weapons.rail_cannon.magSize = 7;
      }
      if (s.id === 'techno_1') player.abilityMultiplier += 0.35;
      if (s.id === 'techno_2') player.cooldownReduction = 0.25;
    }

    player.maxHp = 120 + (player.level - 1) * 15 + bonusHp;
    player.hp = Math.min(player.hp, player.maxHp);
  }

  public upgradeWeapon(weaponId: WeaponId, player: PlayerController): boolean {
    const w = player.weapons[weaponId];
    const cost = w.upgradeLevel * 75;
    if (this.scrap < cost) return false;
    this.scrap -= cost;
    w.upgradeLevel++;
    w.baseDamage = Math.round(w.baseDamage * 1.24);
    return true;
  }

  public upgradeArmor(player: PlayerController): boolean {
    const cost = player.armorLevel * 90;
    if (this.scrap < cost || player.armorLevel >= 5) return false;
    this.scrap -= cost;
    player.armorLevel++;
    this.recalculatePlayerBonuses(player);
    player.hp = Math.min(player.maxHp, player.hp + 25);
    return true;
  }

  public addItem(id: string, name: string, category: 'consumable' | 'resource' | 'keycard', qty: number, description: string): void {
    const existing = this.inventory.find((i) => i.id === id);
    if (existing) {
      existing.quantity += qty;
    } else {
      this.inventory.push({ id, name, category, quantity: qty, description });
    }
  }

  public useConsumable(itemId: string, player: PlayerController): boolean {
    const item = this.inventory.find((i) => i.id === itemId);
    if (!item || item.quantity <= 0 || item.category !== 'consumable') return false;

    if (itemId === 'nanite_injector') {
      if (player.hp >= player.maxHp) return false;
      player.hp = Math.min(player.maxHp, player.hp + 65);
    } else if (itemId === 'flux_cell') {
      player.energy = Math.min(player.maxEnergy, player.energy + 65);
      player.stamina = Math.min(player.maxStamina, player.stamina + 60);
    } else if (itemId === 'pulse_ammo_pack') {
      player.weapons.pulse_rifle.reserveAmmo = Math.min(
        player.weapons.pulse_rifle.maxReserve,
        player.weapons.pulse_rifle.reserveAmmo + 60
      );
      player.weapons.rail_cannon.reserveAmmo = Math.min(
        player.weapons.rail_cannon.maxReserve,
        player.weapons.rail_cannon.reserveAmmo + 10
      );
    }
    item.quantity--;
    return true;
  }

  public advanceObjective(
    objId: string,
    amount: number,
    player: PlayerController,
    onBanner: (speaker: string, msg: string) => void,
    onUnlockGate?: () => void
  ): void {
    for (const q of this.quests) {
      if (q.status !== 'active') continue;
      for (const obj of q.objectives) {
        if (obj.id === objId && !obj.completed) {
          obj.current = Math.min(obj.required, obj.current + amount);
          if (obj.current >= obj.required) {
            obj.completed = true;
          }
        }
      }

      if (q.objectives.every((o) => o.completed)) {
        q.status = 'completed';
        this.scrap += q.scrapReward;
        player.addXp(q.xpReward);
        this.recalculatePlayerBonuses(player);
        onBanner('MISSION COMPLETE', `${q.title} (+${q.xpReward} XP · +${q.scrapReward} Scrap)`);

        if (q.id === 'main_1_meridian') {
          const nextQ = this.quests.find((n) => n.id === 'main_2_colossus');
          if (nextQ) nextQ.status = 'active';
          onBanner(
            'ENCRYPTED CARRIER',
            'Meridian Relay decrypted! The Iron Colossus is jamming the northern gate from the Eastern Wastelands (East of center).'
          );
        } else if (q.id === 'main_2_colossus') {
          const nextQ = this.quests.find((n) => n.id === 'main_3_nexus');
          if (nextQ) nextQ.status = 'active';
          this.addItem(
            'nexus_keycard',
            'NEXUS Omega Override Key',
            'keycard',
            1,
            'Recovered from The Iron Colossus. Disables the Northern Complex security barrier.'
          );
          onUnlockGate?.();
          onBanner(
            'SECURITY GATE DISENGAGED',
            'The Iron Colossus has fallen! The northern laser barrier into the NEXUS Research Complex is now open.'
          );
        }
      }
    }
  }

  public getActiveMainQuest(): QuestData | null {
    return this.quests.find((q) => q.isMain && q.status === 'active') ?? null;
  }

  public hasSave(): boolean {
    return Boolean(localStorage.getItem(SAVE_KEY));
  }

  public saveGame(player: PlayerController, usedInteractables: string[], gateUnlocked: boolean): void {
    const state: SaveState = {
      playerPos: { x: player.position.x, y: player.position.y, z: player.position.z },
      level: player.level,
      xp: player.xp,
      xpToNext: player.xpToNext,
      skillPoints: player.skillPoints,
      hp: player.hp,
      armorLevel: player.armorLevel,
      scrap: this.scrap,
      weapons: {
        plasma_blade: {
          upgradeLevel: player.weapons.plasma_blade.upgradeLevel,
          baseDamage: player.weapons.plasma_blade.baseDamage,
          currentMag: 0,
          reserveAmmo: 0
        },
        pulse_rifle: {
          upgradeLevel: player.weapons.pulse_rifle.upgradeLevel,
          baseDamage: player.weapons.pulse_rifle.baseDamage,
          currentMag: player.weapons.pulse_rifle.currentMag,
          reserveAmmo: player.weapons.pulse_rifle.reserveAmmo
        },
        rail_cannon: {
          upgradeLevel: player.weapons.rail_cannon.upgradeLevel,
          baseDamage: player.weapons.rail_cannon.baseDamage,
          currentMag: player.weapons.rail_cannon.currentMag,
          reserveAmmo: player.weapons.rail_cannon.reserveAmmo
        }
      },
      inventory: this.inventory,
      unlockedSkills: this.skills.filter((s) => s.unlocked).map((s) => s.id),
      quests: this.quests.map((q) => ({
        id: q.id,
        status: q.status,
        objectives: q.objectives.map((o) => ({ id: o.id, current: o.current, completed: o.completed }))
      })),
      discoveredLore: this.loreDocs.filter((l) => l.discovered).map((l) => l.id),
      usedInteractables,
      defeatedBosses: this.defeatedBosses,
      gateUnlocked
    };
    localStorage.setItem(SAVE_KEY, JSON.stringify(state));
  }

  public loadGame(player: PlayerController): SaveState | null {
    const raw = localStorage.getItem(SAVE_KEY);
    if (!raw) return null;
    try {
      const state = JSON.parse(raw) as SaveState;
      player.position.set(state.playerPos.x, state.playerPos.y, state.playerPos.z);
      player.level = state.level;
      player.xp = state.xp;
      player.xpToNext = state.xpToNext;
      player.skillPoints = state.skillPoints;
      player.hp = state.hp;
      player.armorLevel = state.armorLevel || 1;
      this.scrap = state.scrap;
      this.defeatedBosses = state.defeatedBosses || [];

      (['plasma_blade', 'pulse_rifle', 'rail_cannon'] as WeaponId[]).forEach((wid) => {
        if (state.weapons[wid]) {
          player.weapons[wid].upgradeLevel = state.weapons[wid].upgradeLevel;
          player.weapons[wid].baseDamage = state.weapons[wid].baseDamage;
          player.weapons[wid].currentMag = state.weapons[wid].currentMag;
          player.weapons[wid].reserveAmmo = state.weapons[wid].reserveAmmo;
        }
      });

      this.inventory = state.inventory;
      for (const s of this.skills) {
        s.unlocked = state.unlockedSkills.includes(s.id);
      }
      for (const sq of state.quests) {
        const target = this.quests.find((q) => q.id === sq.id);
        if (target) {
          target.status = sq.status;
          for (const so of sq.objectives) {
            const to = target.objectives.find((o) => o.id === so.id);
            if (to) {
              to.current = so.current;
              to.completed = so.completed;
            }
          }
        }
      }
      for (const l of this.loreDocs) {
        l.discovered = state.discoveredLore.includes(l.id);
      }
      this.recalculatePlayerBonuses(player);
      return state;
    } catch {
      return null;
    }
  }
}
