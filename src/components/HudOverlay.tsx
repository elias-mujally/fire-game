import { FloatingDamage, HudSnapshot } from '../game/types';

interface HudOverlayProps {
  snap: HudSnapshot;
  floatingDamages: FloatingDamage[];
  mobileMode: boolean;
}

export function HudOverlay({ snap, floatingDamages, mobileMode }: HudOverlayProps) {
  const activeWeapon = snap.weapons[snap.activeWeaponId];
  const hpPct = Math.max(0, Math.min(100, (snap.hp / snap.maxHp) * 100));
  const stamPct = Math.max(0, Math.min(100, (snap.stamina / snap.maxStamina) * 100));
  const nrgPct = Math.max(0, Math.min(100, (snap.energy / snap.maxEnergy) * 100));
  const xpPct = Math.max(0, Math.min(100, (snap.xp / snap.xpToNext) * 100));

  const medCount = snap.inventory.find((i) => i.id === 'nanite_injector')?.quantity ?? 0;
  const fluxCount = snap.inventory.find((i) => i.id === 'flux_cell')?.quantity ?? 0;

  return (
    <div className="pointer-events-none fixed inset-0 z-10 select-none">
      {/* Damage Vignette Flash */}
      {snap.damageFlash > 0 && (
        <div
          className="fixed inset-0 transition-opacity duration-100"
          style={{
            boxShadow: `inset 0 0 110px rgba(239, 68, 68, ${snap.damageFlash * 0.65})`
          }}
        />
      )}

      {/* Top Region & Environmental Banner (Desktop Only to keep Mobile Top Bar clean) */}
      {!mobileMode && (
        <div className="absolute top-3 left-1/2 -translate-x-1/2 rounded border border-cyan-500/25 bg-[#060c18]/85 px-5 py-1.5 text-center">
          <div className="font-display text-xs font-semibold tracking-[0.2em] text-cyan-300 uppercase">
            {snap.regionName}
          </div>
          <div className="font-mono-num text-[11px] text-slate-400">
            {snap.clockText} · {snap.weatherText}
          </div>
        </div>
      )}

      {/* Boss Encounter Bar */}
      {snap.activeBoss && (
        <div
          className={`absolute left-1/2 -translate-x-1/2 rounded border border-red-500/50 bg-[#12070c]/92 ${
            mobileMode
              ? 'top-[136px] w-[88vw] max-w-[330px] px-2.5 py-1.5 sm:top-3 sm:w-[260px]'
              : 'top-20 w-[500px] max-w-[90vw] px-4 py-2.5'
          }`}
        >
          <div className="flex items-baseline justify-between gap-2">
            <span className="font-display truncate text-[11px] font-bold tracking-[0.15em] text-red-400 md:text-sm">
              {snap.activeBoss.name}
            </span>
            <span className="font-mono-num shrink-0 text-[10px] text-red-200 md:text-xs">
              {snap.activeBoss.hp}/{snap.activeBoss.maxHp}
            </span>
          </div>
          {!mobileMode && (
            <div className="mt-0.5 text-[11px] text-amber-300/90">{snap.activeBoss.phaseText}</div>
          )}
          <div className="mt-1 h-2 w-full overflow-hidden rounded-sm border border-red-500/40 bg-slate-900">
            <div
              className="h-full bg-gradient-to-r from-red-600 to-amber-500 transition-all duration-150"
              style={{ width: `${(snap.activeBoss.hp / snap.activeBoss.maxHp) * 100}%` }}
            />
          </div>
          <div className="mt-0.5 h-1 w-full overflow-hidden rounded-sm bg-slate-900">
            <div
              className="h-full bg-amber-300 transition-all duration-150"
              style={{ width: `${(snap.activeBoss.stagger / snap.activeBoss.maxStagger) * 100}%` }}
            />
          </div>
        </div>
      )}

      {/* Center Reticle */}
      <div className="absolute top-1/2 left-1/2 flex -translate-x-1/2 -translate-y-1/2 items-center justify-center">
        <div
          className={`h-7 w-7 rounded-full border transition-transform duration-100 ${
            snap.isAiming
              ? 'scale-75 border-amber-400'
              : snap.isBlocking
                ? 'scale-125 border-cyan-300'
                : 'border-cyan-400/55'
          }`}
        />
        <div className="absolute h-1 w-1 rounded-full bg-cyan-300" />
      </div>

      {/* Target Lock HUD */}
      {snap.targetLock && (
        <div className="absolute top-[55%] left-1/2 w-44 -translate-x-1/2 text-center">
          <div className="font-display text-[11px] font-semibold tracking-wider text-amber-300">
            {snap.targetLock.name}
          </div>
          <div className="mt-1 h-1.5 w-full border border-amber-400/50 bg-slate-950/90">
            <div
              className="h-full bg-amber-400"
              style={{ width: `${(snap.targetLock.hp / snap.targetLock.maxHp) * 100}%` }}
            />
          </div>
        </div>
      )}

      {/* Top Right Active Quest Tracker */}
      {snap.activeMainQuest && (
        <div
          className={`absolute rounded border border-cyan-500/25 bg-[#060c18]/88 ${
            mobileMode
              ? 'top-12 right-2 w-44 p-2 sm:w-56'
              : 'top-4 right-5 w-72 p-3.5'
          }`}
        >
          <div className="text-[9px] font-semibold tracking-[0.18em] text-slate-400 uppercase">
            Objective
          </div>
          <div className="font-display truncate text-[11px] font-bold text-cyan-300 md:text-sm">
            {snap.activeMainQuest.title}
          </div>
          <div className="mt-1 flex flex-col gap-0.5">
            {snap.activeMainQuest.objectives.map((obj) => (
              <div
                key={obj.id}
                className={`text-[10px] leading-tight md:text-xs ${
                  obj.completed ? 'text-emerald-400 line-through opacity-75' : 'text-slate-200'
                }`}
              >
                {obj.description} ({obj.current}/{obj.required})
              </div>
            ))}
          </div>
          {!mobileMode && (
            <div className="mt-2 border-t border-slate-800 pt-2 text-[11px] text-slate-400">
              [I] Inventory · [K] Skills · [J] Quests · [M] Map · [ESC] Pause
            </div>
          )}
        </div>
      )}

      {/* Narrative / Transmission Feed */}
      {snap.transmission && (
        <div
          className={`absolute left-1/2 -translate-x-1/2 rounded border border-cyan-400/40 bg-[#07101f]/92 shadow-xl ${
            mobileMode
              ? 'bottom-44 w-[90vw] max-w-[350px] px-3 py-1.5 sm:bottom-36'
              : 'bottom-36 w-[520px] max-w-[90vw] px-5 py-3'
          }`}
        >
          <div className="font-display text-[10px] font-bold tracking-[0.16em] text-cyan-400 uppercase md:text-xs">
            {snap.transmission.speaker}
          </div>
          <div className="mt-0.5 text-[11px] leading-snug text-slate-100 md:text-sm">
            {snap.transmission.text}
          </div>
        </div>
      )}

      {/* Desktop Interaction Prompt */}
      {snap.interactPrompt && !mobileMode && (
        <div className="absolute bottom-24 left-1/2 flex -translate-x-1/2 items-center gap-2.5 rounded border border-cyan-400/70 bg-[#060d1a]/95 px-4 py-2 text-xs font-semibold tracking-wider text-white">
          <span className="rounded bg-cyan-400 px-2 py-0.5 font-mono-num font-bold text-slate-950">E</span>
          <span>{snap.interactPrompt}</span>
        </div>
      )}

      {/* Player Vitals Panel: Top-Left on Mobile, Bottom-Left on Desktop */}
      <div
        className={`absolute rounded border border-cyan-500/25 bg-[#060c18]/88 ${
          mobileMode
            ? 'top-12 left-2 w-40 p-2 sm:w-48'
            : 'bottom-5 left-5 w-76 p-3.5'
        }`}
      >
        <div className="flex items-center justify-between gap-1.5">
          <span className="font-display text-[10px] font-bold tracking-wider text-amber-400 md:text-xs">
            LVL {snap.level}
          </span>
          <div className="h-1.5 flex-1 bg-slate-800">
            <div className="h-full bg-amber-400" style={{ width: `${xpPct}%` }} />
          </div>
          <span className="font-mono-num text-[9px] text-slate-400 md:text-[11px]">
            {snap.skillPoints > 0 ? `+${snap.skillPoints} SP` : `${snap.scrap} SCR`}
          </span>
        </div>

        <div className="mt-1.5 flex flex-col gap-1">
          <div className="flex items-center gap-1 text-xs">
            <span className="w-8 text-[9px] tracking-wider text-slate-400 uppercase md:w-14 md:text-[10px]">
              HP
            </span>
            <div className="h-1.5 flex-1 border border-slate-700/60 bg-slate-900 md:h-2">
              <div
                className="h-full bg-gradient-to-r from-red-500 to-rose-400 transition-all duration-100"
                style={{ width: `${hpPct}%` }}
              />
            </div>
            <span className="font-mono-num w-11 text-right text-[9px] text-slate-200 md:w-14 md:text-[11px]">
              {snap.hp}/{snap.maxHp}
            </span>
          </div>

          <div className="flex items-center gap-1 text-xs">
            <span className="w-8 text-[9px] tracking-wider text-slate-400 uppercase md:w-14 md:text-[10px]">
              STM
            </span>
            <div className="h-1.5 flex-1 border border-slate-700/60 bg-slate-900">
              <div className="h-full bg-emerald-400 transition-all duration-75" style={{ width: `${stamPct}%` }} />
            </div>
            <span className="font-mono-num w-11 text-right text-[9px] text-slate-200 md:w-14 md:text-[11px]">
              {snap.stamina}/{snap.maxStamina}
            </span>
          </div>

          <div className="flex items-center gap-1 text-xs">
            <span className="w-8 text-[9px] tracking-wider text-slate-400 uppercase md:w-14 md:text-[10px]">
              FLX
            </span>
            <div className="h-1.5 flex-1 border border-slate-700/60 bg-slate-900">
              <div className="h-full bg-cyan-400 transition-all duration-75" style={{ width: `${nrgPct}%` }} />
            </div>
            <span className="font-mono-num w-11 text-right text-[9px] text-slate-200 md:w-14 md:text-[11px]">
              {snap.energy}/{snap.maxEnergy}
            </span>
          </div>
        </div>

        {!mobileMode && (
          <div className="mt-2.5 flex items-center justify-between border-t border-slate-800 pt-2 text-[11px] text-slate-400">
            <span>[H] Med-Injector ({medCount})</span>
            <span>[G] Flux Cell ({fluxCount})</span>
          </div>
        )}
      </div>

      {/* Bottom Right: Desktop Abilities & Active Weapon Readout */}
      {!mobileMode && (
        <div className="absolute right-5 bottom-5 flex flex-col items-end gap-2.5">
          <div className="flex gap-2">
            {[
              { key: 'Q', name: 'EMP Nova', cd: snap.abilityCooldowns.q, max: snap.abilityMaxCooldowns.q },
              { key: 'Z', name: 'Aegis Shield', cd: snap.abilityCooldowns.z, max: snap.abilityMaxCooldowns.z },
              { key: 'X', name: 'Lance Beam', cd: snap.abilityCooldowns.x, max: snap.abilityMaxCooldowns.x }
            ].map((ab) => {
              const pct = ab.cd > 0 ? Math.min(100, (ab.cd / ab.max) * 100) : 0;
              return (
                <div
                  key={ab.key}
                  className="relative flex h-12 w-24 flex-col items-center justify-center overflow-hidden rounded border border-cyan-500/30 bg-[#060c18]/88"
                >
                  <span className="font-mono-num text-xs font-bold text-cyan-400">{ab.key}</span>
                  <span className="text-[10px] text-slate-200">{ab.name}</span>
                  {ab.cd > 0 && (
                    <div
                      className="absolute bottom-0 left-0 w-full bg-red-500/45"
                      style={{ height: `${pct}%` }}
                    />
                  )}
                </div>
              );
            })}
          </div>

          <div className="min-w-[260px] rounded border border-cyan-500/30 bg-[#060c18]/88 px-4 py-2.5 text-right">
            <div className="font-display text-xs font-bold tracking-wider text-cyan-300">
              {activeWeapon.name} · Lv.{activeWeapon.upgradeLevel}
            </div>
            <div className="font-mono-num mt-0.5 text-sm font-semibold text-white">
              {activeWeapon.type === 'melee'
                ? 'Melee · [LMB] Combo · [F] Heavy · [RMB] Block'
                : snap.isReloading
                  ? 'Reloading...'
                  : `${activeWeapon.currentMag} / ${activeWeapon.reserveAmmo}`}
            </div>
            <div className="mt-1 text-[10px] text-slate-400">
              [1] Blade · [2] Pulse Rifle · [3] Rail Cannon
            </div>
          </div>
        </div>
      )}

      {/* Floating Damage Numbers */}
      <div className="pointer-events-none fixed inset-0 overflow-hidden">
        {floatingDamages.map((d) => (
          <div
            key={d.id}
            className="animate-float-dmg font-mono-num absolute text-sm font-bold drop-shadow-[0_2px_4px_rgba(0,0,0,0.9)]"
            style={{ left: d.x, top: d.y, color: d.color }}
          >
            {d.text}
          </div>
        ))}
      </div>
    </div>
  );
}
