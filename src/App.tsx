import { useCallback, useEffect, useRef, useState } from 'react';
import { GameEngine } from './game/GameEngine';
import { FloatingDamage, GameSettings, HudSnapshot, TacticalTab } from './game/types';
import { MainMenu } from './components/MainMenu';
import { HudOverlay } from './components/HudOverlay';
import { MobileTouchControls } from './components/MobileTouchControls';
import { TacticalMenu } from './components/TacticalMenu';
import { EndScreen } from './components/EndScreen';

function detectMobileOrTouch(): boolean {
  if (typeof window === 'undefined') return false;
  return (
    'ontouchstart' in window ||
    navigator.maxTouchPoints > 0 ||
    window.innerWidth < 1024
  );
}

export default function App() {
  const canvasMountRef = useRef<HTMLDivElement | null>(null);
  const engineRef = useRef<GameEngine | null>(null);

  const [snap, setSnap] = useState<HudSnapshot | null>(null);
  const [floatingDamages, setFloatingDamages] = useState<FloatingDamage[]>([]);
  const [tacticalTab, setTacticalTab] = useState<TacticalTab>('inventory');
  const [showMenuSettings, setShowMenuSettings] = useState(false);
  const [touchControlsVisible, setTouchControlsVisible] = useState<boolean>(() => detectMobileOrTouch());
  const [settings, setSettings] = useState<GameSettings>({
    volume: 0.7,
    quality: 'high',
    mouseSensitivity: 0.0024
  });
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [webglError, setWebglError] = useState<string | null>(null);

  useEffect(() => {
    const onResize = () => {
      if (window.innerWidth < 900) {
        setTouchControlsVisible(true);
      }
    };
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  useEffect(() => {
    const mount = canvasMountRef.current;
    if (!mount) return;

    const engine = new GameEngine(mount, {
      onSnapshot: (nextSnap) => {
        setSnap(nextSnap);
      },
      onFloatingDamage: (dmg) => {
        setFloatingDamages((prev) => [...prev.slice(-14), dmg]);
        window.setTimeout(() => {
          setFloatingDamages((prev) => prev.filter((item) => item.id !== dmg.id));
        }, 850);
      },
      onOpenTacticalTab: (tab) => {
        setTacticalTab(tab);
        setStatusMessage(null);
      },
      onWebglError: (msg) => {
        setWebglError(msg);
      }
    });

    engineRef.current = engine;
    return () => {
      engine.dispose();
      engineRef.current = null;
    };
  }, []);

  const handleUpdateSettings = (next: GameSettings) => {
    setSettings(next);
    engineRef.current?.applySettings(next);
  };

  const handleSave = () => {
    engineRef.current?.saveCheckpoint();
    setStatusMessage('Checkpoint saved to local neural storage.');
    window.setTimeout(() => setStatusMessage(null), 3000);
  };

  const handleMobileMove = useCallback((x: number, y: number, sprint: boolean) => {
    engineRef.current?.setMobileMove(x, y, sprint);
  }, []);

  const handleMobileLook = useCallback((dx: number, dy: number) => {
    engineRef.current?.addTouchLookDelta(dx, dy);
  }, []);

  const handleMobileFireHeld = useCallback((held: boolean) => {
    engineRef.current?.setTouchFireHeld(held);
  }, []);

  return (
    <div className="relative h-screen w-screen overflow-hidden bg-[#04070d]">
      {/* Isolated WebGL Canvas Container */}
      <div ref={canvasMountRef} className="fixed inset-0 z-0 h-full w-full" />

      {/* WebGL Fallback Screen */}
      {webglError && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#040812] p-6 text-center">
          <div className="max-w-md rounded-lg border border-red-500/40 bg-[#0b1220] p-6">
            <h2 className="font-display text-xl font-bold text-red-400">Graphics Initialization Error</h2>
            <p className="mt-2 text-sm text-slate-300">{webglError}</p>
          </div>
        </div>
      )}

      {/* Loading Screen */}
      {!snap && !webglError && (
        <div className="fixed inset-0 z-40 flex flex-col items-center justify-center bg-[#040812]">
          <div className="font-display text-2xl font-bold tracking-[0.25em] text-cyan-400">
            PROJECT ECLIPSE
          </div>
          <p className="mt-3 text-xs tracking-widest text-slate-400 uppercase">
            Constructing Meridian Sector & Neural Systems...
          </p>
        </div>
      )}

      {/* Main Menu */}
      {snap?.screen === 'MENU' && (
        <MainMenu
          hasSaveData={snap.hasSaveData}
          settings={settings}
          showSettings={showMenuSettings}
          onNewGame={() => {
            setShowMenuSettings(false);
            engineRef.current?.startNewGame();
          }}
          onContinue={() => {
            setShowMenuSettings(false);
            engineRef.current?.continueGame();
          }}
          onToggleSettings={(open) => setShowMenuSettings(open)}
          onUpdateSettings={handleUpdateSettings}
        />
      )}

      {/* Active Gameplay HUD + Mobile Touch Controller */}
      {snap?.screen === 'PLAYING' && (
        <>
          <HudOverlay
            snap={snap}
            floatingDamages={floatingDamages}
            mobileMode={touchControlsVisible}
          />
          <MobileTouchControls
            snap={snap}
            visible={touchControlsVisible}
            onToggleVisible={() => setTouchControlsVisible((v) => !v)}
            onMove={handleMobileMove}
            onLookDelta={handleMobileLook}
            onFireHeld={handleMobileFireHeld}
            onSwitchWeapon={(id) => engineRef.current?.switchActiveWeapon(id)}
            onOpenTactical={(tab) => engineRef.current?.openScreen('TACTICAL', tab)}
            onPause={() => engineRef.current?.openScreen('PAUSED')}
            onAction={(action) => engineRef.current?.triggerTouchAction(action)}
          />
        </>
      )}

      {/* Pause & Tactical Menu (Inventory, Skills, Quests, Map, Settings) */}
      {(snap?.screen === 'PAUSED' || snap?.screen === 'TACTICAL') && (
        <TacticalMenu
          snap={snap}
          activeTab={tacticalTab}
          settings={settings}
          statusMessage={statusMessage}
          onSelectTab={(tab) => {
            setTacticalTab(tab);
            setStatusMessage(null);
            if (snap.screen === 'PAUSED') {
              engineRef.current?.openScreen('TACTICAL', tab);
            }
          }}
          onResume={() => engineRef.current?.resumeGame()}
          onUseItem={(id) => engineRef.current?.useInventoryItem(id)}
          onUpgradeWeapon={(id) => engineRef.current?.upgradeWeapon(id)}
          onUpgradeArmor={() => engineRef.current?.upgradeArmor()}
          onUnlockSkill={(id) => engineRef.current?.unlockSkill(id)}
          onSaveGame={handleSave}
          onLoadGame={() => {
            engineRef.current?.continueGame();
          }}
          onQuitToMenu={() => {
            setShowMenuSettings(false);
            engineRef.current?.openScreen('MENU');
          }}
          onUpdateSettings={handleUpdateSettings}
        />
      )}

      {/* Game Over / Victory Screen */}
      {(snap?.screen === 'GAME_OVER' || snap?.screen === 'VICTORY') && (
        <EndScreen
          snap={snap}
          onRespawn={() => engineRef.current?.respawnAtBeacon()}
          onLoadCheckpoint={() => engineRef.current?.continueGame()}
          onNewGame={() => engineRef.current?.startNewGame()}
          onReturnTitle={() => {
            setShowMenuSettings(false);
            engineRef.current?.openScreen('MENU');
          }}
        />
      )}
    </div>
  );
}
