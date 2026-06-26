import React, { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { api } from "@/lib/api";
import { useAuth } from "@/context/AuthContext";
import { useGame } from "@/context/GameContext";
import { motion } from "framer-motion";
import { Plus, X, Play, ArrowsClockwise, StopCircle, Flag, Users, UserPlus, SkipForward, Clock } from "@phosphor-icons/react";

function StartGameForm({ onStarted }) {
  const [catalog, setCatalog] = useState([]);
  const [catalogId, setCatalogId] = useState("");
  const [name, setName] = useState("");
  const [ranking, setRanking] = useState("highest");
  const [players, setPlayers] = useState([""]);
  const [useTeams, setUseTeams] = useState(false);
  const [teams, setTeams] = useState([{ name: "Team A", player_names: ["", ""] }]);
  const [enableTimer, setEnableTimer] = useState(false);
  const [turnDuration, setTurnDuration] = useState(60);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    api.get("/catalog").then((r) => setCatalog(r.data || []));
  }, []);

  const selectCat = (id) => {
    setCatalogId(id);
    const c = catalog.find((x) => x.id === id);
    if (c) {
      setName((prev) => prev || c.name);
      setRanking(c.default_ranking);
    }
  };

  const submit = async (e) => {
    e.preventDefault();
    setBusy(true);
    try {
      const payload = {
        game_name: name,
        catalog_id: catalogId || null,
        ranking_order: ranking,
        players: useTeams ? [] : players.map((p) => p.trim()).filter(Boolean),
        use_teams: useTeams,
        teams: useTeams
          ? teams.map((t) => ({ name: t.name, player_names: t.player_names.map((p) => p.trim()).filter(Boolean) }))
          : [],
        enable_timer: enableTimer,
        turn_duration_sec: Number(turnDuration) || 60,
      };
      await api.post("/game/start", payload);
      onStarted();
    } finally {
      setBusy(false);
    }
  };

  return (
    <form onSubmit={submit} className="card-surface p-6 space-y-5" data-testid="start-game-form">
      <h2 className="font-display text-2xl font-bold flex items-center gap-2"><Play size={22} weight="fill" /> Start a new game</h2>
      <div className="grid grid-cols-1 md:grid-cols-12 gap-3">
        <div className="md:col-span-5">
          <label className="label-eyebrow block mb-2">From library (optional)</label>
          <select data-testid="catalog-select" className="input" value={catalogId} onChange={(e) => selectCat(e.target.value)}>
            <option value="">— Custom game —</option>
            {catalog.map((c) => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>
        </div>
        <div className="md:col-span-5">
          <label className="label-eyebrow block mb-2">Game name</label>
          <input data-testid="game-name-input" className="input" value={name} onChange={(e) => setName(e.target.value)} required placeholder="e.g. Catan – Friday Night" />
        </div>
        <div className="md:col-span-2">
          <label className="label-eyebrow block mb-2">Ranking</label>
          <select data-testid="ranking-select" className="input" value={ranking} onChange={(e) => setRanking(e.target.value)}>
            <option value="highest">Highest wins</option>
            <option value="lowest">Lowest wins</option>
          </select>
        </div>
      </div>

      <div className="flex items-center gap-6 pt-2 border-t border-white/5">
        <label className="flex items-center gap-2 text-sm">
          <input data-testid="use-teams-toggle" type="checkbox" checked={useTeams} onChange={(e) => setUseTeams(e.target.checked)} /> Team play
        </label>
        <label className="flex items-center gap-2 text-sm">
          <input data-testid="enable-timer-toggle" type="checkbox" checked={enableTimer} onChange={(e) => setEnableTimer(e.target.checked)} /> Turn timer
        </label>
        {enableTimer && (
          <div className="flex items-center gap-2 text-sm">
            <span className="text-zinc-500">Duration (sec):</span>
            <input data-testid="turn-duration-input" type="number" min="10" max="600" className="input w-24 py-1.5" value={turnDuration} onChange={(e) => setTurnDuration(e.target.value)} />
          </div>
        )}
      </div>

      {!useTeams && (
        <div>
          <label className="label-eyebrow block mb-2 flex items-center gap-2"><Users size={14} /> Players</label>
          <div className="space-y-2">
            {players.map((p, i) => (
              <div key={i} className="flex items-center gap-2">
                <input data-testid={`player-name-input-${i}`} className="input" placeholder={`Player ${i + 1}`} value={p} onChange={(e) => setPlayers(players.map((x, j) => (j === i ? e.target.value : x)))} />
                {players.length > 1 && (
                  <button type="button" onClick={() => setPlayers(players.filter((_, j) => j !== i))} className="btn-ghost px-3 py-2 rounded-lg"><X size={14} /></button>
                )}
              </div>
            ))}
            <button type="button" data-testid="add-player-btn" onClick={() => setPlayers([...players, ""])} className="btn-ghost px-3 py-2 rounded-lg text-sm flex items-center gap-2"><Plus size={14} /> Add player</button>
          </div>
        </div>
      )}

      {useTeams && (
        <div className="space-y-4">
          {teams.map((t, ti) => (
            <div key={ti} className="border border-white/10 rounded-xl p-4">
              <div className="flex items-center gap-2 mb-2">
                <input data-testid={`team-name-${ti}`} className="input" value={t.name} onChange={(e) => setTeams(teams.map((x, j) => (j === ti ? { ...x, name: e.target.value } : x)))} />
                {teams.length > 1 && (
                  <button type="button" onClick={() => setTeams(teams.filter((_, j) => j !== ti))} className="btn-ghost px-3 py-2 rounded-lg"><X size={14} /></button>
                )}
              </div>
              <div className="space-y-2 pl-3">
                {t.player_names.map((pn, pi) => (
                  <div key={pi} className="flex items-center gap-2">
                    <input data-testid={`team-${ti}-player-${pi}`} className="input" placeholder={`Player ${pi + 1}`} value={pn} onChange={(e) => setTeams(teams.map((x, j) => (j === ti ? { ...x, player_names: x.player_names.map((y, k) => (k === pi ? e.target.value : y)) } : x)))} />
                  </div>
                ))}
                <button type="button" onClick={() => setTeams(teams.map((x, j) => (j === ti ? { ...x, player_names: [...x.player_names, ""] } : x)))} className="btn-ghost px-3 py-1.5 rounded-lg text-xs"><Plus size={12} /> Add to team</button>
              </div>
            </div>
          ))}
          <button type="button" data-testid="add-team-btn" onClick={() => setTeams([...teams, { name: `Team ${String.fromCharCode(65 + teams.length)}`, player_names: ["", ""] }])} className="btn-ghost px-3 py-2 rounded-lg text-sm flex items-center gap-2"><Plus size={14} /> Add team</button>
        </div>
      )}

      <button data-testid="start-game-btn" disabled={busy} className="btn-primary w-full py-3 rounded-lg font-semibold flex items-center justify-center gap-2">
        <Play size={16} weight="fill" /> {busy ? "Starting…" : "Start Game"}
      </button>
    </form>
  );
}

function ActiveGameControls() {
  const { currentGame } = useGame();
  const [scoreInputs, setScoreInputs] = useState({});
  const [newPlayer, setNewPlayer] = useState("");
  const [newPlayerTeam, setNewPlayerTeam] = useState("");

  const submitScore = async (player_key) => {
    const v = parseFloat(scoreInputs[player_key]);
    if (isNaN(v)) return;
    await api.post("/game/submit-score", { player_key, score: v });
    setScoreInputs((s) => ({ ...s, [player_key]: "" }));
  };

  if (!currentGame) return null;

  return (
    <div className="space-y-5">
      <div className="tracing-border p-1">
        <div className="rounded-[13px] bg-[#0a0a0a] p-6">
          <div className="flex items-center justify-between mb-4">
            <div>
              <span className="label-eyebrow text-green-400">● LIVE GAME</span>
              <h2 data-testid="active-game-name" className="font-display text-3xl font-bold mt-1">{currentGame.game_name}</h2>
              <p className="text-xs text-zinc-500 mt-1">{currentGame.ranking_order === "highest" ? "Highest wins" : "Lowest wins"} • {currentGame.players.length} players{currentGame.use_teams ? ` • ${currentGame.teams.length} teams` : ""}</p>
            </div>
            <div className="flex items-center gap-2">
              <button data-testid="next-turn-btn" onClick={() => api.post("/game/next-turn")} className="btn-ghost px-3 py-2 rounded-lg text-sm flex items-center gap-2"><SkipForward size={14} /> Next turn</button>
              <button data-testid="reset-btn" onClick={async () => { if (window.confirm("Reset all scores?")) await api.post("/game/reset"); }} className="btn-ghost px-3 py-2 rounded-lg text-sm flex items-center gap-2"><ArrowsClockwise size={14} /> Reset</button>
              <button data-testid="abandon-btn" onClick={async () => { if (window.confirm("Abandon without saving?")) await api.post("/game/abandon"); }} className="btn-danger px-3 py-2 rounded-lg text-sm flex items-center gap-2"><Flag size={14} /> Abandon</button>
              <button data-testid="end-game-btn" onClick={async () => { if (window.confirm("End game and save results?")) await api.post("/game/end"); }} className="btn-primary px-4 py-2 rounded-lg text-sm flex items-center gap-2 font-semibold"><StopCircle size={14} weight="fill" /> End Game</button>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-3" data-testid="admin-score-rows">
            {currentGame.players.map((p, idx) => {
              const isTurn = currentGame.players[currentGame.current_turn_idx]?.key === p.key;
              return (
                <div key={p.key} className={`border rounded-xl p-4 ${isTurn ? "border-green-500/40 bg-green-500/5" : "border-white/10"}`}>
                  <div className="flex items-center justify-between mb-3">
                    <div>
                      <div className="font-display text-lg font-semibold flex items-center gap-2">
                        {isTurn && <span className="chip text-green-400 border-green-500/50 text-[10px] px-2 py-0.5"><Clock size={10} weight="bold" /> TURN</span>}
                        {p.name}
                      </div>
                      {p.team_key && currentGame.teams.find((t) => t.key === p.team_key) && (
                        <div className="text-xs text-zinc-500">Team: {currentGame.teams.find((t) => t.key === p.team_key).name}</div>
                      )}
                    </div>
                    <div className="font-mono-num text-3xl font-bold" data-testid={`admin-total-${p.key}`}>{p.totalScore}</div>
                  </div>
                  <form onSubmit={(e) => { e.preventDefault(); submitScore(p.key); }} className="flex gap-2">
                    <input
                      data-testid={`score-input-${p.key}`}
                      type="number"
                      step="any"
                      placeholder="Add round score"
                      className="input"
                      value={scoreInputs[p.key] || ""}
                      onChange={(e) => setScoreInputs((s) => ({ ...s, [p.key]: e.target.value }))}
                    />
                    <button data-testid={`submit-score-${p.key}`} className="btn-primary px-4 rounded-lg font-semibold">+</button>
                  </form>
                </div>
              );
            })}
          </div>

          <div className="mt-5 pt-5 border-t border-white/5">
            <div className="label-eyebrow mb-2 flex items-center gap-2"><UserPlus size={14} /> Add a late-joining player</div>
            <form
              onSubmit={async (e) => {
                e.preventDefault();
                if (!newPlayer.trim()) return;
                await api.post("/game/add-player", { name: newPlayer, team_key: newPlayerTeam || null });
                setNewPlayer("");
                setNewPlayerTeam("");
              }}
              className="flex flex-wrap gap-2"
            >
              <input data-testid="add-late-player-input" className="input max-w-xs" placeholder="Player name" value={newPlayer} onChange={(e) => setNewPlayer(e.target.value)} />
              {currentGame.use_teams && (
                <select data-testid="add-late-team-select" className="input max-w-xs" value={newPlayerTeam} onChange={(e) => setNewPlayerTeam(e.target.value)}>
                  <option value="">— Pick team —</option>
                  {currentGame.teams.map((t) => <option key={t.key} value={t.key}>{t.name}</option>)}
                </select>
              )}
              <button data-testid="add-late-player-btn" className="btn-ghost px-4 rounded-lg flex items-center gap-2"><Plus size={14} /> Add</button>
            </form>
          </div>
        </div>
      </div>

      {currentGame.rounds.length > 0 && (
        <div className="card-surface p-5">
          <h3 className="font-display text-lg font-bold mb-3">Round history</h3>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-zinc-500 label-eyebrow">
                  <th className="text-left pb-2 pr-3">Round</th>
                  {currentGame.players.map((p) => <th key={p.key} className="text-right px-2 pb-2">{p.name}</th>)}
                </tr>
              </thead>
              <tbody>
                {currentGame.rounds.map((r) => (
                  <tr key={r.round_num} className="border-t border-white/5">
                    <td className="py-2 pr-3 font-mono-num text-zinc-400">R{r.round_num}</td>
                    {currentGame.players.map((p) => (
                      <td key={p.key} className="text-right px-2 font-mono-num">{r.scores[p.key] ?? "—"}</td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

export default function Admin() {
  const { user, loading } = useAuth();
  const { currentGame } = useGame();
  const nav = useNavigate();
  const [refreshKey, setRefreshKey] = useState(0);

  useEffect(() => {
    if (!loading && (!user || user.role !== "admin")) nav("/login");
  }, [user, loading, nav]);

  if (loading || !user) return <div className="max-w-7xl mx-auto px-5 py-16 text-zinc-500">Loading…</div>;

  return (
    <div className="max-w-7xl mx-auto px-5 py-10">
      <div className="mb-6">
        <span className="label-eyebrow">ADMIN CONTROL ROOM</span>
        <h1 className="font-display text-4xl sm:text-5xl font-bold tracking-tighter mt-1">Game manager</h1>
      </div>
      {currentGame ? <ActiveGameControls /> : <StartGameForm key={refreshKey} onStarted={() => setRefreshKey((k) => k + 1)} />}
    </div>
  );
}
