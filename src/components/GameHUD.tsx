/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useRef, useEffect } from 'react';
import { Volume2, VolumeX, Pause, RotateCcw, EyeOff, ShieldAlert, Sparkles, Wind } from 'lucide-react';
import { LevelConfig } from '../game/types.ts';

interface GameHUDProps {
  level: LevelConfig;
  stats: {
    coinsCollected: number;
    totalCoins: number;
    guardsEliminated: number;
    totalGuards: number;
    alarmsTriggered: number;
    timeSec: number;
    isHidden: boolean;
    isSneaking: boolean;
    canTakedown: boolean;
    smokeBombs: number;
    keycardCollected: boolean;
    objectiveText: string;
  };
  isMuted: boolean;
  onToggleMute: () => void;
  onPause: () => void;
  onRestart: () => void;
  onTakedown: () => void;
  onToggleSneak: () => void;
  onSmokeBomb: () => void;
  onJoystickMove: (x: number, y: number) => void;
}

export const GameHUD: React.FC<GameHUDProps> = ({
  level,
  stats,
  isMuted,
  onToggleMute,
  onPause,
  onRestart,
  onTakedown,
  onToggleSneak,
  onSmokeBomb,
  onJoystickMove,
}) => {
  const joystickBaseRef = useRef<HTMLDivElement>(null);
  const joystickKnobRef = useRef<HTMLDivElement>(null);
  const joystickTouchId = useRef<number | null>(null);

  // Touch joystick mechanics for mobile
  useEffect(() => {
    const base = joystickBaseRef.current;
    if (!base) return;

    const handleTouchStart = (e: TouchEvent) => {
      if (joystickTouchId.current !== null) return;
      const touch = e.changedTouches[0];
      joystickTouchId.current = touch.identifier;
      handleTouchMove(e);
    };

    const handleTouchMove = (e: TouchEvent) => {
      if (joystickTouchId.current === null) return;
      for (let i = 0; i < e.changedTouches.length; i++) {
        const touch = e.changedTouches[i];
        if (touch.identifier === joystickTouchId.current) {
          const rect = base.getBoundingClientRect();
          const centerX = rect.left + rect.width / 2;
          const centerY = rect.top + rect.height / 2;
          const maxRadius = rect.width / 2;

          let dx = touch.clientX - centerX;
          let dy = touch.clientY - centerY;
          const dist = Math.hypot(dx, dy);

          if (dist > maxRadius) {
            dx = (dx / dist) * maxRadius;
            dy = (dy / dist) * maxRadius;
          }

          if (joystickKnobRef.current) {
            joystickKnobRef.current.style.transform = `translate(${dx}px, ${dy}px)`;
          }

          onJoystickMove(dx / maxRadius, dy / maxRadius);
          break;
        }
      }
    };

    const handleTouchEnd = (e: TouchEvent) => {
      for (let i = 0; i < e.changedTouches.length; i++) {
        if (e.changedTouches[i].identifier === joystickTouchId.current) {
          joystickTouchId.current = null;
          if (joystickKnobRef.current) {
            joystickKnobRef.current.style.transform = 'translate(0px, 0px)';
          }
          onJoystickMove(0, 0);
          break;
        }
      }
    };

    base.addEventListener('touchstart', handleTouchStart, { passive: false });
    window.addEventListener('touchmove', handleTouchMove, { passive: false });
    window.addEventListener('touchend', handleTouchEnd);
    window.addEventListener('touchcancel', handleTouchEnd);

    return () => {
      base.removeEventListener('touchstart', handleTouchStart);
      window.removeEventListener('touchmove', handleTouchMove);
      window.removeEventListener('touchend', handleTouchEnd);
      window.removeEventListener('touchcancel', handleTouchEnd);
    };
  }, [onJoystickMove]);

  return (
    <div className="fixed inset-0 pointer-events-none select-none z-10 font-sans flex flex-col justify-between p-3 sm:p-5">
      {/* Top Header */}
      <div className="flex justify-between items-start gap-4">
        {/* Left: Mission & Objectives */}
        <div className="flex flex-col gap-2 pointer-events-auto">
          {/* Mission badge */}
          <div className="bg-slate-900/90 border-2 border-emerald-500/70 rounded-xl px-4 py-2 text-white shadow-lg flex items-center gap-3">
            <div className="w-3 h-3 rounded-full bg-emerald-400 animate-ping" />
            <div>
              <div className="text-[10px] uppercase tracking-widest text-emerald-400 font-extrabold">
                STAGE {level.id} · {level.name}
              </div>
              <div className="text-sm font-black tracking-wide text-slate-100 flex items-center gap-2">
                {stats.objectiveText}
              </div>
            </div>
          </div>

          {/* Stats Bar */}
          <div className="flex items-center gap-2 text-xs font-bold text-white">
            {/* Coins */}
            <div className="bg-amber-950/90 border border-amber-500/60 rounded-lg px-3 py-1.5 flex items-center gap-1.5 shadow">
              <span className="text-amber-400 font-black text-sm">🪙</span>
              <span className="text-amber-300 font-mono text-sm">{stats.coinsCollected}</span>
              <span className="text-amber-500/80 text-[10px]">/{stats.totalCoins}</span>
            </div>

            {/* Guards */}
            <div className="bg-slate-900/90 border border-slate-700 rounded-lg px-3 py-1.5 flex items-center gap-1.5 shadow">
              <span className="text-rose-400 font-black text-sm">🎯</span>
              <span className="font-mono text-sm">{stats.guardsEliminated}</span>
              <span className="text-slate-500 text-[10px]">/{stats.totalGuards}</span>
            </div>

            {/* Alarms */}
            <div
              className={`rounded-lg px-3 py-1.5 flex items-center gap-1.5 border shadow transition-colors ${
                stats.alarmsTriggered > 0
                  ? 'bg-rose-950/90 border-rose-500 text-rose-300'
                  : 'bg-slate-900/90 border-slate-700 text-slate-400'
              }`}
            >
              <ShieldAlert className="w-3.5 h-3.5" />
              <span className="text-[11px]">ALARMS: {stats.alarmsTriggered}</span>
            </div>

            {/* Timer */}
            <div className="bg-slate-900/90 border border-slate-700 rounded-lg px-3 py-1.5 font-mono text-slate-300 shadow">
              ⏱️ {Math.floor(stats.timeSec / 60)}:{(stats.timeSec % 60).toString().padStart(2, '0')}
            </div>
          </div>
        </div>

        {/* Right: Quick Action Controls */}
        <div className="flex items-center gap-2 pointer-events-auto">
          <button
            onClick={onToggleMute}
            aria-label="Toggle Sound"
            className="w-10 h-10 rounded-xl bg-slate-900/90 border border-slate-700 text-slate-300 hover:text-white hover:bg-slate-800 flex items-center justify-center transition-transform active:scale-95 shadow cursor-pointer"
          >
            {isMuted ? <VolumeX className="w-5 h-5 text-rose-400" /> : <Volume2 className="w-5 h-5 text-emerald-400" />}
          </button>

          <button
            onClick={onRestart}
            aria-label="Restart Level"
            className="w-10 h-10 rounded-xl bg-slate-900/90 border border-slate-700 text-slate-300 hover:text-white hover:bg-slate-800 flex items-center justify-center transition-transform active:scale-95 shadow cursor-pointer"
          >
            <RotateCcw className="w-5 h-5" />
          </button>

          <button
            onClick={onPause}
            aria-label="Pause Game"
            className="w-10 h-10 rounded-xl bg-slate-900/90 border border-slate-700 text-slate-300 hover:text-white hover:bg-slate-800 flex items-center justify-center transition-transform active:scale-95 shadow cursor-pointer"
          >
            <Pause className="w-5 h-5" />
          </button>
        </div>
      </div>

      {/* Center Feedback Indicators */}
      <div className="flex flex-col items-center justify-center gap-3">
        {/* Hidden in cover badge */}
        {stats.isHidden && (
          <div className="bg-emerald-950/90 border-2 border-emerald-400 text-emerald-200 px-4 py-1.5 rounded-full text-xs font-black tracking-wider uppercase flex items-center gap-2 shadow-2xl animate-bounce">
            <EyeOff className="w-4 h-4 text-emerald-300" />
            HIDDEN IN COVER · GUARDS CANNOT SPOT YOU
          </div>
        )}

        {/* Big Interactive Takedown Trigger Button */}
        {stats.canTakedown && (
          <button
            onClick={onTakedown}
            aria-label="Perform Takedown Strike"
            className="pointer-events-auto bg-gradient-to-r from-amber-500 via-rose-500 to-red-600 hover:from-amber-400 hover:to-red-500 text-white font-black text-lg px-8 py-3 rounded-2xl border-2 border-yellow-300 shadow-2xl flex items-center gap-3 transform hover:scale-105 active:scale-95 transition-all cursor-pointer ring-4 ring-rose-500/50 animate-pulse"
          >
            <Sparkles className="w-6 h-6 text-yellow-200" />
            <span>⚡ TAKEDOWN [E]</span>
          </button>
        )}
      </div>

      {/* Bottom Controls Area */}
      <div className="flex justify-between items-end">
        {/* Left: Virtual Joystick (Touch screen) */}
        <div className="pointer-events-auto sm:hidden flex flex-col items-center">
          <div
            ref={joystickBaseRef}
            className="w-28 h-28 rounded-full bg-slate-900/70 border-2 border-slate-600/80 flex items-center justify-center relative touch-none shadow-inner"
          >
            <div
              ref={joystickKnobRef}
              className="w-12 h-12 rounded-full bg-gradient-to-br from-emerald-400 to-teal-600 border-2 border-white shadow-lg pointer-events-none"
            />
          </div>
          <span className="text-[10px] text-slate-400 mt-1 uppercase font-bold tracking-wider">Drag to Move</span>
        </div>

        {/* Desktop Helper Hints */}
        <div className="hidden sm:flex items-center gap-4 bg-slate-900/80 border border-slate-700/80 rounded-xl px-4 py-2 text-xs text-slate-300 shadow">
          <span><strong className="text-white">WASD</strong> Move</span>
          <span>·</span>
          <span><strong className="text-white">Shift</strong> Run</span>
          <span>·</span>
          <span><strong className="text-white">Ctrl</strong> Sneak</span>
          <span>·</span>
          <span><strong className="text-white">E</strong> Takedown</span>
          <span>·</span>
          <span><strong className="text-white">Space</strong> Smoke</span>
          <span>·</span>
          <span><strong className="text-white">Right Drag</strong> Rotate Camera</span>
        </div>

        {/* Right: Action Buttons (Sneak & Smoke Bomb) */}
        <div className="flex items-center gap-3 pointer-events-auto">
          {/* Sneak toggle button */}
          <button
            onClick={onToggleSneak}
            aria-label="Toggle Sneak Crouch"
            className={`flex flex-col items-center justify-center w-14 h-14 sm:w-16 sm:h-16 rounded-2xl border-2 shadow-lg transition-transform active:scale-95 cursor-pointer ${
              stats.isSneaking
                ? 'bg-emerald-600 border-emerald-300 text-white ring-2 ring-emerald-400/50'
                : 'bg-slate-900/90 border-slate-700 text-slate-300 hover:text-white'
            }`}
          >
            <EyeOff className="w-5 h-5 sm:w-6 sm:h-6" />
            <span className="text-[10px] font-black uppercase mt-0.5">
              {stats.isSneaking ? 'SNEAK ON' : 'SNEAK'}
            </span>
          </button>

          {/* Smoke Bomb Button */}
          <button
            onClick={onSmokeBomb}
            disabled={stats.smokeBombs <= 0}
            aria-label="Deploy Smoke Bomb"
            className={`flex flex-col items-center justify-center w-14 h-14 sm:w-16 sm:h-16 rounded-2xl border-2 shadow-lg transition-transform active:scale-95 cursor-pointer relative ${
              stats.smokeBombs > 0
                ? 'bg-slate-800 border-indigo-500 text-indigo-300 hover:text-white hover:bg-slate-700 ring-2 ring-indigo-500/30'
                : 'bg-slate-900/60 border-slate-800 text-slate-600 cursor-not-allowed'
            }`}
          >
            <Wind className="w-5 h-5 sm:w-6 sm:h-6" />
            <span className="text-[10px] font-black uppercase mt-0.5">SMOKE</span>
            <span className="absolute -top-1.5 -right-1.5 w-5 h-5 rounded-full bg-indigo-500 text-white text-[11px] font-black flex items-center justify-center shadow">
              {stats.smokeBombs}
            </span>
          </button>
        </div>
      </div>
    </div>
  );
};
