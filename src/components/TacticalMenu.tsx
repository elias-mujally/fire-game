import { GameSettings, HudSnapshot, TacticalTab, WeaponId } from '../game/types';
import { WorldMapCanvas } from './WorldMapCanvas';

interface TacticalMenuProps {
  snap: HudSnapshot;
  activeTab: TacticalTab;
  settings: GameSettings;
  statusMessage: string | null;
  onSelectTab: (tab: TacticalTab) => void;
  onResume: () => void;
  onUseItem: (id: string) => void;
  onUpgradeWeapon: (id: WeaponId) => void;
  onUpgradeArmor: () => void;
  onUnlockSkill: (id: string) => void;
  onSaveGame: () => void;
  onLoadGame: () => void;
  onQuitToMenu: () => void;
  onUpdateSettings: (next: GameSettings) => void;
}

export function TacticalMenu({
  snap,
  activeTab,
  settings,
  statusMessage,
  onSelectTab,
  onResume,
  onUseItem,
  onUpgradeWeapon,
  onUpgradeArmor,
  onUnlockSkill,
  onSaveGame,
  onLoadGame,
  onQuitToMenu,
  onUpdateSettings
}: TacticalMenuProps) {
  const isPausedOnly = snap.screen === 'PAUSED';

  if (isPausedOnly) {
    return (
      <div className="fixed inset-0 z-30 flex items-center justify-center bg-[#040812]/80 px-4">
        <div className="w-full max-w-md rounded-lg border border-cyan-500/35 bg-[#08101e]/95 p-7 text-center shadow-2xl">
          <h2 className="font-display text-2xl font-bold tracking-widest text-white">Game Paused</h2>
          <p className="mt-2 text-xs text-slate-400">
            {snap.regionName} · Level {snap.level}
          </p>
          <div className="mt-6 flex flex-col gap-3">
            <button
              onClick={onResume}
              className="cursor-pointer rounded border border-cyan-400/70 bg-cyan-500/20 px-5 py-2.5 text-sm font-semibold text-white hover:bg-cyan-500/35 whitespace-nowrap"
            >
              Resume
            </button>
            <button
              onClick={() => onSelectTab('inventory')}
              className="cursor-pointer rounded border border-slate-700 bg-slate-900 px-5 py-2.5 text-sm font-semibold text-slate-200 hover:bg-slate-800 whitespace-nowrap"
            >
              Open Tactical Menu
            </button>
            <button
              onClick={onSaveGame}
              className="cursor-pointer rounded border border-slate-700 bg-slate-900 px-5 py-2.5 text-sm font-semibold text-slate-200 hover:bg-slate-800 whitespace-nowrap"
            >
              Save Game
            </button>
            <button
              onClick={onQuitToMenu}
              className="cursor-pointer rounded border border-red-500/40 bg-red-950/30 px-5 py-2.5 text-sm font-semibold text-red-300 hover:bg-red-950/60 whitespace-nowrap"
            >
              Return to Title
            </button>
          </div>
          {statusMessage && <p className="mt-4 text-xs text-emerald-400">{statusMessage}</p>}
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-30 flex items-center justify-center bg-[#040812]/85 p-4">
      <div className="flex h-[620px] max-h-[92vh] w-full max-w-5xl flex-col rounded-lg border border-cyan-500/35 bg-[#08101e]/96 shadow-2xl">
        {/* Top Tab Navigation */}
        <div className="flex items-center justify-between border-b border-slate-800 bg-[#050a14] px-3">
          <div className="flex overflow-x-auto">
            {(
              [
                ['inventory', 'Inventory & Forge'],
                ['skills', 'Skill Tree'],
                ['quests', 'Quest Journal'],
                ['map', 'World Map'],
                ['settings', 'Settings & Save']
              ] as [TacticalTab, string][]
            ).map(([tabId, label]) => (
              <button
                key={tabId}
                onClick={() => onSelectTab(tabId)}
                className={`cursor-pointer px-4 py-3.5 text-xs font-semibold tracking-wider transition-colors whitespace-nowrap shrink-0 border-b-2 ${
                  activeTab === tabId
                    ? 'border-cyan-400 text-cyan-300 bg-cyan-500/10'
                    : 'border-transparent text-slate-400 hover:text-slate-200'
                }`}
              >
                {label}
              </button>
            ))}
          </div>
          <button
            onClick={onResume}
            className="cursor-pointer rounded border border-slate-700 px-3.5 py-1.5 text-xs font-semibold text-slate-200 hover:bg-slate-800 whitespace-nowrap shrink-0"
          >
            Resume [ESC]
          </button>
        </div>

        {/* Tab Body */}
        <div className="flex-1 overflow-y-auto p-6">
          {activeTab === 'inventory' && (
            <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
              <div className="flex flex-col gap-5">
                <div>
                  <h3 className="font-display border-b border-slate-800 pb-2 text-sm font-bold tracking-wider text-cyan-300">
                    Operative Statistics
                  </h3>
                  <div className="mt-3 grid grid-cols-2 gap-2.5 text-xs">
                    <div className="rounded border border-slate-800 bg-slate-900/60 p-2.5">
                      <div className="text-slate-400">Level & XP</div>
                      <div className="font-mono-num mt-0.5 text-sm font-bold text-white">
                        Lvl {snap.level} ({snap.xp}/{snap.xpToNext})
                      </div>
                    </div>
                    <div className="rounded border border-slate-800 bg-slate-900/60 p-2.5">
                      <div className="text-slate-400">Salvage Scrap</div>
                      <div className="font-mono-num mt-0.5 text-sm font-bold text-amber-400">{snap.scrap}</div>
                    </div>
                    <div className="rounded border border-slate-800 bg-slate-900/60 p-2.5">
                      <div className="text-slate-400">Damage Mitigation</div>
                      <div className="font-mono-num mt-0.5 text-sm font-bold text-emerald-400">
                        {Math.round(snap.damageReduction * 100)}%
                      </div>
                    </div>
                    <div className="rounded border border-slate-800 bg-slate-900/60 p-2.5">
                      <div className="text-slate-400">Combat Multipliers</div>
                      <div className="font-mono-num mt-0.5 text-xs font-semibold text-cyan-300">
                        Melee {Math.round(snap.meleeMultiplier * 100)}% · Gun {Math.round(snap.rangedMultiplier * 100)}%
                      </div>
                    </div>
                  </div>
                </div>

                <div>
                  <h3 className="font-display border-b border-slate-800 pb-2 text-sm font-bold tracking-wider text-cyan-300">
                    Equipment & Weapon Forge
                  </h3>
                  <div className="mt-3 flex flex-col gap-2.5">
                    {(['plasma_blade', 'pulse_rifle', 'rail_cannon'] as WeaponId[]).map((wid) => {
                      const w = snap.weapons[wid];
                      const cost = w.upgradeLevel * 75;
                      return (
                        <div
                          key={wid}
                          className="flex items-center justify-between rounded border border-slate-800 bg-slate-900/60 px-3.5 py-2.5"
                        >
                          <div>
                            <div className="text-xs font-semibold text-white">
                              {w.name} <span className="font-mono-num text-cyan-400">Lv.{w.upgradeLevel}</span>
                            </div>
                            <div className="font-mono-num text-[11px] text-slate-400">
                              Base Damage: {w.baseDamage} · Stagger: {w.staggerPower}
                            </div>
                          </div>
                          <button
                            onClick={() => onUpgradeWeapon(wid)}
                            disabled={snap.scrap < cost}
                            className={`rounded border px-3 py-1.5 text-xs font-semibold whitespace-nowrap ${
                              snap.scrap >= cost
                                ? 'cursor-pointer border-cyan-500/60 bg-cyan-500/15 text-cyan-200 hover:bg-cyan-500/30'
                                : 'cursor-not-allowed border-slate-800 text-slate-500'
                            }`}
                          >
                            Upgrade ({cost} Scrap)
                          </button>
                        </div>
                      );
                    })}

                    <div className="flex items-center justify-between rounded border border-slate-800 bg-slate-900/60 px-3.5 py-2.5">
                      <div>
                        <div className="text-xs font-semibold text-white">
                          Vanguard Exo-Plating <span className="font-mono-num text-emerald-400">Tier {snap.armorLevel}/5</span>
                        </div>
                        <div className="text-[11px] text-slate-400">+20 Max Integrity & +6% Mitigation per tier</div>
                      </div>
                      <button
                        onClick={onUpgradeArmor}
                        disabled={snap.armorLevel >= 5 || snap.scrap < snap.armorLevel * 90}
                        className={`rounded border px-3 py-1.5 text-xs font-semibold whitespace-nowrap ${
                          snap.armorLevel < 5 && snap.scrap >= snap.armorLevel * 90
                            ? 'cursor-pointer border-emerald-500/60 bg-emerald-500/15 text-emerald-200 hover:bg-emerald-500/30'
                            : 'cursor-not-allowed border-slate-800 text-slate-500'
                        }`}
                      >
                        {snap.armorLevel >= 5 ? 'Max Tier' : `Upgrade (${snap.armorLevel * 90} Scrap)`}
                      </button>
                    </div>
                  </div>
                </div>
              </div>

              <div>
                <h3 className="font-display border-b border-slate-800 pb-2 text-sm font-bold tracking-wider text-cyan-300">
                  Inventory & Consumables
                </h3>
                <div className="mt-3 flex flex-col gap-2.5">
                  {snap.inventory.map((item) => (
                    <div
                      key={item.id}
                      className="flex items-center justify-between gap-3 rounded border border-slate-800 bg-slate-900/60 px-3.5 py-3"
                    >
                      <div>
                        <div className="text-xs font-semibold text-white">
                          {item.name} <span className="font-mono-num text-amber-400">x{item.quantity}</span>
                        </div>
                        <div className="mt-0.5 text-[11px] text-slate-400">{item.description}</div>
                      </div>
                      {item.category === 'consumable' && (
                        <button
                          onClick={() => onUseItem(item.id)}
                          disabled={item.quantity <= 0}
                          className={`rounded border px-3.5 py-1.5 text-xs font-semibold whitespace-nowrap ${
                            item.quantity > 0
                              ? 'cursor-pointer border-cyan-500/60 bg-cyan-500/15 text-cyan-200 hover:bg-cyan-500/30'
                              : 'cursor-not-allowed border-slate-800 text-slate-500'
                          }`}
                        >
                          Use
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {activeTab === 'skills' && (
            <div>
              <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                <h3 className="font-display text-sm font-bold tracking-wider text-cyan-300">
                  Neural Augmentation Skill Tree
                </h3>
                <span className="font-mono-num text-sm font-bold text-amber-400">
                  Available Praxis Points: {snap.skillPoints}
                </span>
              </div>
              <div className="mt-5 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {snap.skills.map((skill) => (
                  <div
                    key={skill.id}
                    className={`flex flex-col justify-between rounded border p-4 ${
                      skill.unlocked
                        ? 'border-emerald-500/50 bg-emerald-950/20'
                        : 'border-slate-800 bg-slate-900/60'
                    }`}
                  >
                    <div>
                      <div className="text-[11px] font-semibold tracking-wider text-cyan-400 uppercase">
                        {skill.branch}
                      </div>
                      <div className="font-display mt-1 text-base font-bold text-white">{skill.name}</div>
                      <p className="mt-2 text-xs leading-relaxed text-slate-300">{skill.description}</p>
                    </div>
                    <button
                      onClick={() => onUnlockSkill(skill.id)}
                      disabled={skill.unlocked || snap.skillPoints < skill.cost}
                      className={`mt-4 rounded border px-3 py-2 text-xs font-semibold whitespace-nowrap ${
                        skill.unlocked
                          ? 'border-emerald-500/40 bg-emerald-500/15 text-emerald-300'
                          : snap.skillPoints >= skill.cost
                            ? 'cursor-pointer border-cyan-400/70 bg-cyan-500/20 text-white hover:bg-cyan-500/35'
                            : 'cursor-not-allowed border-slate-800 text-slate-500'
                      }`}
                    >
                      {skill.unlocked ? 'Unlocked' : `Unlock (${skill.cost} SP)`}
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {activeTab === 'quests' && (
            <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
              <div>
                <h3 className="font-display border-b border-slate-800 pb-2 text-sm font-bold tracking-wider text-cyan-300">
                  Mission Log
                </h3>
                <div className="mt-3 flex flex-col gap-3">
                  {snap.quests
                    .filter((q) => q.status !== 'locked')
                    .map((q) => (
                      <div
                        key={q.id}
                        className={`rounded border p-3.5 ${
                          q.status === 'completed'
                            ? 'border-emerald-500/40 bg-emerald-950/15'
                            : 'border-slate-800 bg-slate-900/60'
                        }`}
                      >
                        <div className="flex items-center justify-between gap-2">
                          <span className="font-display text-sm font-bold text-white">{q.title}</span>
                          <span
                            className={`text-[11px] font-semibold uppercase ${
                              q.status === 'completed' ? 'text-emerald-400' : 'text-amber-400'
                            }`}
                          >
                            {q.status}
                          </span>
                        </div>
                        <p className="mt-1.5 text-xs text-slate-300">{q.description}</p>
                        <div className="mt-2.5 flex flex-col gap-1">
                          {q.objectives.map((o) => (
                            <div
                              key={o.id}
                              className={`text-xs ${o.completed ? 'text-emerald-400 line-through' : 'text-cyan-200'}`}
                            >
                              {o.description} ({o.current}/{o.required})
                            </div>
                          ))}
                        </div>
                      </div>
                    ))}
                </div>
              </div>

              <div>
                <h3 className="font-display border-b border-slate-800 pb-2 text-sm font-bold tracking-wider text-cyan-300">
                  Recovered Lore Archives
                </h3>
                <div className="mt-3 flex flex-col gap-3">
                  {snap.loreDocs.map((doc) => (
                    <div key={doc.id} className="rounded border border-slate-800 bg-slate-900/60 p-3.5">
                      <div className="text-xs font-bold text-white">
                        {doc.discovered ? doc.title : 'Encrypted Archive (Undiscovered)'}
                      </div>
                      <p className="mt-1.5 text-xs leading-relaxed text-slate-300">
                        {doc.discovered
                          ? doc.content
                          : 'Explore the sectors and scan holographic datapads to decrypt this record.'}
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {activeTab === 'map' && <WorldMapCanvas snap={snap} />}

          {activeTab === 'settings' && (
            <div className="max-w-md flex flex-col gap-5 text-sm">
              <h3 className="font-display border-b border-slate-800 pb-2 text-sm font-bold tracking-wider text-cyan-300">
                System Settings & Checkpoints
              </h3>
              <label className="flex flex-col gap-2">
                <div className="flex justify-between text-slate-300">
                  <span>Master Volume</span>
                  <span className="font-mono-num text-cyan-400">{Math.round(settings.volume * 100)}%</span>
                </div>
                <input
                  type="range"
                  min={0}
                  max={1}
                  step={0.05}
                  value={settings.volume}
                  onChange={(e) => onUpdateSettings({ ...settings, volume: parseFloat(e.target.value) })}
                  className="accent-cyan-400"
                />
              </label>

              <label className="flex flex-col gap-2">
                <span className="text-slate-300">Graphics Quality</span>
                <select
                  value={settings.quality}
                  onChange={(e) =>
                    onUpdateSettings({ ...settings, quality: e.target.value as GameSettings['quality'] })
                  }
                  className="rounded border border-slate-700 bg-[#050b14] px-3 py-2 text-slate-100"
                >
                  <option value="high">High (Shadows & Bloom)</option>
                  <option value="medium">Medium (Shadows)</option>
                  <option value="low">Low (Performance)</option>
                </select>
              </label>

              <div className="mt-2 flex flex-col gap-2.5">
                <button
                  onClick={onSaveGame}
                  className="cursor-pointer rounded border border-cyan-400/70 bg-cyan-500/20 px-4 py-2.5 text-xs font-semibold text-white hover:bg-cyan-500/35 whitespace-nowrap"
                >
                  Save Game
                </button>
                <button
                  onClick={onLoadGame}
                  disabled={!snap.hasSaveData}
                  className={`rounded border px-4 py-2.5 text-xs font-semibold whitespace-nowrap ${
                    snap.hasSaveData
                      ? 'cursor-pointer border-slate-600 bg-slate-800 text-slate-100 hover:bg-slate-700'
                      : 'cursor-not-allowed border-slate-800 text-slate-500'
                  }`}
                >
                  Load Last Checkpoint
                </button>
                <button
                  onClick={onQuitToMenu}
                  className="cursor-pointer rounded border border-red-500/40 bg-red-950/30 px-4 py-2.5 text-xs font-semibold text-red-300 hover:bg-red-950/60 whitespace-nowrap"
                >
                  Return to Title
                </button>
              </div>

              {statusMessage && <p className="text-xs text-emerald-400">{statusMessage}</p>}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
