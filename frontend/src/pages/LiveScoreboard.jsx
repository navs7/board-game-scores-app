import React, { useEffect, useMemo, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useGame } from "@/context/GameContext";
import { DiceFive, Trophy, Share, QrCode, X, Crown } from "@phosphor-icons/react";
import { QRCodeSVG } from "qrcode.react";

const FLOATING_DICE = [
  { id: "fd-0", top: 10, left: 5, size: 48, delay: 0 },
  { id: "fd-1", top: 23, left: 24, size: 60, delay: 0.7 },
  { id: "fd-2", top: 36, left: 43, size: 72, delay: 1.4 },
  { id: "fd-3", top: 49, left: 62, size: 48, delay: 2.1 },
  { id: "fd-4", top: 62, left: 81, size: 60, delay: 2.8 },
  { id: "fd-5", top: 75, left: 10, size: 72, delay: 3.5 },
  { id: "fd-6", top: 8, left: 33, size: 48, delay: 4.2 },
  { id: "fd-7", top: 21, left: 56, size: 60, delay: 4.9 },
];

function WaitingScreen() {
  return (
    <div data-testid="waiting-screen" className="relative min-h-[70vh] flex items-center justify-center overflow-hidden">
      <div className="absolute inset-0 bg-grid opacity-40 pointer-events-none" />
      <div className="absolute inset-0 pointer-events-none">
        {FLOATING_DICE.map((d) => (
          <div key={d.id} className="absolute floaty opacity-10" style={{ top: `${d.top}%`, left: `${d.left}%`, animationDelay: `${d.delay}s` }}>
            <DiceFive size={d.size} weight="duotone" color="#22C55E" />
          </div>
        ))}
      </div>

      <div className="relative w-[280px] h-[280px] sm:w-[400px] sm:h-[400px] flex items-center justify-center">
        <motion.div
          animate={{ rotate: [0, 5, -5, 0] }}
          transition={{ duration: 6, repeat: Infinity }}
          className="w-24 h-24 sm:w-28 sm:h-28 rounded-3xl bg-gradient-to-br from-green-400 to-yellow-300 flex items-center justify-center shadow-[0_0_60px_rgba(34,197,94,0.4)]"
        >
          <DiceFive size={56} weight="fill" color="#000" />
        </motion.div>
        <div className="absolute w-full h-full">
          <div className="absolute top-1/2 left-1/2 orbit-dice"><DiceFive size={28} weight="duotone" color="#22C55E" /></div>
          <div className="absolute top-1/2 left-1/2 orbit-dice slow"><DiceFive size={24} weight="duotone" color="#FACC15" /></div>
          <div className="absolute top-1/2 left-1/2 orbit-dice reverse"><DiceFive size={20} weight="duotone" color="#fff" /></div>
        </div>
      </div>

      <div className="absolute bottom-8 sm:bottom-12 text-center px-4">
        <p data-testid="waiting-title" className="font-display text-2xl sm:text-3xl font-bold">Waiting for the next game</p>
        <p className="text-zinc-500 mt-2 text-sm sm:text-base">The scoreboard will appear when the host starts a match.</p>
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
    } catch (e) {
      console.warn("[share] clipboard write failed:", e?.message);
    }
  };
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70" data-testid="share-modal">
      <motion.div initial={{ scale: 0.92, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="glass max-w-md w-full p-6 sm:p-8 rounded-2xl">
        <div className="flex items-center justify-between mb-6">
          <h3 className="font-display text-lg sm:text-xl font-bold flex items-center gap-2"><QrCode size={22} /> Live Share</h3>
          <button data-testid="share-close" onClick={onClose} className="text-zinc-400 hover:text-white"><X size={20} /></button>
        </div>
        <div className="bg-white p-4 rounded-xl flex items-center justify-center">
          <QRCodeSVG value={url} size={200} fgColor="#000" bgColor="#fff" level="M" />
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

export default function LiveScoreboard() {
  const { currentGame, connected } = useGame();
  const [showShare, setShowShare] = useState(false);
  const prevRanks = useRef({});
  const prevScores = useRef({});
  const [flashes, setFlashes] = useState({});

  const sortedPlayers = useMemo(() => {
    if (!currentGame) return [];
    const asc = currentGame.ranking_order === "lowest";
    return [...currentGame.players].sort((a, b) => (asc ? a.totalScore - b.totalScore : b.totalScore - a.totalScore));
  }, [currentGame]);

  const sortedTeams = useMemo(() => {
    if (!currentGame?.use_teams || !currentGame.teams) return [];
    const asc = currentGame.ranking_order === "lowest";
    return [...currentGame.teams].sort((a, b) => (asc ? a.totalScore - b.totalScore : b.totalScore - a.totalScore));
  }, [currentGame]);

  useEffect(() => {
    if (!currentGame) {
      prevRanks.current = {};
      prevScores.current = {};
      return undefined;
    }
    const newFlashes = {};
    sortedPlayers.forEach((p, idx) => {
      const prevRank = prevRanks.current[p.key];
      const prevScore = prevScores.current[p.key];
      if (prevRank !== undefined && prevRank !== idx) {
        newFlashes[p.key] = idx < prevRank ? "up" : "down";
      }
      if (prevScore !== undefined && prevScore !== p.totalScore) {
        newFlashes[p.key] = newFlashes[p.key] || "score";
      }
      prevRanks.current[p.key] = idx;
      prevScores.current[p.key] = p.totalScore;
    });
    if (Object.keys(newFlashes).length) {
      setFlashes(newFlashes);
      const t = setTimeout(() => setFlashes({}), 1600);
      return () => clearTimeout(t);
    }
    return undefined;
  }, [sortedPlayers, currentGame]);

  if (!currentGame) {
    return (
      <div className="max-w-7xl mx-auto px-4 sm:px-5 py-6 sm:py-10">
        <WaitingScreen />
        {showShare && <ShareModal onClose={() => setShowShare(false)} />}
      </div>
    );
  }

  const winnerLabel = currentGame.ranking_order === "lowest" ? "Lowest wins" : "Highest wins";

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-5 py-6 sm:py-8">
      <div className="flex flex-wrap items-end justify-between gap-3 mb-5 sm:mb-6">
        <div className="min-w-0">
          <span className="label-eyebrow flex items-center gap-2">
            <span className="relative inline-flex items-center justify-center w-2 h-2">
              <span className="live-dot" />
              <span className="live-dot-ring" />
            </span>
            {connected ? "LIVE" : "RECONNECTING"} • {winnerLabel}
          </span>
          <h1 data-testid="live-game-name" className="font-display text-3xl sm:text-4xl lg:text-5xl font-bold tracking-tighter mt-1 break-words">{currentGame.game_name}</h1>
        </div>
        <button data-testid="share-btn" onClick={() => setShowShare(true)} className="btn-ghost px-3 sm:px-4 py-2 sm:py-3 rounded-lg flex items-center gap-2 text-sm shrink-0">
          <Share size={16} /> Share
        </button>
      </div>

      <div className="tracing-border p-1">
        <div className="rounded-[13px] p-3 sm:p-6 bg-[#0a0a0a]">
          <div className="hidden sm:grid grid-cols-12 px-3 pb-2 label-eyebrow text-zinc-500">
            <div className="col-span-1">Rank</div>
            <div className="col-span-7 sm:col-span-8">Player</div>
            <div className="col-span-4 sm:col-span-3 text-right">Score</div>
          </div>
          <div className="flex flex-col gap-2" data-testid="player-rows">
            <AnimatePresence>
              {sortedPlayers.map((p, idx) => {
                const flash = flashes[p.key];
                const color = ROW_COLORS[idx % ROW_COLORS.length];
                const flashClass = flash === "up" ? "flash-up" : (flash === "down" ? "flash-down" : "");
                const scorePillClass = (flash === "score" || flash === "up" || flash === "down") ? "flash-yellow" : "";
                const isLeader = idx === 0 && p.totalScore > 0;
                const rowClass = isLeader
                  ? "rank-one-row border-yellow-400/60"
                  : "border-white/5 bg-white/[0.02]";
                return (
                  <motion.div
                    layout
                    key={p.key}
                    initial={{ opacity: 0, x: -40 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: idx * 0.05, type: "spring", stiffness: 200, damping: 20 }}
                    data-testid={`player-rank-${idx + 1}`}
                    className={`flex items-center gap-3 px-3 sm:px-4 py-3 sm:py-4 rounded-xl border ${rowClass} ${flashClass}`}
                  >
                    <div className="w-10 sm:w-12 font-display text-xl sm:text-2xl font-bold shrink-0" style={{ color: isLeader ? "#0a0a0a" : (idx === 0 ? "#FACC15" : "#fff") }}>
                      {idx === 0 ? <Crown size={24} weight="fill" /> : `#${idx + 1}`}
                    </div>
                    <div className="w-1.5 h-10 sm:h-12 rounded-full shrink-0" style={{ background: isLeader ? "#0a0a0a" : color }} />
                    <div className="min-w-0 flex-1">
                      <div className={`font-display text-lg sm:text-xl font-semibold truncate ${isLeader ? "text-black" : ""}`} style={{ color: isLeader ? "#0a0a0a" : color }}>{p.name}</div>
                      {p.team_key && currentGame.teams?.find((t) => t.key === p.team_key) && (
                        <div className={`text-[10px] sm:text-xs ${isLeader ? "text-black/60" : "text-zinc-500"}`}>Team: {currentGame.teams.find((t) => t.key === p.team_key).name}</div>
                      )}
                      {p.scores && p.scores.length > 0 && (
                        <div className="hidden sm:flex flex-wrap gap-1 mt-1.5">
                          {p.scores.slice(-6).map((s, sIdx) => (
                            <span key={`${p.key}-r${p.scores.length - 6 + sIdx}`} className={`text-[10px] font-mono-num border px-1.5 py-0.5 rounded ${isLeader ? "text-black/70 bg-black/10 border-black/20" : "text-zinc-500 bg-white/[0.03] border-white/5"}`}>
                              R{p.scores.length - p.scores.slice(-6).length + sIdx + 1}:{s}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                    <span
                      data-testid={`player-score-${p.key}`}
                      className={`font-mono-num font-bold text-2xl sm:text-3xl px-3 sm:px-4 py-1.5 sm:py-2 rounded-xl shrink-0 ${scorePillClass} ${isLeader ? "text-black" : ""}`}
                    >
                      {p.totalScore}
                    </span>
                  </motion.div>
                );
              })}
            </AnimatePresence>
          </div>

          {currentGame.use_teams && sortedTeams.length > 0 && (
            <div className="mt-6 pt-4 border-t border-white/5">
              <div className="label-eyebrow mb-3 flex items-center gap-2"><Trophy size={14} /> Team Totals</div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3" data-testid="team-totals">
                {sortedTeams.map((t, idx) => (
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
