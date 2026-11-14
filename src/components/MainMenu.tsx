import { GameSettings } from '../game/types';

interface MainMenuProps {
  hasSaveData: boolean;
  settings: GameSettings;
  showSettings: boolean;
  onNewGame: () => void;
  onContinue: () => void;
  onToggleSettings: (open: boolean) => void;
  onUpdateSettings: (next: GameSettings) => void;
}

export function MainMenu({
  hasSaveData,
  settings,
  showSettings,
  onNewGame,
  onContinue,
  onToggleSettings,
  onUpdateSettings
}: MainMenuProps) {
  return (
    <div className="fixed inset-0 z-30 flex items-center justify-center bg-[#040812]/80 px-6">
      <div className="w-full max-w-2xl rounded-lg border border-cyan-500/30 bg-[#08101e]/95 p-8 shadow-2xl">
        {!showSettings ? (
          <>
            <p className="font-display text-xs tracking-[0.25em] text-cyan-400 uppercase">
              Year 2189 · Post-Collapse Operations
            </p>
            <h1 className="font-display mt-2 text-4xl font-bold tracking-[0.14em] text-white sm:text-5xl">
              PROJECT ECLIPSE
            </h1>
            <p className="mt-4 max-w-xl text-sm leading-relaxed text-slate-300">
              After the global AI NEXUS vanished during the catastrophe, autonomous war machines and
              mutated stalkers claimed the surface. You awaken inside Sub-Facility Zero with fractured
              memory engrams and a carrier signal pulsing from the ruins of Meridian City.
            </p>

            <div className="mt-8 flex flex-col gap-3">
              <button
                onClick={onNewGame}
                className="font-display w-full cursor-pointer rounded border border-cyan-400/70 bg-cyan-500/20 px-6 py-3.5 text-sm font-semibold tracking-widest text-white transition-colors hover:bg-cyan-500/35 whitespace-nowrap"
              >
                New Game
              </button>

              <button
                onClick={onContinue}
                disabled={!hasSaveData}
                className={`font-display w-full rounded border px-6 py-3 text-sm font-semibold tracking-widest transition-colors whitespace-nowrap ${
                  hasSaveData
                    ? 'cursor-pointer border-slate-500/60 bg-slate-800/70 text-slate-100 hover:border-cyan-400/60 hover:bg-slate-800'
                    : 'cursor-not-allowed border-slate-800 bg-slate-900/50 text-slate-500'
                }`}
              >
                {hasSaveData ? 'Continue Saved Game' : 'Continue (No Saved Checkpoint)'}
              </button>

              <button
                onClick={() => onToggleSettings(true)}
                className="font-display w-full cursor-pointer rounded border border-slate-700 bg-slate-900/70 px-6 py-3 text-sm font-semibold tracking-widest text-slate-200 transition-colors hover:border-slate-500 hover:bg-slate-800 whitespace-nowrap"
              >
                Settings
              </button>
            </div>

            <div className="mt-8 border-t border-slate-800 pt-5 text-xs text-slate-400 flex flex-wrap gap-x-4 gap-y-1.5">
              <span>WASD Move</span>
              <span aria-hidden="true">·</span>
              <span>Shift Sprint</span>
              <span aria-hidden="true">·</span>
              <span>Space Jump</span>
              <span aria-hidden="true">·</span>
              <span>Ctrl / V Dodge</span>
              <span aria-hidden="true">·</span>
              <span>LMB Attack / Fire</span>
              <span aria-hidden="true">·</span>
              <span>RMB Aim / Block</span>
              <span aria-hidden="true">·</span>
              <span>F Heavy Cleave</span>
              <span aria-hidden="true">·</span>
              <span>1 / 2 / 3 Weapons</span>
              <span aria-hidden="true">·</span>
              <span>Q / Z / X Abilities</span>
              <span aria-hidden="true">·</span>
              <span>Tab Lock Target</span>
              <span aria-hidden="true">·</span>
              <span>E Interact</span>
              <span aria-hidden="true">·</span>
              <span>I / K / J / M Tactical Menu</span>
            </div>
          </>
        ) : (
          <div>
            <div className="flex items-center justify-between border-b border-slate-800 pb-4">
              <h2 className="font-display text-xl font-bold tracking-wider text-white">Settings</h2>
              <button
                onClick={() => onToggleSettings(false)}
                className="cursor-pointer rounded border border-slate-700 px-4 py-1.5 text-xs font-semibold text-slate-200 hover:bg-slate-800 whitespace-nowrap"
              >
                Back
              </button>
            </div>

            <div className="mt-6 flex flex-col gap-5 text-sm">
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
                  <option value="high">High (Shadows, Bloom & High Pixel Ratio)</option>
                  <option value="medium">Medium (Shadows & Balanced Resolution)</option>
                  <option value="low">Performance (Fast Rendering)</option>
                </select>
              </label>

              <label className="flex flex-col gap-2">
                <div className="flex justify-between text-slate-300">
                  <span>Mouse Sensitivity</span>
                  <span className="font-mono-num text-cyan-400">{(settings.mouseSensitivity * 1000).toFixed(1)}</span>
                </div>
                <input
                  type="range"
                  min={0.001}
                  max={0.005}
                  step={0.0002}
                  value={settings.mouseSensitivity}
                  onChange={(e) =>
                    onUpdateSettings({ ...settings, mouseSensitivity: parseFloat(e.target.value) })
                  }
                  className="accent-cyan-400"
                />
              </label>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
