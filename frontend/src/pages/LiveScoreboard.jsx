import React, { useEffect, useMemo, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useGame } from "@/context/GameContext";
import { DiceFive, Trophy, Share, QrCode, Clock, X, Crown } from "@phosphor-icons/react";
import { QRCodeSVG } from "qrcode.react";

function WaitingScreen() {
  return (
    <div data-testid="waiting-screen" className="relative min-h-[70vh] flex items-center justify-center overflow-hidden">
      <div className="absolute inset-0 bg-grid opacity-40 pointer-events-none" />
      {/* floating dice background */}
      <div className="absolute inset-0 pointer-events-none">
        {[...Array(8)].map((_, i) => (
          <div
            key={i}
            className="absolute floaty opacity-10"
            style={{
              top: `${(i * 13 + 10) % 80}%`,
              left: `${(i * 19 + 5) % 90}%`,
              animationDelay: `${i * 0.7}s`,
            }}
          >
            <DiceFive size={48 + (i % 3) * 12} weight="duotone" color="#22C55E" />
          </div>
        ))}
      </div>

      <div className="relative w-[400px] h-[400px] flex items-center justify-center">
        {/* central logo */}
        <motion.div
          animate={{ rotate: [0, 5, -5, 0] }}
          transition={{ duration: 6, repeat: Infinity }}
          className="w-28 h-28 rounded-3xl bg-gradient-to-br from-green-400 to-yellow-300 flex items-center justify-center shadow-[0_0_60px_rgba(34,197,94,0.4)]"
        >
          <DiceFive size={56} weight="fill" color="#000" />
        </motion.div>
        {/* orbiting dice */}
        <div className="absolute w-full h-full">
          <div className="absolute top-1/2 left-1/2 orbit-dice">
            <DiceFive size={32} weight="duotone" color="#22C55E" />
          </div>
          <div className="absolute top-1/2 left-1/2 orbit-dice slow">
            <DiceFive size={28} weight="duotone" color="#FACC15" />
          </div>
          <div className="absolute top-1/2 left-1/2 orbit-dice reverse">
            <DiceFive size={24} weight="duotone" color="#fff" />
          </div>
        </div>
      </div>

      <div className="absolute bottom-12 text-center">
        <p data-testid="waiting-title" className="font-display text-3xl font-bold">Waiting for the next game</p>
        <p className="text-zinc-500 mt-2">The scoreboard will appear instantly when the host starts a new match.</p>
      </div>
    </div>
  );
}

function ShareModal({ onClose }) {
  const [copied, setCopied] = useState(false);
  const url = window.location.origin + "/";
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch (e) {}
  };
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70" data-testid="share-modal">
      <motion.div
        initial={{ scale: 0.92, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        className="glass max-w-md w-full p-8 rounded-2xl"
      >
        <div className="flex items-center justify-between mb-6">
          <h3 className="font-display text-xl font-bold flex items-center gap-2"><QrCode size={22} /> Live Share</h3>
          <button data-testid="share-close" onClick={onClose} className="text-zinc-400 hover:text-white"><X size={20} /></button>
        </div>
        <div className="bg-white p-4 rounded-xl flex items-center justify-center">
          <QRCodeSVG value={url} size={220} fgColor="#000" bgColor="#fff" level="M" />
        </div>
        <p className="text-xs text-zinc-500 mt-4 break-all font-mono-num">{url}</p>
        <button data-testid="copy-link-btn" onClick={copy} className="btn-primary w-full mt-4 py-3 rounded-lg font-semibold">
          {copied ? "Copied!" : "Copy link"}
        </button>
      </motion.div>
    </div>
  );
}

const ROW_COLORS = ["#22C55E", "#FACC15", "#60A5FA", "#F472B6", "#FB923C", "#A78BFA", "#34D399", "#F87171"];

function GameTimer({ game }) {
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 500);
    return () => clearInterval(t);
  }, []);
  if (!game?.enable_timer || !game?.turn_started_at) return null;
  const start = new Date(game.turn_started_at).getTime();
  const elapsed = Math.max(0, Math.floor((now - start) / 1000));
  const total = game.turn_duration_sec || 60;
  const remaining = Math.max(0, total - elapsed);
  const pct = Math.min(100, (elapsed / total) * 100);
  const danger = remaining <= 10;
  return (
    <div data-testid="game-timer" className="card-surface p-4">
      <div className="flex items-center justify-between mb-2">
        <span className="label-eyebrow">Turn Timer</span>
        <span className={`font-mono-num font-bold text-2xl ${danger ? "text-red-400" : "text-white"}`}>
          {String(Math.floor(remaining / 60)).padStart(2, "0")}:{String(remaining % 60).padStart(2, "0")}
        </span>
      </div>
      <div className="h-2 bg-zinc-800 rounded-full overflow-hidden">
        <div className={`h-full transition-all duration-500 ${danger ? "bg-red-500" : "bg-green-400"}`} style={{ width: `${100 - pct}%` }} />
      </div>
    </div>
  );
}

