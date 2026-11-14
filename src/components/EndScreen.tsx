import { HudSnapshot } from '../game/types';

interface EndScreenProps {
  snap: HudSnapshot;
  onRespawn: () => void;
  onLoadCheckpoint: () => void;
  onNewGame: () => void;
  onReturnTitle: () => void;
}

export function EndScreen({
  snap,
  onRespawn,
  onLoadCheckpoint,
  onNewGame,
  onReturnTitle
}: EndScreenProps) {
  const isVictory = snap.screen === 'VICTORY';

  return (
    <div className="fixed inset-0 z-30 flex items-center justify-center bg-[#040812]/88 px-6">
      <div className="w-full max-w-lg rounded-lg border border-cyan-500/35 bg-[#08101e]/95 p-8 text-center shadow-2xl">
        <p
          className={`font-display text-xs font-bold tracking-[0.25em] uppercase ${
            isVictory ? 'text-emerald-400' : 'text-red-400'
          }`}
        >
          {isVictory ? 'Protocol Eclipse Terminated' : 'Vital Signs Terminated'}
        </p>
        <h2 className="font-display mt-2 text-4xl font-bold tracking-widest text-white">
          {isVictory ? 'NEXUS PRIME DEFEATED' : 'SIGNAL LOST'}
        </h2>
        <p className="mt-4 text-sm leading-relaxed text-slate-300">
          {isVictory
            ? 'With NEXUS Prime dismantled inside the Northern Core Complex, planetary orbital relays unlock for the surviving human settlements. Vanguard-09 stands victorious over the ruins of 2189.'
            : 'Operative Vanguard-09 sustained critical damage. Reconstruct at the nearest Meridian Neural Beacon or restore your last saved checkpoint.'}
        </p>

        <div className="mt-7 flex flex-col gap-3">
          {isVictory ? (
            <>
              <button
                onClick={onNewGame}
                className="cursor-pointer rounded border border-cyan-400/70 bg-cyan-500/20 px-5 py-3 text-sm font-semibold text-white hover:bg-cyan-500/35 whitespace-nowrap"
              >
                Start New Campaign
              </button>
              <button
                onClick={onReturnTitle}
                className="cursor-pointer rounded border border-slate-700 bg-slate-900 px-5 py-3 text-sm font-semibold text-slate-200 hover:bg-slate-800 whitespace-nowrap"
              >
                Return to Title
              </button>
            </>
          ) : (
            <>
              <button
                onClick={onRespawn}
                className="cursor-pointer rounded border border-cyan-400/70 bg-cyan-500/20 px-5 py-3 text-sm font-semibold text-white hover:bg-cyan-500/35 whitespace-nowrap"
              >
                Reconstruct at Beacon
              </button>
              {snap.hasSaveData && (
                <button
                  onClick={onLoadCheckpoint}
                  className="cursor-pointer rounded border border-slate-600 bg-slate-800 px-5 py-3 text-sm font-semibold text-slate-100 hover:bg-slate-700 whitespace-nowrap"
                >
                  Load Saved Checkpoint
                </button>
              )}
              <button
                onClick={onReturnTitle}
                className="cursor-pointer rounded border border-slate-700 bg-slate-900 px-5 py-3 text-sm font-semibold text-slate-300 hover:bg-slate-800 whitespace-nowrap"
              >
                Return to Title
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
