/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef } from 'react';
import { GameState, LevelConfig, RunStats, Skin, UserSaveData } from './game/types.ts';
import { GameEngine } from './game/GameEngine.ts';
import { LEVELS } from './game/levelData.ts';
import { SKINS } from './game/skins.ts';
import { loadSaveData, writeSaveData } from './game/storage.ts';
import { sound } from './game/audio.ts';
import { TitleScreen } from './components/TitleScreen.tsx';
import { GameHUD } from './components/GameHUD.tsx';
import { SkinShopModal } from './components/SkinShopModal.tsx';
import { VictoryModal, GameOverModal, PauseModal } from './components/StatusModals.tsx';

export default function App() {
  const [gameState, setGameState] = useState<GameState>('title');
  const [saveData, setSaveData] = useState<UserSaveData>(() => loadSaveData());
  const [selectedLevelId, setSelectedLevelId] = useState<number>(1);
  const [isMuted, setIsMuted] = useState<boolean>(false);
  const [showShop, setShowShop] = useState<boolean>(false);
  const [defeatReason, setDefeatReason] = useState<string>('');
  const [runStats, setRunStats] = useState<RunStats | null>(null);

  // Live HUD metrics
  const [hudStats, setHudStats] = useState({
    coinsCollected: 0,
    totalCoins: 0,
    guardsEliminated: 0,
    totalGuards: 0,
    alarmsTriggered: 0,
    timeSec: 0,
    isHidden: false,
    isSneaking: false,
    canTakedown: false,
    smokeBombs: 2,
    keycardCollected: false,
    objectiveText: 'Eliminate all security guards',
  });

  const canvasMountRef = useRef<HTMLDivElement>(null);
  const engineRef = useRef<GameEngine | null>(null);

  // Keep body dataset state in sync for accessibility & testing
  useEffect(() => {
    document.body.dataset.state = gameState;
  }, [gameState]);

  // Handle ?autostart=1
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      if (params.get('autostart') === '1') {
        startGame();
      }
    }
  }, []);

  // Keyboard shortcuts for title & pause
  useEffect(() => {
    const handleGlobalKey = (e: KeyboardEvent) => {
      if (gameState === 'title' && !showShop && (e.key === ' ' || e.key === 'Enter')) {
        e.preventDefault();
        startGame();
      } else if (gameState === 'playing' && (e.key === 'Escape' || e.key.toLowerCase() === 'p')) {
        pauseGame();
      } else if (gameState === 'playing' && e.key.toLowerCase() === 'm') {
        toggleMute();
      } else if (gameState === 'playing' && e.key.toLowerCase() === 'r') {
        restartCurrentLevel();
      }
    };

    window.addEventListener('keydown', handleGlobalKey);
    return () => window.removeEventListener('keydown', handleGlobalKey);
  }, [gameState, showShop, selectedLevelId, saveData]);

  const currentLevel = LEVELS.find((l) => l.id === selectedLevelId) || LEVELS[0];
  const currentSkin = SKINS.find((s) => s.id === saveData.selectedSkinId) || SKINS[0];

  const startGame = (levelOverrideId?: number) => {
    const levelToPlay = LEVELS.find((l) => l.id === (levelOverrideId || selectedLevelId)) || LEVELS[0];
    setSelectedLevelId(levelToPlay.id);
    setGameState('playing');
    setShowShop(false);

    // Teardown previous engine if any
    if (engineRef.current) {
      engineRef.current.destroy();
      engineRef.current = null;
    }

    // Initialize new 3D engine in canvasMountRef
    if (canvasMountRef.current) {
      const initialSmoke = currentSkin.id === 'toxic_viper' ? 3 : 2;
      engineRef.current = new GameEngine(
        canvasMountRef.current,
        levelToPlay,
        currentSkin,
        initialSmoke,
        {
          onStatsUpdate: (stats) => {
            setHudStats(stats);
          },
          onVictory: (results) => {
            handleVictory(results);
          },
          onDefeat: (reason) => {
            handleDefeat(reason);
          },
        }
      );
    }
  };

  const pauseGame = () => {
    if (engineRef.current && gameState === 'playing') {
      engineRef.current.pause();
      setGameState('paused');
    }
  };

  const resumeGame = () => {
    if (engineRef.current && gameState === 'paused') {
      engineRef.current.resume();
      setGameState('playing');
    }
  };

  const restartCurrentLevel = () => {
    startGame(selectedLevelId);
  };

  const handleVictory = (results: RunStats) => {
    setRunStats(results);
    setGameState('victory');

    // Update persistent save data
    const newCoins = saveData.coins + results.coinsCollected;
    const nextLevelId = Math.min(LEVELS.length, results.levelId + 1);
    const newUnlockedLevelMax = Math.max(saveData.unlockedLevelMax, nextLevelId);
    const prevStars = saveData.levelStars[results.levelId] || 0;
    const newStars = Math.max(prevStars, results.stars);

    const updated: UserSaveData = {
      ...saveData,
      coins: newCoins,
      unlockedLevelMax: newUnlockedLevelMax,
      levelStars: {
        ...saveData.levelStars,
        [results.levelId]: newStars,
      },
      highScores: {
        ...saveData.highScores,
        [results.levelId]: Math.max(saveData.highScores[results.levelId] || 0, results.score),
      },
    };

    setSaveData(updated);
    writeSaveData(updated);
  };

  const handleDefeat = (reason: string) => {
    setDefeatReason(reason);
    setGameState('gameover');
  };

  const goToNextLevel = () => {
    const nextId = selectedLevelId + 1;
    if (nextId <= LEVELS.length) {
      startGame(nextId);
    } else {
      returnToTitle();
    }
  };

  const returnToTitle = () => {
    if (engineRef.current) {
      engineRef.current.destroy();
      engineRef.current = null;
    }
    setGameState('title');
  };

  const toggleMute = () => {
    const next = !isMuted;
    setIsMuted(next);
    sound.setMuted(next);
  };

  const handleSelectSkin = (skinId: string) => {
    const updated: UserSaveData = {
      ...saveData,
      selectedSkinId: skinId,
    };
    setSaveData(updated);
    writeSaveData(updated);
  };

  const handleBuySkin = (skin: Skin) => {
    if (saveData.coins < skin.cost) return;
    const updated: UserSaveData = {
      ...saveData,
      coins: saveData.coins - skin.cost,
      selectedSkinId: skin.id,
      unlockedSkinIds: [...saveData.unlockedSkinIds, skin.id],
    };
    setSaveData(updated);
    writeSaveData(updated);
  };

  return (
    <main className="w-full h-full min-h-screen bg-slate-950 text-white relative overflow-hidden font-sans">
      {/* Three.js Canvas Container (Always mounted so WebGL context stays pristine) */}
      <div
        ref={canvasMountRef}
        data-testid="threejs-canvas-mount"
        className="absolute inset-0 z-0 touch-none"
      />

      {/* Title Screen Overlay */}
      {gameState === 'title' && (
        <TitleScreen
          saveData={saveData}
          selectedLevelId={selectedLevelId}
          onSelectLevel={(id) => setSelectedLevelId(id)}
          onStartGame={() => startGame()}
          onOpenShop={() => setShowShop(true)}
        />
      )}

      {/* In-Game Active HUD */}
      {gameState === 'playing' && (
        <GameHUD
          level={currentLevel}
          stats={hudStats}
          isMuted={isMuted}
          onToggleMute={toggleMute}
          onPause={pauseGame}
          onRestart={restartCurrentLevel}
          onTakedown={() => engineRef.current?.performTakedown()}
          onToggleSneak={() => engineRef.current?.toggleSneak()}
          onSmokeBomb={() => engineRef.current?.triggerSmokeBomb()}
          onJoystickMove={(x, y) => engineRef.current?.setJoystickInput(x, y)}
        />
      )}

      {/* Pause Modal */}
      {gameState === 'paused' && (
        <PauseModal
          levelTitle={`STAGE ${currentLevel.id}: ${currentLevel.name}`}
          onResume={resumeGame}
          onRestart={restartCurrentLevel}
          onTitle={returnToTitle}
        />
      )}

      {/* Victory Modal */}
      {gameState === 'victory' && runStats && (
        <VictoryModal
          stats={runStats}
          hasNextLevel={selectedLevelId < LEVELS.length}
          onNextLevel={goToNextLevel}
          onReplay={restartCurrentLevel}
          onTitle={returnToTitle}
        />
      )}

      {/* Game Over Modal */}
      {gameState === 'gameover' && (
        <GameOverModal
          reason={defeatReason}
          onRetry={restartCurrentLevel}
          onTitle={returnToTitle}
        />
      )}

      {/* Assassin Skin Locker Modal */}
      {showShop && (
        <SkinShopModal
          saveData={saveData}
          onSelectSkin={handleSelectSkin}
          onBuySkin={handleBuySkin}
          onClose={() => setShowShop(false)}
        />
      )}
    </main>
  );
}