export default function LiveScoreboard() {
  const { currentGame, connected } = useGame();
  const [showShare, setShowShare] = useState(false);
  const prevRanks = useRef({});
  const prevScores = useRef({});
  const [flashes, setFlashes] = useState({}); // playerKey -> 'up'|'down'|'score'

  const sortedPlayers = useMemo(() => {
    if (!currentGame) return [];
    const asc = currentGame.ranking_order === "lowest";
    return [...currentGame.players].sort((a, b) => (asc ? a.totalScore - b.totalScore : b.totalScore - a.totalScore));
  }, [currentGame]);

  useEffect(() => {
    if (!currentGame) {
      prevRanks.current = {};
      prevScores.current = {};
      return;
    }
    const newFlashes = {};
    sortedPlayers.forEach((p, idx) => {
      const prevRank = prevRanks.current[p.key];
      const prevScore = prevScores.current[p.key];
      if (prevRank !== undefined && prevRank !== idx) {
        newFlashes[p.key] = idx < prevRank ? "up" : "down";
      }
      if (prevScore !== undefined && prevScore !== p.totalScore) {
        // overlay score flash even if rank didn't change
        newFlashes[p.key] = newFlashes[p.key] || "score";
      }
      prevRanks.current[p.key] = idx;
      prevScores.current[p.key] = p.totalScore;
    });
    if (Object.keys(newFlashes).length) {
      setFlashes(newFlashes);
      setTimeout(() => setFlashes({}), 1600);
    }
  }, [sortedPlayers, currentGame]);

  if (!currentGame) {
    return (
      <div className="max-w-7xl mx-auto px-5 py-10">
        <WaitingScreen />
        {showShare && <ShareModal onClose={() => setShowShare(false)} />}
      </div>
    );
  }

  const winnerLabel = currentGame.ranking_order === "lowest" ? "Lowest wins" : "Highest wins";

  return (
    <div className="max-w-7xl mx-auto px-5 py-8">
      <div className="flex flex-wrap items-end justify-between gap-4 mb-6">
        <div>
          <span className="label-eyebrow flex items-center gap-2">
            <span className="relative inline-flex items-center justify-center w-2 h-2">
              <span className="live-dot" />
              <span className="live-dot-ring" />
            </span>
            {connected ? "LIVE" : "RECONNECTING"} • {winnerLabel}
          </span>
          <h1 data-testid="live-game-name" className="font-display text-4xl sm:text-5xl font-bold tracking-tighter mt-1">{currentGame.game_name}</h1>
        </div>
        <div className="flex items-center gap-2">
          <GameTimer game={currentGame} />
          <button data-testid="share-btn" onClick={() => setShowShare(true)} className="btn-ghost px-4 py-3 rounded-lg flex items-center gap-2">
            <Share size={16} /> Share
          </button>
        </div>
      </div>

      <div className="tracing-border p-1">
        <div className="rounded-[13px] p-4 sm:p-6 bg-[#0a0a0a]">
          <div className="grid grid-cols-12 px-3 pb-2 label-eyebrow text-zinc-500">
            <div className="col-span-1">Rank</div>
            <div className="col-span-7 sm:col-span-8">Player</div>
            <div className="col-span-4 sm:col-span-3 text-right">Score</div>
          </div>
          <div className="flex flex-col gap-2" data-testid="player-rows">
            <AnimatePresence>
              {sortedPlayers.map((p, idx) => {
                const flash = flashes[p.key];
                const color = ROW_COLORS[idx % ROW_COLORS.length];
                const isTurn = currentGame.players[currentGame.current_turn_idx]?.key === p.key;
                return (
                  <motion.div
                    layout
                    key={p.key}
                    initial={{ opacity: 0, x: -40 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: idx * 0.05, type: "spring", stiffness: 200, damping: 20 }}
                    data-testid={`player-rank-${idx + 1}`}
                    className={`grid grid-cols-12 items-center px-3 py-4 rounded-xl border border-white/5 ${flash === "up" ? "flash-up" : flash === "down" ? "flash-down" : ""} ${isTurn ? "bg-green-500/5 border-green-500/30" : "bg-white/[0.02]"}`}
                  >
                    <div className="col-span-1 font-display text-2xl font-bold" style={{ color: idx === 0 ? "#FACC15" : "#fff" }}>
                      {idx === 0 ? <Crown size={28} weight="fill" /> : `#${idx + 1}`}
                    </div>
                    <div className="col-span-7 sm:col-span-8 flex items-center gap-3">
                      <div className="w-2 h-8 rounded-full" style={{ background: color }} />
                      <div>
                        <div className="font-display text-xl font-semibold" style={{ color }}>{p.name}</div>
                        {p.team_key && currentGame.teams?.find((t) => t.key === p.team_key) && (
                          <div className="text-xs text-zinc-500">Team: {currentGame.teams.find((t) => t.key === p.team_key).name}</div>
                        )}
                      </div>
                      {isTurn && (
                        <span data-testid="turn-indicator" className="ml-2 chip text-green-400 border-green-500/50">
                          <Clock size={12} /> Turn
                        </span>
                      )}
                    </div>
                    <div className="col-span-4 sm:col-span-3 text-right">
                      <span
                        data-testid={`player-score-${p.key}`}
                        className={`inline-flex items-center justify-end px-4 py-2 rounded-xl font-mono-num font-bold text-2xl sm:text-3xl ${flash === "score" || flash === "up" || flash === "down" ? "flash-yellow" : ""}`}
                      >
                        {p.totalScore}
                      </span>
                    </div>
                  </motion.div>
                );
              })}
            </AnimatePresence>
          </div>

          {currentGame.use_teams && currentGame.teams?.length > 0 && (
            <div className="mt-6 pt-4 border-t border-white/5">
              <div className="label-eyebrow mb-3 flex items-center gap-2"><Trophy size={14} /> Team Totals</div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3" data-testid="team-totals">
                {[...currentGame.teams].sort((a, b) => (currentGame.ranking_order === "lowest" ? a.totalScore - b.totalScore : b.totalScore - a.totalScore)).map((t, idx) => (
                  <div key={t.key} className="card-surface p-4 flex items-center justify-between">
                    <span className="font-display text-lg font-semibold">{idx === 0 && <Crown size={18} weight="fill" className="inline mr-2 text-yellow-300" />}{t.name}</span>
                    <span className="font-mono-num text-2xl font-bold">{t.totalScore}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {showShare && <ShareModal onClose={() => setShowShare(false)} />}
    </div>
  );
}
