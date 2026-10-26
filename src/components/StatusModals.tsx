/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { Star, Trophy, RotateCcw, Play, Home, Skull, ArrowRight } from 'lucide-react';
import { RunStats } from '../game/types.ts';

interface VictoryModalProps {
  stats: RunStats;
  hasNextLevel: boolean;
  onNextLevel: () => void;
  onReplay: () => void;
  onTitle: () => void;
}

export const VictoryModal: React.FC<VictoryModalProps> = ({
  stats,
  hasNextLevel,
  onNextLevel,
  onReplay,
  onTitle,
}) => {
  return (
    <div className="fixed inset-0 z-30 flex items-center justify-center bg-black/85 p-4 select-none font-sans">
      <div className="bg-slate-900 border-2 border-emerald-400/80 rounded-3xl max-w-md w-full p-6 text-white shadow-2xl flex flex-col items-center text-center animate-in zoom-in-95 duration-200">
        {/* Trophy icon */}
        <div className="w-16 h-16 rounded-3xl bg-emerald-500/20 border-2 border-emerald-400 flex items-center justify-center text-emerald-400 mb-3 shadow-lg">
          <Trophy className="w-8 h-8" />
        </div>

        <div className="text-xs uppercase font-extrabold text-emerald-400 tracking-widest">
          MISSION ACCOMPLISHED
        </div>
        <h2 className="text-3xl font-black text-white uppercase mt-0.5">
          STAGE {stats.levelId} CLEARED!
        </h2>

        {/* 3-Star Rating Banner */}
        <div className="flex gap-2 my-4 bg-slate-950/80 px-6 py-3 rounded-2xl border border-slate-800 shadow-inner">
          {[1, 2, 3].map((starIdx) => (
            <Star
              key={starIdx}
              className={`w-9 h-9 transition-all transform ${
                starIdx <= stats.stars
                  ? 'text-amber-400 fill-amber-400 scale-110 drop-shadow-[0_0_10px_rgba(250,204,21,0.6)]'
                  : 'text-slate-700'
              }`}
            />
          ))}
        </div>

        {/* Score Breakdown Tiles */}
        <div className="grid grid-cols-2 gap-2.5 w-full my-2 text-left">
          <div className="bg-slate-800/80 border border-slate-700 p-3 rounded-xl">
            <span className="text-[10px] text-slate-400 uppercase font-bold block">Coins Gathered</span>
            <span className="text-lg font-black text-amber-400 font-mono">
              🪙 {stats.coinsCollected} / {stats.totalCoins}
            </span>
          </div>

          <div className="bg-slate-800/80 border border-slate-700 p-3 rounded-xl">
            <span className="text-[10px] text-slate-400 uppercase font-bold block">Infiltration Time</span>
            <span className="text-lg font-black text-slate-200 font-mono">
              ⏱️ {stats.timeSec}s
            </span>
          </div>

          <div className="bg-slate-800/80 border border-slate-700 p-3 rounded-xl">
            <span className="text-[10px] text-slate-400 uppercase font-bold block">Guards Takedown</span>
            <span className="text-lg font-black text-emerald-400 font-mono">
              🎯 {stats.guardsEliminated} / {stats.totalGuards}
            </span>
          </div>

          <div className="bg-slate-800/80 border border-slate-700 p-3 rounded-xl">
            <span className="text-[10px] text-slate-400 uppercase font-bold block">Stealth Rating</span>
            <span className={`text-lg font-black font-mono ${stats.alarmsTriggered === 0 ? 'text-emerald-400' : 'text-amber-400'}`}>
              {stats.alarmsTriggered === 0 ? 'GHOST (+500)' : `${stats.alarmsTriggered} ALARMS`}
            </span>
          </div>
        </div>

        {/* Total Score */}
        <div className="w-full bg-slate-950 p-3 rounded-xl border border-slate-800 flex justify-between items-center my-2">
          <span className="text-xs uppercase font-extrabold text-slate-400">Total Score</span>
          <span className="text-xl font-black text-yellow-400 font-mono">{stats.score.toLocaleString()} PTS</span>
        </div>

        {/* Action CTAs */}
        <div className="flex flex-col gap-2 w-full mt-4">
          {hasNextLevel ? (
            <button
              data-start="true"
              onClick={onNextLevel}
              aria-label="Next Mission"
              className="w-full bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 text-slate-950 font-black text-base py-3.5 rounded-2xl border-2 border-emerald-300 shadow-xl flex items-center justify-center gap-2 transition-transform active:scale-95 cursor-pointer"
            >
              <span>NEXT MISSION</span>
              <ArrowRight className="w-5 h-5" />
            </button>
          ) : (
            <button
              data-start="true"
              onClick={onTitle}
              className="w-full bg-gradient-to-r from-amber-500 to-yellow-500 text-slate-950 font-black text-base py-3.5 rounded-2xl border-2 border-amber-300 shadow-xl flex items-center justify-center gap-2 transition-transform active:scale-95 cursor-pointer"
            >
              <span>CAMPAIGN COMPLETED! RETURN MENU</span>
            </button>
          )}

          <div className="grid grid-cols-2 gap-2 w-full">
            <button
              onClick={onReplay}
              aria-label="Replay Mission"
              className="bg-slate-800 hover:bg-slate-700 text-white font-bold text-xs py-2.5 rounded-xl border border-slate-700 flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
            >
              <RotateCcw className="w-4 h-4" />
              <span>RETRY</span>
            </button>

            <button
              onClick={onTitle}
              aria-label="Return to Title Menu"
              className="bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white font-bold text-xs py-2.5 rounded-xl border border-slate-700 flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
            >
              <Home className="w-4 h-4" />
              <span>TITLE</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

interface GameOverModalProps {
  reason: string;
  onRetry: () => void;
  onTitle: () => void;
}

export const GameOverModal: React.FC<GameOverModalProps> = ({
  reason,
  onRetry,
  onTitle,
}) => {
  return (
    <div className="fixed inset-0 z-30 flex items-center justify-center bg-black/85 p-4 select-none font-sans">
      <div className="bg-slate-900 border-2 border-rose-500/80 rounded-3xl max-w-sm w-full p-6 text-white shadow-2xl flex flex-col items-center text-center animate-in zoom-in-95 duration-200">
        <div className="w-16 h-16 rounded-3xl bg-rose-500/20 border-2 border-rose-500 flex items-center justify-center text-rose-400 mb-3 shadow-lg">
          <Skull className="w-8 h-8" />
        </div>

        <div className="text-xs uppercase font-extrabold text-rose-400 tracking-widest">
          MISSION FAILED
        </div>
        <h2 className="text-3xl font-black text-white uppercase mt-0.5">
          SPOTTED!
        </h2>
        <p className="text-sm text-slate-300 font-medium my-2">
          {reason || 'The security guards detected your presence.'}
        </p>

        <div className="bg-slate-950/80 border border-slate-800 rounded-xl p-3 text-xs text-slate-400 my-2 w-full">
          💡 <strong className="text-slate-200">Tip:</strong> Use <strong className="text-emerald-400">Sneak (Ctrl)</strong> to move silently behind obstacles, or drop a <strong className="text-indigo-400">Smoke Bomb (Space)</strong> if surrounded!
        </div>

        <div className="flex flex-col gap-2 w-full mt-4">
          <button
            data-start="true"
            onClick={onRetry}
            aria-label="Try Again"
            className="w-full bg-gradient-to-r from-rose-500 to-red-600 hover:from-rose-400 hover:to-red-500 text-white font-black text-base py-3.5 rounded-2xl border-2 border-rose-300 shadow-xl flex items-center justify-center gap-2 transition-transform active:scale-95 cursor-pointer"
          >
            <RotateCcw className="w-5 h-5" />
            <span>TRY AGAIN</span>
          </button>

          <button
            onClick={onTitle}
            aria-label="Return to Title Menu"
            className="w-full bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white font-bold text-xs py-2.5 rounded-xl border border-slate-700 flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
          >
            <Home className="w-4 h-4" />
            <span>RETURN TO MENU</span>
          </button>
        </div>
      </div>
    </div>
  );
};

interface PauseModalProps {
  levelTitle: string;
  onResume: () => void;
  onRestart: () => void;
  onTitle: () => void;
}

export const PauseModal: React.FC<PauseModalProps> = ({
  levelTitle,
  onResume,
  onRestart,
  onTitle,
}) => {
  return (
    <div className="fixed inset-0 z-30 flex items-center justify-center bg-black/80 p-4 select-none font-sans">
      <div className="bg-slate-900 border-2 border-slate-700 rounded-3xl max-w-sm w-full p-6 text-white shadow-2xl flex flex-col items-center text-center">
        <h2 className="text-2xl font-black uppercase text-amber-400">
          MISSION PAUSED
        </h2>
        <p className="text-xs text-slate-400 mt-1 mb-4">{levelTitle}</p>

        <div className="flex flex-col gap-2.5 w-full">
          <button
            onClick={onResume}
            aria-label="Resume Game"
            className="w-full bg-emerald-600 hover:bg-emerald-500 text-white font-black text-sm py-3 rounded-xl border border-emerald-400 shadow flex items-center justify-center gap-2 cursor-pointer"
          >
            <Play className="w-4 h-4 fill-white" />
            <span>RESUME MISSION</span>
          </button>

          <button
            onClick={onRestart}
            aria-label="Restart Mission"
            className="w-full bg-slate-800 hover:bg-slate-700 text-white font-bold text-xs py-2.5 rounded-xl border border-slate-700 flex items-center justify-center gap-2 cursor-pointer"
          >
            <RotateCcw className="w-4 h-4" />
            <span>RESTART LEVEL</span>
          </button>

          <button
            onClick={onTitle}
            aria-label="Return to Title"
            className="w-full bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white font-bold text-xs py-2.5 rounded-xl border border-slate-700 flex items-center justify-center gap-2 cursor-pointer"
          >
            <Home className="w-4 h-4" />
            <span>EXIT TO TITLE</span>
          </button>
        </div>
      </div>
    </div>
  );
};
