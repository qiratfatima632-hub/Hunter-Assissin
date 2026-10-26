/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { X, Check, Lock, Sparkles } from 'lucide-react';
import { Skin, UserSaveData } from '../game/types.ts';
import { SKINS } from '../game/skins.ts';
import { sound } from '../game/audio.ts';

interface SkinShopModalProps {
  saveData: UserSaveData;
  onSelectSkin: (skinId: string) => void;
  onBuySkin: (skin: Skin) => void;
  onClose: () => void;
}

export const SkinShopModal: React.FC<SkinShopModalProps> = ({
  saveData,
  onSelectSkin,
  onBuySkin,
  onClose,
}) => {
  return (
    <div className="fixed inset-0 z-30 flex items-center justify-center bg-black/85 p-4 select-none font-sans">
      <div className="bg-slate-900 border-2 border-slate-700 rounded-3xl max-w-3xl w-full p-6 text-white shadow-2xl flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="flex justify-between items-center pb-4 border-b border-slate-800">
          <div>
            <h2 className="text-2xl font-black tracking-tight uppercase flex items-center gap-2 text-amber-400">
              <Sparkles className="w-6 h-6" />
              ASSASSIN LOCKER
            </h2>
            <p className="text-xs text-slate-400">Unlock stylized 3D skins with unique abilities and outfits</p>
          </div>

          <div className="flex items-center gap-4">
            <div className="bg-amber-950/80 border border-amber-500/60 rounded-xl px-4 py-1.5 flex items-center gap-2 text-sm font-black text-amber-300">
              <span>🪙 {saveData.coins}</span>
              <span className="text-[10px] text-amber-500 uppercase">COINS</span>
            </div>

            <button
              onClick={onClose}
              aria-label="Close locker"
              className="w-9 h-9 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white flex items-center justify-center border border-slate-700 cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Skins Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 py-4 overflow-y-auto pr-1">
          {SKINS.map((skin) => {
            const isUnlocked = saveData.unlockedSkinIds.includes(skin.id);
            const isSelected = saveData.selectedSkinId === skin.id;
            const canAfford = saveData.coins >= skin.cost;

            return (
              <div
                key={skin.id}
                className={`p-4 rounded-2xl border-2 flex flex-col justify-between transition-all ${
                  isSelected
                    ? 'bg-gradient-to-b from-indigo-950/90 to-slate-900 border-emerald-400 ring-2 ring-emerald-400/40 shadow-xl'
                    : isUnlocked
                    ? 'bg-slate-800/80 border-slate-700 hover:border-slate-500'
                    : 'bg-slate-900/60 border-slate-800 opacity-90'
                }`}
              >
                {/* Character Color Preview Emblem */}
                <div className="flex items-center gap-3">
                  <div
                    className="w-14 h-14 rounded-2xl flex items-center justify-center border-2 shadow-md relative"
                    style={{ backgroundColor: skin.suitColor, borderColor: skin.hoodColor }}
                  >
                    <span className="text-2xl">🥷</span>
                    <div
                      className="absolute -top-1 -right-1 w-4 h-4 rounded-full border border-black"
                      style={{ backgroundColor: skin.scarfColor }}
                    />
                  </div>

                  <div>
                    <div className="text-[10px] font-black tracking-widest text-amber-400 uppercase">
                      {skin.codename}
                    </div>
                    <div className="text-sm font-black text-white">{skin.name}</div>
                    <div className="text-[11px] text-emerald-400 font-semibold mt-0.5">{skin.perk}</div>
                  </div>
                </div>

                <p className="text-[11px] text-slate-400 mt-2 line-clamp-2">{skin.description}</p>

                {/* Action button */}
                <div className="mt-4 pt-3 border-t border-slate-800/80">
                  {isSelected ? (
                    <button
                      disabled
                      className="w-full bg-emerald-600/30 text-emerald-300 font-black text-xs py-2 rounded-xl border border-emerald-500/50 flex items-center justify-center gap-1.5"
                    >
                      <Check className="w-4 h-4" />
                      EQUIPPED
                    </button>
                  ) : isUnlocked ? (
                    <button
                      onClick={() => {
                        sound.playClick();
                        onSelectSkin(skin.id);
                      }}
                      className="w-full bg-slate-700 hover:bg-slate-600 text-white font-black text-xs py-2 rounded-xl border border-slate-500 transition-colors cursor-pointer"
                    >
                      EQUIP SKIN
                    </button>
                  ) : (
                    <button
                      onClick={() => {
                        if (canAfford) {
                          sound.playKeycard();
                          onBuySkin(skin);
                        }
                      }}
                      disabled={!canAfford}
                      className={`w-full font-black text-xs py-2 rounded-xl border flex items-center justify-center gap-1.5 transition-colors cursor-pointer ${
                        canAfford
                          ? 'bg-amber-500 hover:bg-amber-400 text-slate-950 border-amber-300 shadow'
                          : 'bg-slate-800 border-slate-700 text-slate-500 cursor-not-allowed'
                      }`}
                    >
                      <Lock className="w-3.5 h-3.5" />
                      UNLOCK FOR {skin.cost} 🪙
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        {/* Footer */}
        <div className="pt-4 border-t border-slate-800 text-right">
          <button
            onClick={onClose}
            className="bg-slate-800 hover:bg-slate-700 text-white font-bold text-xs uppercase px-6 py-2.5 rounded-xl border border-slate-600 cursor-pointer"
          >
            RETURN TO MENU
          </button>
        </div>
      </div>
    </div>
  );
};
