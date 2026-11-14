import React, { useEffect, useRef, useState } from 'react';
import { HudSnapshot, TacticalTab, WeaponId } from '../game/types';

interface MobileTouchControlsProps {
  snap: HudSnapshot;
  visible: boolean;
  onToggleVisible: () => void;
  onMove: (x: number, y: number, sprint: boolean) => void;
  onLookDelta: (dx: number, dy: number) => void;
  onFireHeld: (held: boolean) => void;
  onSwitchWeapon: (id: WeaponId) => void;
  onOpenTactical: (tab: TacticalTab) => void;
  onPause: () => void;
  onAction: (
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
  ) => void;
}

export function MobileTouchControls({
  snap,
  visible,
  onToggleVisible,
  onMove,
  onLookDelta,
  onFireHeld,
  onSwitchWeapon,
  onOpenTactical,
  onPause,
  onAction
}: MobileTouchControlsProps) {
  const joyBaseRef = useRef<HTMLDivElement | null>(null);
  const joyTouchIdRef = useRef<number | null>(null);
  const lookTouchIdRef = useRef<number | null>(null);
  const lastLookPosRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 });
  const joyOriginRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 });
  const [knobOffset, setKnobOffset] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const [isDraggingJoy, setIsDraggingJoy] = useState(false);

  const maxRadius = 42;

  useEffect(() => {
    if (!visible) {
      onMove(0, 0, false);
      setKnobOffset({ x: 0, y: 0 });
      setIsDraggingJoy(false);
    }
  }, [visible, onMove]);

  const updateJoystick = (clientX: number, clientY: number) => {
    const dx = clientX - joyOriginRef.current.x;
    const dy = clientY - joyOriginRef.current.y;
    const dist = Math.hypot(dx, dy);
    const clampedDist = Math.min(maxRadius, dist);
    const angle = Math.atan2(dy, dx);
    const kx = Math.cos(angle) * clampedDist;
    const ky = Math.sin(angle) * clampedDist;

    setKnobOffset({ x: kx, y: ky });

    const normX = kx / maxRadius;
    const normY = ky / maxRadius;
    const sprint = dist > maxRadius * 0.85;
    onMove(normX, normY, sprint);
  };

  const handleJoyTouchStart = (e: React.TouchEvent<HTMLDivElement>) => {
    e.stopPropagation();
    if (joyTouchIdRef.current !== null) return;
    const touch = e.changedTouches[0];
    if (!touch || !joyBaseRef.current) return;

    joyTouchIdRef.current = touch.identifier;
    const rect = joyBaseRef.current.getBoundingClientRect();
    joyOriginRef.current = {
      x: rect.left + rect.width / 2,
      y: rect.top + rect.height / 2
    };
    setIsDraggingJoy(true);
    updateJoystick(touch.clientX, touch.clientY);
  };

  const handleJoyTouchMove = (e: React.TouchEvent<HTMLDivElement>) => {
    e.stopPropagation();
    if (joyTouchIdRef.current === null) return;
    for (let i = 0; i < e.changedTouches.length; i++) {
      const t = e.changedTouches[i];
      if (t.identifier === joyTouchIdRef.current) {
        updateJoystick(t.clientX, t.clientY);
        break;
      }
    }
  };

  const handleJoyTouchEnd = (e: React.TouchEvent<HTMLDivElement>) => {
    e.stopPropagation();
    if (joyTouchIdRef.current === null) return;
    for (let i = 0; i < e.changedTouches.length; i++) {
      const t = e.changedTouches[i];
      if (t.identifier === joyTouchIdRef.current) {
        joyTouchIdRef.current = null;
        setIsDraggingJoy(false);
        setKnobOffset({ x: 0, y: 0 });
        onMove(0, 0, false);
        break;
      }
    }
  };

  const handleJoyMouseDown = (e: React.MouseEvent<HTMLDivElement>) => {
    e.stopPropagation();
    if (!joyBaseRef.current) return;
    const rect = joyBaseRef.current.getBoundingClientRect();
    joyOriginRef.current = {
      x: rect.left + rect.width / 2,
      y: rect.top + rect.height / 2
    };
    setIsDraggingJoy(true);
    updateJoystick(e.clientX, e.clientY);

    const onMouseMove = (ev: MouseEvent) => {
      updateJoystick(ev.clientX, ev.clientY);
    };
    const onMouseUp = () => {
      setIsDraggingJoy(false);
      setKnobOffset({ x: 0, y: 0 });
      onMove(0, 0, false);
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup', onMouseUp);
    };
    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', onMouseUp);
  };

  const handleLookTouchStart = (e: React.TouchEvent<HTMLDivElement>) => {
    if (lookTouchIdRef.current !== null) return;
    const touch = e.changedTouches[0];
    if (!touch) return;
    lookTouchIdRef.current = touch.identifier;
    lastLookPosRef.current = { x: touch.clientX, y: touch.clientY };
  };

  const handleLookTouchMove = (e: React.TouchEvent<HTMLDivElement>) => {
    if (lookTouchIdRef.current === null) return;
    for (let i = 0; i < e.changedTouches.length; i++) {
      const t = e.changedTouches[i];
      if (t.identifier === lookTouchIdRef.current) {
        const dx = t.clientX - lastLookPosRef.current.x;
        const dy = t.clientY - lastLookPosRef.current.y;
        lastLookPosRef.current = { x: t.clientX, y: t.clientY };
        onLookDelta(dx, dy);
        break;
      }
    }
  };

  const handleLookTouchEnd = (e: React.TouchEvent<HTMLDivElement>) => {
    if (lookTouchIdRef.current === null) return;
    for (let i = 0; i < e.changedTouches.length; i++) {
      const t = e.changedTouches[i];
      if (t.identifier === lookTouchIdRef.current) {
        lookTouchIdRef.current = null;
        break;
      }
    }
  };

  const activeWeapon = snap.weapons[snap.activeWeaponId];
  const medCount = snap.inventory.find((i) => i.id === 'nanite_injector')?.quantity ?? 0;

  return (
    <div className="pointer-events-none fixed inset-0 z-20 select-none touch-none">
      {/* Top Bar: Touch Toggle + Quick Tactical Menu Buttons */}
      <div className="pointer-events-auto absolute top-2 left-2 right-2 flex items-center justify-between gap-1">
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={onToggleVisible}
            aria-label="Toggle Touch Controls"
            className={`min-h-[36px] rounded border px-2.5 py-1 font-display text-[10px] font-bold tracking-wider uppercase transition ${
              visible
                ? 'border-cyan-400 bg-[#07162c]/90 text-cyan-300'
                : 'border-slate-700 bg-[#060c18]/85 text-slate-400 hover:text-white'
            }`}
          >
            {visible ? 'TOUCH: ON' : 'TOUCH: OFF'}
          </button>

          {visible && (
            <>
              <button
                type="button"
                onClick={() => onOpenTactical('inventory')}
                className="min-h-[36px] min-w-[42px] rounded border border-cyan-500/35 bg-[#060c18]/90 px-2 py-1 font-display text-[10px] font-bold text-slate-200 active:bg-cyan-500/30"
              >
                BAG
              </button>
              <button
                type="button"
                onClick={() => onOpenTactical('skills')}
                className="min-h-[36px] min-w-[44px] rounded border border-cyan-500/35 bg-[#060c18]/90 px-2 py-1 font-display text-[10px] font-bold text-slate-200 active:bg-cyan-500/30"
              >
                SKILLS
                {snap.skillPoints > 0 && (
                  <span className="ml-1 rounded bg-amber-400 px-1 text-[9px] font-extrabold text-slate-950">
                    {snap.skillPoints}
                  </span>
                )}
              </button>
              <button
                type="button"
                onClick={() => onOpenTactical('map')}
                className="min-h-[36px] min-w-[42px] rounded border border-cyan-500/35 bg-[#060c18]/90 px-2 py-1 font-display text-[10px] font-bold text-slate-200 active:bg-cyan-500/30"
              >
                MAP
              </button>
              <button
                type="button"
                onClick={onPause}
                className="min-h-[36px] min-w-[46px] rounded border border-amber-400/45 bg-[#060c18]/90 px-2 py-1 font-display text-[10px] font-bold text-amber-300 active:bg-amber-500/30"
              >
                PAUSE
              </button>
            </>
          )}
        </div>
      </div>

      {visible && (
        <>
          {/* Right-side Touch Camera Look Drag Surface */}
          <div
            onTouchStart={handleLookTouchStart}
            onTouchMove={handleLookTouchMove}
            onTouchEnd={handleLookTouchEnd}
            onTouchCancel={handleLookTouchEnd}
            className="pointer-events-auto absolute top-12 right-0 bottom-44 left-1/3"
          />

          {/* Left Virtual Analog Thumbstick + Compact Weapon Switcher Above It */}
          <div className="pointer-events-auto absolute bottom-4 left-3 flex flex-col items-start gap-2">
            <div className="grid grid-cols-2 gap-1 sm:flex sm:items-center">
              {(
                [
                  { id: 'plasma_blade', label: '1·BLADE' },
                  { id: 'pulse_rifle', label: '2·RIFLE' },
                  { id: 'rail_cannon', label: '3·RAIL' }
                ] as { id: WeaponId; label: string }[]
              ).map((w) => (
                <button
                  key={w.id}
                  type="button"
                  onClick={() => onSwitchWeapon(w.id)}
                  className={`min-h-[36px] rounded border px-2 py-1 font-display text-[9px] font-bold tracking-wider transition ${
                    snap.activeWeaponId === w.id
                      ? 'border-cyan-300 bg-cyan-500/30 text-white'
                      : 'border-slate-700 bg-[#060c18]/90 text-slate-400'
                  }`}
                >
                  {w.label}
                </button>
              ))}

              <button
                type="button"
                onClick={() => onAction('heal')}
                className="min-h-[36px] rounded border border-emerald-400/50 bg-[#061814]/90 px-2 py-1 font-mono-num text-[9px] font-bold text-emerald-300 active:bg-emerald-500/35"
              >
                +HP({medCount})
              </button>
            </div>

            {activeWeapon.type === 'ranged' && (
              <div className="rounded border border-cyan-500/35 bg-[#060c18]/90 px-2.5 py-0.5 font-mono-num text-[10px] font-bold text-cyan-200">
                {snap.isReloading ? 'RELOADING...' : `AMMO ${activeWeapon.currentMag}/${activeWeapon.reserveAmmo}`}
              </div>
            )}

            {/* Analog Thumbstick */}
            <div
              ref={joyBaseRef}
              onTouchStart={handleJoyTouchStart}
              onTouchMove={handleJoyTouchMove}
              onTouchEnd={handleJoyTouchEnd}
              onTouchCancel={handleJoyTouchEnd}
              onMouseDown={handleJoyMouseDown}
              data-testid="mobile-joystick"
              className="relative flex h-28 w-28 items-center justify-center rounded-full border-2 border-cyan-400/45 bg-[#061020]/75 shadow-[0_0_20px_rgba(0,240,255,0.18)]"
            >
              <div className="pointer-events-none absolute inset-2.5 rounded-full border border-cyan-500/20" />
              <div className="pointer-events-none absolute text-[8px] font-semibold tracking-widest text-cyan-300/45 uppercase">
                MOVE
              </div>
              <div
                className={`pointer-events-none h-11 w-11 rounded-full border-2 transition-transform duration-75 ${
                  isDraggingJoy
                    ? 'border-cyan-300 bg-cyan-400/50 shadow-[0_0_16px_rgba(0,240,255,0.65)]'
                    : 'border-cyan-400/70 bg-cyan-500/25'
                }`}
                style={{
                  transform: `translate(${knobOffset.x}px, ${knobOffset.y}px)`
                }}
              />
            </div>
          </div>

          {/* Contextual Interact Button */}
          {snap.interactPrompt && (
            <button
              type="button"
              onClick={() => onAction('interact')}
              data-testid="mobile-interact-btn"
              className="pointer-events-auto absolute bottom-44 left-1/2 flex min-h-[44px] -translate-x-1/2 items-center gap-2 rounded-full border-2 border-cyan-300 bg-[#071a2e]/95 px-4 py-1.5 font-display text-[11px] font-bold tracking-wider text-cyan-200 shadow-[0_0_20px_rgba(0,240,255,0.45)] active:scale-95"
            >
              <span className="rounded-full bg-cyan-400 px-2 py-0.5 text-[10px] font-extrabold text-slate-950">
                TAP
              </span>
              <span className="max-w-[200px] truncate">{snap.interactPrompt}</span>
            </button>
          )}

          {/* Right Thumb Combat & Ability Cluster */}
          <div className="pointer-events-auto absolute right-3 bottom-4 flex flex-col items-end gap-1.5">
            {/* Top Row: 3 Special Abilities (Q / Z / X) */}
            <div className="flex items-center gap-1">
              {[
                { action: 'emp' as const, label: 'EMP', cd: snap.abilityCooldowns.q },
                { action: 'shield' as const, label: 'SHIELD', cd: snap.abilityCooldowns.z },
                { action: 'lance' as const, label: 'LANCE', cd: snap.abilityCooldowns.x }
              ].map((ab) => (
                <button
                  key={ab.action}
                  type="button"
                  onClick={() => onAction(ab.action)}
                  disabled={ab.cd > 0}
                  className={`min-h-[40px] min-w-[48px] rounded-lg border px-1.5 py-1 font-display text-[9px] font-bold tracking-wider transition ${
                    ab.cd > 0
                      ? 'border-red-500/40 bg-[#1a0a10]/85 text-red-300'
                      : 'border-cyan-400/50 bg-[#071426]/90 text-cyan-300 active:bg-cyan-400/35'
                  }`}
                >
                  <div>{ab.label}</div>
                  {ab.cd > 0 && <div className="font-mono-num text-[8px]">{ab.cd.toFixed(1)}s</div>}
                </button>
              ))}
            </div>

            {/* Utility Row: Lock-On, Reload / Heavy Strike, Aim / Block */}
            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={() => onAction('lock')}
                className={`min-h-[44px] min-w-[46px] rounded-full border font-display text-[9px] font-bold tracking-wider ${
                  snap.targetLock
                    ? 'border-amber-400 bg-amber-500/30 text-amber-200'
                    : 'border-slate-600 bg-[#07101e]/90 text-slate-300'
                }`}
              >
                LOCK
              </button>

              {activeWeapon.type === 'ranged' ? (
                <button
                  type="button"
                  onClick={() => onAction('reload')}
                  className="min-h-[44px] min-w-[48px] rounded-full border border-cyan-400/45 bg-[#07101e]/90 font-display text-[9px] font-bold text-cyan-200 active:bg-cyan-500/30"
                >
                  RELOAD
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => onAction('heavy')}
                  className="min-h-[44px] min-w-[48px] rounded-full border border-amber-400/65 bg-[#1f1206]/90 font-display text-[9px] font-bold text-amber-300 active:bg-amber-500/35"
                >
                  HEAVY
                </button>
              )}

              <button
                type="button"
                onClick={() => onAction('aimToggle')}
                className={`min-h-[44px] min-w-[46px] rounded-full border font-display text-[9px] font-bold ${
                  snap.isAiming || snap.isBlocking
                    ? 'border-cyan-300 bg-cyan-500/35 text-white'
                    : 'border-slate-600 bg-[#07101e]/90 text-slate-200'
                }`}
              >
                {activeWeapon.type === 'ranged' ? 'AIM' : 'BLOCK'}
              </button>
            </div>

            {/* Primary Action Arc: Dodge, Jump, and Large Primary Attack/Fire Button */}
            <div className="flex items-end gap-1.5">
              <button
                type="button"
                onClick={() => onAction('dodge')}
                className="min-h-[46px] min-w-[48px] rounded-full border border-cyan-400/50 bg-[#071324]/90 font-display text-[10px] font-bold text-cyan-200 active:scale-95 active:bg-cyan-500/30"
              >
                DODGE
              </button>

              <button
                type="button"
                onClick={() => onAction('jump')}
                className="min-h-[46px] min-w-[48px] rounded-full border border-cyan-400/50 bg-[#071324]/90 font-display text-[10px] font-bold text-cyan-200 active:scale-95 active:bg-cyan-500/30"
              >
                JUMP
              </button>

              <button
                type="button"
                data-testid="mobile-attack-btn"
                onTouchStart={(e) => {
                  e.stopPropagation();
                  onFireHeld(true);
                }}
                onTouchEnd={(e) => {
                  e.stopPropagation();
                  onFireHeld(false);
                }}
                onTouchCancel={() => onFireHeld(false)}
                onMouseDown={(e) => {
                  e.stopPropagation();
                  onFireHeld(true);
                }}
                onMouseUp={(e) => {
                  e.stopPropagation();
                  onFireHeld(false);
                }}
                className="flex h-16 w-16 items-center justify-center rounded-full border-2 border-cyan-300 bg-gradient-to-br from-cyan-500/45 to-blue-700/55 font-display text-xs font-extrabold tracking-wider text-white shadow-[0_0_22px_rgba(0,240,255,0.45)] active:scale-95"
              >
                {activeWeapon.type === 'melee' ? 'STRIKE' : 'FIRE'}
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
