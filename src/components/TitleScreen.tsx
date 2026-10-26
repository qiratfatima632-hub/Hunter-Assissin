/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { Play, Sparkles, HelpCircle, Lock, Star, Shield, Crosshair } from 'lucide-react';
import { LevelConfig, Skin, UserSaveData } from '../game/types.ts';
import { LEVELS } from '../game/levelData.ts';
import { SKINS } from '../game/skins.ts';

interface TitleScreenProps {
  saveData: UserSaveData;
  selectedLevelId: number;
  onSelectLevel: (id: number) => void;
  onStartGame: () => void;
  onOpenShop: () => void;
}

export const TitleScreen: React.FC<TitleScreenProps> = ({
  saveData,
  selectedLevelId,
  onSelectLevel,
  onStartGame,
  onOpenShop,
}) => {
  const [showHowToPlay, setShowHowToPlay] = useState(false);
  const selectedSkin = SKINS.find((s) => s.id === saveData.selectedSkinId) || SKINS[0];
  const selectedLevel = LEVELS.find((l) => l.id === selectedLevelId) || LEVELS[0];

  return (
    <div className="fixed inset-0 z-20 flex flex-col items-center justify-between p-4 sm:p-8 bg-gradient-to-b from-slate-950 via-slate-900 to-indigo-950 select-none overflow-y-auto font-sans">
      {/* Top Header Bar */}
      <div className="w-full max-w-4xl flex justify-between items-center">
        {/* Assassin Profile & Coins */}
        <div className="flex items-center gap-3 bg-slate-900/90 border border-slate-700/80 rounded-2xl p-2.5 px-4 shadow-xl">
          <div
            className="w-10 h-10 rounded-xl flex items-center justify-center border-2 shadow-inner"
            style={{ backgroundColor: selectedSkin.suitColor, borderColor: selectedSkin.hoodColor }}
          >
            <span className="text-xl">🥷</span>
          </div>
          <div>
            <div className="text-xs font-black text-slate-400 uppercase tracking-wider">{selectedSkin.name}</div>
            <div className="text-sm font-bold text-emerald-400 flex items-center gap-1.5">
              <span>🪙 {saveData.coins}</span>
              <span className="text-[10px] text-slate-500">COINS</span>
            </div>
          </div>
        </div>

        {/* Buttons: Locker & Guide */}
        <div className="flex items-center gap-2">
          <button
            onClick={onOpenShop}
            aria-label="Open Assassin Locker"
            className="bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-slate-950 font-black text-xs uppercase px-4 py-2.5 rounded-xl border border-amber-300 shadow-lg flex items-center gap-2 transition-transform active:scale-95 cursor-pointer"
          >
            <Sparkles className="w-4 h-4" />
            <span>LOCKER / SKINS</span>
          </button>

          <button
            onClick={() => setShowHowToPlay(true)}
            aria-label="How to play guide"
            className="bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white p-2.5 rounded-xl border border-slate-700 shadow transition-transform active:scale-95 cursor-pointer"
          >
            <HelpCircle className="w-5 h-5" />
          </button>
        </div>
      </div>

      {/* Hero Title Section */}
      <div className="my-auto flex flex-col items-center text-center max-w-2xl py-6">
        {/* Animated Badge */}
        <div className="inline-flex items-center gap-2 bg-rose-500/10 border border-rose-500/40 text-rose-400 px-3.5 py-1 rounded-full text-xs font-extrabold uppercase tracking-widest mb-3">
          <Crosshair className="w-3.5 h-3.5 animate-spin" />
          3D CARTOON STEALTH ACTION
        </div>

        {/* Logo Title Lockup */}
        <h1 className="text-4xl sm:text-6xl font-black tracking-tight text-white uppercase drop-shadow-[0_5px_5px_rgba(0,0,0,0.8)]">
          HUNTER <span className="text-transparent bg-clip-text bg-gradient-to-r from-amber-400 via-rose-500 to-emerald-400">ASSASSIN</span>
        </h1>
        <p className="text-slate-400 text-sm sm:text-base font-medium max-w-md mt-2">
          Sneak past guard vision cones, strike from shadows, snatch coins, and reach the escape helicopter!
        </p>

        {/* Level Selector Carousel/Grid */}
        <div className="mt-8 w-full">
          <div className="text-xs uppercase font-extrabold text-slate-400 tracking-wider mb-3">
            SELECT MISSION STAGE
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-2.5 w-full">
            {LEVELS.map((lvl) => {
              const isLocked = lvl.id > saveData.unlockedLevelMax;
              const isSelected = lvl.id === selectedLevelId;
              const stars = saveData.levelStars[lvl.id] || 0;

              return (
                <button
                  key={lvl.id}
                  disabled={isLocked}
                  onClick={() => onSelectLevel(lvl.id)}
                  aria-label={`Select Stage ${lvl.id}: ${lvl.name}`}
                  className={`p-3 rounded-2xl border-2 flex flex-col items-center justify-between min-h-[90px] transition-all cursor-pointer ${
                    isLocked
                      ? 'bg-slate-900/40 border-slate-800 text-slate-600 cursor-not-allowed opacity-60'
                      : isSelected
                      ? 'bg-gradient-to-b from-indigo-900/90 to-slate-900 border-emerald-400 ring-2 ring-emerald-400/50 scale-105 shadow-xl text-white'
                      : 'bg-slate-900/80 border-slate-700/80 hover:border-slate-500 text-slate-300 hover:text-white'
                  }`}
                >
                  <div className="flex justify-between items-center w-full">
                    <span className="text-[10px] font-mono font-extrabold text-slate-400">0{lvl.id}</span>
                    {isLocked ? (
                      <Lock className="w-3.5 h-3.5 text-slate-600" />
                    ) : (
                      <div className="flex gap-0.5">
                        {[1, 2, 3].map((s) => (
                          <Star
                            key={s}
                            className={`w-3 h-3 ${
                              s <= stars ? 'text-amber-400 fill-amber-400' : 'text-slate-700'
                            }`}
                          />
                        ))}
                      </div>
                    )}
                  </div>

                  <div className="text-xs font-black truncate w-full text-center mt-1">
                    {lvl.name}
                  </div>

                  <div className="text-[9px] text-slate-400 font-medium truncate w-full text-center">
                    {lvl.location}
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {/* Primary Start CTA Button */}
        <div className="mt-8 flex flex-col items-center gap-3">
          <button
            type="button"
            data-start="true"
            onClick={(e) => {
              e.preventDefault();
              onStartGame();
            }}
            aria-label="Start Game"
            className="w-full sm:w-80 bg-gradient-to-r from-emerald-500 via-teal-500 to-emerald-600 hover:from-emerald-400 hover:to-teal-400 text-slate-950 font-black text-xl py-4 rounded-2xl border-2 border-emerald-300 shadow-2xl flex items-center justify-center gap-3 transform hover:scale-105 active:scale-95 transition-all cursor-pointer ring-4 ring-emerald-500/40"
          >
            <Play className="w-7 h-7 fill-slate-950" />
            <span>PLAY MISSION {selectedLevel.id}</span>
          </button>
          <span className="text-xs text-slate-400 font-medium">
            Press <strong className="text-slate-200">SPACE</strong> or <strong className="text-slate-200">ENTER</strong> to deploy
          </span>
        </div>
      </div>

      {/* Footer Info */}
      <div className="text-center text-xs text-slate-500 py-2">
        WASD to Move · Shift to Run · Ctrl to Sneak · E for Takedowns · Space for Smoke Screen
      </div>

      {/* How To Play Modal */}
      {showHowToPlay && (
        <div className="fixed inset-0 z-30 flex items-center justify-center bg-black/80 p-4">
          <div className="bg-slate-900 border-2 border-slate-700 rounded-3xl max-w-lg w-full p-6 text-white shadow-2xl relative">
            <h2 className="text-2xl font-black tracking-tight uppercase flex items-center gap-2 text-amber-400">
              <Shield className="w-6 h-6" />
              HOW TO PLAY
            </h2>

            <div className="mt-4 space-y-3 text-sm text-slate-300">
              <div className="bg-slate-800/80 p-3 rounded-xl border border-slate-700 flex items-start gap-3">
                <span className="text-2xl">👀</span>
                <div>
                  <strong className="text-white block">Avoid Vision Cones</strong>
                  Guards project green vision cones on the floor. If they spot you, cones turn red and they'll sound the alarm!
                </div>
              </div>

              <div className="bg-slate-800/80 p-3 rounded-xl border border-slate-700 flex items-start gap-3">
                <span className="text-2xl">📦</span>
                <div>
                  <strong className="text-white block">Sneak & Hide in Cover</strong>
                  Crouch behind crates, containers, and pillars to remain hidden. Heavy brutes cannot see you when hidden!
                </div>
              </div>

              <div className="bg-slate-800/80 p-3 rounded-xl border border-slate-700 flex items-start gap-3">
                <span className="text-2xl">⚡</span>
                <div>
                  <strong className="text-white block">Stealth Takedowns</strong>
                  Approach guards from behind or while hidden, then hit <strong className="text-amber-300">E / Strike</strong> for a comic non-graphic cartoon KO!
                </div>
              </div>

              <div className="bg-slate-800/80 p-3 rounded-xl border border-slate-700 flex items-start gap-3">
                <span className="text-2xl">💨</span>
                <div>
                  <strong className="text-white block">Smoke Bombs</strong>
                  Cornered? Drop a smoke bomb (<strong className="text-indigo-300">Space / Q</strong>) to blind all guards for 5 seconds and slip away!
                </div>
              </div>
            </div>

            <button
              onClick={() => setShowHowToPlay(false)}
              className="mt-6 w-full bg-slate-800 hover:bg-slate-700 text-white font-bold py-3 rounded-xl border border-slate-600 cursor-pointer"
            >
              GOT IT, LET'S INFILTRATE!
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
