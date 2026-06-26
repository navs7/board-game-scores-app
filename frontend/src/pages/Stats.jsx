import React, { useEffect, useMemo, useState } from "react";
import { api } from "@/lib/api";
import { useSearchParams } from "react-router-dom";
import { useAuth } from "@/context/AuthContext";
import { motion, AnimatePresence } from "framer-motion";
import { Trophy, Users, Clock, Trash, FileCsv, FilePdf, MagnifyingGlass, CaretDown, Medal, Crown, Star, Shield, Fire, Lightning, Target } from "@phosphor-icons/react";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import Papa from "papaparse";

const ICONS = { Trophy, Medal, Crown, Shield, Fire, Lightning, Star, Target };

function Tab({ active, onClick, children, testid }) {
  return (
    <button data-testid={testid} onClick={onClick} className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${active ? "bg-white/10 text-white border border-white/15" : "text-zinc-500 hover:text-white"}`}>
      {children}
    </button>
  );
}

export default function Stats() {
  const { user } = useAuth();
  const [params] = useSearchParams();
  const catalogFilter = params.get("catalog");
  const [tab, setTab] = useState("leaderboard");
  const [players, setPlayers] = useState([]);
  const [history, setHistory] = useState([]);
  const [defs, setDefs] = useState([]);
  const [sortBy, setSortBy] = useState("wins");
  const [search, setSearch] = useState("");
  const [expandedGame, setExpandedGame] = useState(null);

  const load = async () => {
    const [p, h, d] = await Promise.all([
      api.get("/players"),
      api.get("/history", { params: catalogFilter ? { catalog_id: catalogFilter } : {} }),
      api.get("/achievements/definitions"),
    ]);
    setPlayers(p.data || []);
    setHistory(h.data || []);
    setDefs(d.data || []);
  };
  useEffect(() => {
    load();
  }, [catalogFilter]);

  const sortedPlayers = useMemo(() => {
    const arr = [...players];
    arr.sort((a, b) => {
      if (sortBy === "wins") return b.wins - a.wins;
      if (sortBy === "winRate") return b.winRate - a.winRate;
      if (sortBy === "avgScore") return b.avgScore - a.avgScore;
      if (sortBy === "games") return b.gamesPlayed - a.gamesPlayed;
      return 0;
    });
    return arr;
  }, [players, sortBy]);

  const filteredPlayers = useMemo(
    () => sortedPlayers.filter((p) => p.name.toLowerCase().includes(search.toLowerCase())),
    [sortedPlayers, search]
  );

  const exportCsv = () => {
    const rows = history.map((g) => ({
      Game: g.game_name,
      Ended: new Date(g.ended_at).toLocaleString(),
      Winner: g.winner_label,
      Ranking: g.ranking_order,
      Players: g.players.map((p) => `${p.name}:${p.totalScore}`).join("; "),
    }));
    const csv = Papa.unparse(rows);
    const blob = new Blob([csv], { type: "text/csv" });
    const u = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = u;
    a.download = "game_history.csv";
    a.click();
    URL.revokeObjectURL(u);
  };

  const exportPdf = () => {
    const doc = new jsPDF();
    doc.setFontSize(18);
    doc.text("Game History", 14, 18);
    autoTable(doc, {
      startY: 24,
      head: [["Game", "Ended", "Winner", "Players (Score)"]],
      body: history.map((g) => [
        g.game_name,
        new Date(g.ended_at).toLocaleString(),
        g.winner_label,
        g.players.map((p) => `${p.name} (${p.totalScore})`).join(", "),
      ]),
      headStyles: { fillColor: [34, 197, 94] },
      styles: { fontSize: 9 },
    });
    doc.save("game_history.pdf");
  };

  const delGame = async (id) => {
    if (!window.confirm("Delete this game record permanently?")) return;
    await api.delete(`/history/${id}`);
    await load();
  };
  const delPlayer = async (name) => {
    if (!window.confirm(`Delete player "${name}" record?`)) return;
    await api.delete(`/players/${encodeURIComponent(name)}`);
    await load();
  };

  const ROW_COLORS = ["#22C55E", "#FACC15", "#60A5FA", "#F472B6", "#FB923C", "#A78BFA", "#34D399", "#F87171"];

  return (
    <div className="max-w-7xl mx-auto px-5 py-10">
      <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4 mb-6">
        <div>
          <span className="label-eyebrow">STATS & HISTORY</span>
          <h1 className="font-display text-4xl sm:text-5xl font-bold tracking-tighter mt-1">All-time records</h1>
        </div>
        <div className="flex items-center gap-2">
          <button data-testid="export-csv-btn" onClick={exportCsv} className="btn-ghost px-4 py-2 rounded-lg flex items-center gap-2 text-sm"><FileCsv size={16} /> CSV</button>
          <button data-testid="export-pdf-btn" onClick={exportPdf} className="btn-ghost px-4 py-2 rounded-lg flex items-center gap-2 text-sm"><FilePdf size={16} /> PDF</button>
        </div>
      </div>

      <div className="flex gap-2 mb-6 border-b border-white/5 pb-3">
        <Tab testid="tab-leaderboard" active={tab === "leaderboard"} onClick={() => setTab("leaderboard")}>Leaderboard</Tab>
        <Tab testid="tab-history" active={tab === "history"} onClick={() => setTab("history")}>History</Tab>
        <Tab testid="tab-players" active={tab === "players"} onClick={() => setTab("players")}>Players</Tab>
        <Tab testid="tab-achievements" active={tab === "achievements"} onClick={() => setTab("achievements")}>Achievements</Tab>
      </div>

      {tab === "leaderboard" && (
        <div className="card-surface p-1">
          <div className="flex items-center justify-between p-4">
            <div className="flex items-center gap-2">
              {[
                ["wins", "Wins"],
                ["winRate", "Win Rate"],
                ["avgScore", "Avg Score"],
                ["games", "Games"],
              ].map(([k, l]) => (
                <button key={k} data-testid={`sort-${k}`} onClick={() => setSortBy(k)} className={`text-xs px-3 py-1.5 rounded-full ${sortBy === k ? "bg-green-500/15 text-green-300 border border-green-500/30" : "border border-white/10 text-zinc-400"}`}>
                  {l}
                </button>
              ))}
            </div>
          </div>
          <div className="divide-y divide-white/5">
            <div className="grid grid-cols-12 px-4 py-2 label-eyebrow text-zinc-500">
              <div className="col-span-1">#</div>
              <div className="col-span-4">Player</div>
              <div className="col-span-2 text-right">Wins</div>
              <div className="col-span-2 text-right">Win Rate</div>
              <div className="col-span-2 text-right">Avg</div>
              <div className="col-span-1 text-right">Games</div>
            </div>
            {filteredPlayers.length === 0 && <div className="px-6 py-10 text-center text-zinc-500">No player data yet.</div>}
            {filteredPlayers.map((p, idx) => (
              <div key={p.name} data-testid={`leaderboard-row-${idx}`} className="grid grid-cols-12 px-4 py-3 items-center hover:bg-white/[0.02]">
                <div className="col-span-1 font-mono-num font-bold">{idx + 1}</div>
                <div className="col-span-4 font-display font-semibold" style={{ color: ROW_COLORS[idx % ROW_COLORS.length] }}>{p.name}</div>
                <div className="col-span-2 text-right font-mono-num">{p.wins}</div>
                <div className="col-span-2 text-right font-mono-num">{(p.winRate * 100).toFixed(0)}%</div>
                <div className="col-span-2 text-right font-mono-num">{p.avgScore.toFixed(1)}</div>
                <div className="col-span-1 text-right font-mono-num text-zinc-400">{p.gamesPlayed}</div>
              </div>
            ))}
          </div>
        </div>
      )}

      {tab === "history" && (
        <div className="card-surface p-1">
          {history.length === 0 && <div className="px-6 py-10 text-center text-zinc-500">No games played yet.</div>}
          <div className="divide-y divide-white/5">
            {history.map((g) => (
              <div key={g.id} data-testid={`history-row-${g.id}`} className="p-4">
                <div className="flex items-center justify-between">
                  <button onClick={() => setExpandedGame(expandedGame === g.id ? null : g.id)} className="flex items-center gap-3 text-left flex-1">
                    <Trophy size={20} weight="fill" className="text-yellow-300" />
                    <div>
                      <div className="font-display text-lg font-semibold">{g.game_name} <span className="text-zinc-500 text-sm">— winner: <span className="text-white">{g.winner_label}</span></span></div>
                      <div className="text-xs text-zinc-500 flex items-center gap-2 mt-0.5"><Clock size={12} /> {new Date(g.ended_at).toLocaleString()} • {g.ranking_order === "highest" ? "Highest wins" : "Lowest wins"}</div>
                    </div>
                    <CaretDown size={18} className={`ml-auto text-zinc-500 transition-transform ${expandedGame === g.id ? "rotate-180" : ""}`} />
                  </button>
                  {user && user.role === "admin" && (
                    <button data-testid={`delete-game-${g.id}`} onClick={() => delGame(g.id)} className="ml-3 text-zinc-500 hover:text-red-400"><Trash size={16} /></button>
                  )}
                </div>
                <AnimatePresence>
                  {expandedGame === g.id && (
                    <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden">
                      <div className="mt-3 pl-8 grid grid-cols-1 sm:grid-cols-2 gap-2">
                        {g.players.map((p, i) => (
                          <div key={i} className="flex items-center justify-between border border-white/5 rounded-lg px-3 py-2">
                            <span style={{ color: ROW_COLORS[i % ROW_COLORS.length] }}>{p.name}</span>
                            <span className="font-mono-num font-bold">{p.totalScore}</span>
                          </div>
                        ))}
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            ))}
          </div>
        </div>
      )}

      {tab === "players" && (
        <div>
          <div className="relative max-w-md mb-4">
            <MagnifyingGlass size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500" />
            <input data-testid="player-search" className="input pl-10" placeholder="Search players…" value={search} onChange={(e) => setSearch(e.target.value)} />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredPlayers.map((p) => (
              <div key={p.name} data-testid={`player-card-${p.name}`} className="card-surface p-5">
                <div className="flex items-start justify-between">
                  <div className="font-display text-xl font-bold">{p.name}</div>
                  {user && user.role === "admin" && (
                    <button data-testid={`delete-player-${p.name}`} onClick={() => delPlayer(p.name)} className="text-zinc-500 hover:text-red-400"><Trash size={14} /></button>
                  )}
                </div>
                <div className="grid grid-cols-3 gap-2 mt-4 text-center">
                  <div><div className="text-2xl font-mono-num font-bold">{p.wins}</div><div className="text-[10px] text-zinc-500 uppercase tracking-widest">Wins</div></div>
                  <div><div className="text-2xl font-mono-num font-bold">{(p.winRate * 100).toFixed(0)}%</div><div className="text-[10px] text-zinc-500 uppercase tracking-widest">Win Rate</div></div>
                  <div><div className="text-2xl font-mono-num font-bold">{p.gamesPlayed}</div><div className="text-[10px] text-zinc-500 uppercase tracking-widest">Games</div></div>
                </div>
                {p.achievements?.length > 0 && (
                  <div className="mt-4 pt-4 border-t border-white/5 flex flex-wrap gap-1.5">
                    {p.achievements.map((aid) => {
                      const def = defs.find((d) => d.id === aid);
                      if (!def) return null;
                      const Icon = ICONS[def.icon] || Star;
                      return (
                        <span key={aid} title={def.name + ": " + def.desc} className="chip text-yellow-300 border-yellow-500/40">
                          <Icon size={12} weight="fill" /> {def.name}
                        </span>
                      );
                    })}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {tab === "achievements" && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {defs.map((d) => {
            const Icon = ICONS[d.icon] || Star;
            const earnedBy = players.filter((p) => p.achievements?.includes(d.id));
            return (
              <div key={d.id} data-testid={`achievement-card-${d.id}`} className="card-surface p-5">
                <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-yellow-400/20 to-yellow-600/10 border border-yellow-500/30 flex items-center justify-center mb-3">
                  <Icon size={24} weight="fill" className="text-yellow-300" />
                </div>
                <div className="font-display text-lg font-bold">{d.name}</div>
                <div className="text-sm text-zinc-500 mt-1">{d.desc}</div>
                <div className="mt-3 text-xs text-zinc-500 border-t border-white/5 pt-3">
                  Earned by <span className="text-white font-semibold">{earnedBy.length}</span> player{earnedBy.length === 1 ? "" : "s"}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
