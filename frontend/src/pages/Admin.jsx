import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { api } from "@/lib/api";
import { useAuth } from "@/context/AuthContext";
import { useGame } from "@/context/GameContext";
import { Plus, X, Play, ArrowsClockwise, StopCircle, Flag, Users, UserPlus, ArrowUUpLeft } from "@phosphor-icons/react";

function StartGameForm({ onStarted }) {
  const [catalog, setCatalog] = useState([]);
  const [catalogId, setCatalogId] = useState("");
  const [name, setName] = useState("");
  const [ranking, setRanking] = useState("highest");
  const [players, setPlayers] = useState([{ id: "p-0", name: "" }]);
  const [useTeams, setUseTeams] = useState(false);
  const [teams, setTeams] = useState([{ id: "t-0", name: "Team A", player_names: [{ id: "tp-0", name: "" }, { id: "tp-1", name: "" }] }]);
  const [busy, setBusy] = useState(false);
  const newId = () => `id-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;

  useEffect(() => {
    api.get("/catalog").then((r) => setCatalog(r.data || [])).catch((e) => console.warn("[admin] catalog load failed:", e?.message));
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
        players: useTeams ? [] : players.map((p) => p.name.trim()).filter(Boolean),
        use_teams: useTeams,
        teams: useTeams
          ? teams.map((t) => ({ name: t.name, player_names: t.player_names.map((p) => p.name.trim()).filter(Boolean) }))
          : [],
      };
      await api.post("/game/start", payload);
      onStarted();
    } catch (e2) {
      console.warn("[admin] start game failed:", e2?.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <form onSubmit={submit} className="card-surface p-4 sm:p-6 space-y-5" data-testid="start-game-form">
      <h2 className="font-display text-xl sm:text-2xl font-bold flex items-center gap-2"><Play size={20} weight="fill" /> Start a new game</h2>
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
      </div>

      {!useTeams && (
        <div>
          <label className="label-eyebrow block mb-2 flex items-center gap-2"><Users size={14} /> Players</label>
          <div className="space-y-2">
            {players.map((p, i) => (
              <div key={p.id} className="flex items-center gap-2">
                <input data-testid={`player-name-input-${i}`} className="input" placeholder={`Player ${i + 1}`} value={p.name} onChange={(e) => setPlayers(players.map((x) => (x.id === p.id ? { ...x, name: e.target.value } : x)))} />
                {players.length > 1 && (
                  <button type="button" onClick={() => setPlayers(players.filter((x) => x.id !== p.id))} className="btn-ghost px-3 py-2 rounded-lg shrink-0"><X size={14} /></button>
                )}
              </div>
            ))}
            <button type="button" data-testid="add-player-btn" onClick={() => setPlayers([...players, { id: newId(), name: "" }])} className="btn-ghost px-3 py-2 rounded-lg text-sm flex items-center gap-2"><Plus size={14} /> Add player</button>
          </div>
        </div>
      )}

      {useTeams && (
        <div className="space-y-4">
          {teams.map((t, ti) => (
            <div key={t.id} className="border border-white/10 rounded-xl p-4">
              <div className="flex items-center gap-2 mb-2">
                <input data-testid={`team-name-${ti}`} className="input" value={t.name} onChange={(e) => setTeams(teams.map((x) => (x.id === t.id ? { ...x, name: e.target.value } : x)))} />
                {teams.length > 1 && (
                  <button type="button" onClick={() => setTeams(teams.filter((x) => x.id !== t.id))} className="btn-ghost px-3 py-2 rounded-lg shrink-0"><X size={14} /></button>
                )}
              </div>
              <div className="space-y-2 pl-3">
                {t.player_names.map((pn, pi) => (
                  <div key={pn.id} className="flex items-center gap-2">
                    <input data-testid={`team-${ti}-player-${pi}`} className="input" placeholder={`Player ${pi + 1}`} value={pn.name} onChange={(e) => setTeams(teams.map((x) => (x.id === t.id ? { ...x, player_names: x.player_names.map((y) => (y.id === pn.id ? { ...y, name: e.target.value } : y)) } : x)))} />
                  </div>
                ))}
                <button type="button" onClick={() => setTeams(teams.map((x) => (x.id === t.id ? { ...x, player_names: [...x.player_names, { id: newId(), name: "" }] } : x)))} className="btn-ghost px-3 py-1.5 rounded-lg text-xs"><Plus size={12} /> Add to team</button>
              </div>
            </div>
          ))}
          <button type="button" data-testid="add-team-btn" onClick={() => setTeams([...teams, { id: newId(), name: `Team ${String.fromCharCode(65 + teams.length)}`, player_names: [{ id: newId(), name: "" }, { id: newId(), name: "" }] }])} className="btn-ghost px-3 py-2 rounded-lg text-sm flex items-center gap-2"><Plus size={14} /> Add team</button>
        </div>
      )}

      <button data-testid="start-game-btn" disabled={busy} className="btn-primary w-full py-3 rounded-lg font-semibold flex items-center justify-center gap-2">
        <Play size={16} weight="fill" /> {busy ? "Starting…" : "Start Game"}
      </button>
    </form>
  );
}

function PlayerScoreCard({ player, teamLabel }) {
  const [val, setVal] = useState("");
  const [busy, setBusy] = useState(false);

  const submit = async (e) => {
    e?.preventDefault?.();
    const v = parseFloat(val);
    if (isNaN(v)) return;
    setBusy(true);
    try {
      await api.post("/game/submit-score", { player_key: player.key, score: v });
      setVal("");
    } catch (err) {
      console.warn("[admin] submit failed:", err?.message);
    } finally {
      setBusy(false);
    }
  };

  const undo = async () => {
    if (!player.scores || player.scores.length === 0) return;
    setBusy(true);
    try {
      await api.post("/game/undo-score", { player_key: player.key });
    } catch (err) {
      console.warn("[admin] undo failed:", err?.message);
    } finally {
      setBusy(false);
    }
  };

  const scores = player.scores || [];

  return (
    <div className="border border-white/10 rounded-xl p-4 bg-white/[0.015]">
      <div className="flex items-start justify-between gap-3 mb-3">
        <div className="min-w-0 flex-1">
          <div className="font-display text-lg sm:text-xl font-semibold truncate">{player.name}</div>
          {teamLabel && <div className="text-xs text-zinc-500">Team: {teamLabel}</div>}
        </div>
        <div className="font-mono-num text-3xl sm:text-4xl font-bold leading-none shrink-0" data-testid={`admin-total-${player.key}`}>{player.totalScore}</div>
      </div>
      <form onSubmit={submit} className="flex gap-2">
        <input
          data-testid={`score-input-${player.key}`}
          type="number"
          step="any"
          inputMode="decimal"
          placeholder="Round score"
          className="input text-lg h-12"
          value={val}
          onChange={(e) => setVal(e.target.value)}
        />
        <button
          type="submit"
          disabled={busy || val === ""}
          data-testid={`submit-score-${player.key}`}
          aria-label="Add score"
          className="btn-primary h-12 w-12 rounded-lg font-bold text-2xl flex items-center justify-center shrink-0 disabled:opacity-40"
        >
          <Plus size={22} weight="bold" />
        </button>
        <button
          type="button"
          onClick={undo}
          disabled={busy || scores.length === 0}
          data-testid={`undo-score-${player.key}`}
          aria-label="Undo last score"
          className="btn-ghost h-12 w-12 rounded-lg flex items-center justify-center shrink-0 disabled:opacity-30"
          title="Undo last score"
        >
          <ArrowUUpLeft size={20} weight="bold" />
        </button>
      </form>
      {scores.length > 0 && (
        <div data-testid={`rounds-${player.key}`} className="mt-3 flex flex-wrap gap-1.5">
          {scores.map((s, idx) => (
            <div
              key={`${player.key}-r${idx}`}
              className={`flex items-baseline gap-1.5 px-2 py-1 rounded-md border text-sm ${idx === scores.length - 1 ? "border-green-500/40 bg-green-500/10" : "border-white/10 bg-white/[0.02]"}`}
            >
              <span className="text-[10px] text-zinc-500 uppercase tracking-widest">R{idx + 1}</span>
              <span className="font-mono-num font-semibold">{s}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function ActiveGameControls() {
  const { currentGame } = useGame();
  const [newPlayer, setNewPlayer] = useState("");
  const [newPlayerTeam, setNewPlayerTeam] = useState("");

  if (!currentGame) return null;

  const teamMap = Object.fromEntries((currentGame.teams || []).map((t) => [t.key, t.name]));

  const callAction = async (path, ok = "Done") => {
    try {
      await api.post(path);
    } catch (e) {
      console.warn("[admin] action failed:", path, e?.message);
    }
  };

  return (
    <div className="space-y-5">
      <div className="tracing-border p-1">
        <div className="rounded-[13px] bg-[#0a0a0a] p-4 sm:p-6">
          <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3 mb-5">
            <div className="min-w-0">
              <span className="label-eyebrow text-green-400">● LIVE GAME</span>
              <h2 data-testid="active-game-name" className="font-display text-2xl sm:text-3xl font-bold mt-1 break-words">{currentGame.game_name}</h2>
              <p className="text-xs text-zinc-500 mt-1">{currentGame.ranking_order === "highest" ? "Highest wins" : "Lowest wins"} • {currentGame.players.length} players{currentGame.use_teams ? ` • ${currentGame.teams.length} teams` : ""}</p>
            </div>
            <div className="grid grid-cols-3 sm:flex sm:flex-wrap items-center gap-2">
              <button data-testid="reset-btn" onClick={() => { if (window.confirm("Reset all scores?")) callAction("/game/reset"); }} className="btn-ghost px-3 py-2 rounded-lg text-xs sm:text-sm flex items-center justify-center gap-1.5"><ArrowsClockwise size={14} /> <span className="hidden xs:inline">Reset</span><span className="xs:hidden">Reset</span></button>
              <button data-testid="abandon-btn" onClick={() => { if (window.confirm("Abandon without saving?")) callAction("/game/abandon"); }} className="btn-danger px-3 py-2 rounded-lg text-xs sm:text-sm flex items-center justify-center gap-1.5"><Flag size={14} /> Abandon</button>
              <button data-testid="end-game-btn" onClick={() => { if (window.confirm("End game and save results?")) callAction("/game/end"); }} className="btn-primary px-3 sm:px-4 py-2 rounded-lg text-xs sm:text-sm flex items-center justify-center gap-1.5 font-semibold"><StopCircle size={14} weight="fill" /> End</button>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3" data-testid="admin-score-rows">
            {currentGame.players.map((p) => (
              <PlayerScoreCard key={p.key} player={p} teamLabel={p.team_key ? teamMap[p.team_key] : null} />
            ))}
          </div>

          <div className="mt-5 pt-5 border-t border-white/5">
            <div className="label-eyebrow mb-2 flex items-center gap-2"><UserPlus size={14} /> Add a late-joining player</div>
            <form
              onSubmit={async (e) => {
                e.preventDefault();
                if (!newPlayer.trim()) return;
                try {
                  await api.post("/game/add-player", { name: newPlayer, team_key: newPlayerTeam || null });
                  setNewPlayer("");
                  setNewPlayerTeam("");
                } catch (err) {
                  console.warn("[admin] add late player failed:", err?.message);
                }
              }}
              className="flex flex-col sm:flex-row gap-2"
            >
              <input data-testid="add-late-player-input" className="input flex-1" placeholder="Player name" value={newPlayer} onChange={(e) => setNewPlayer(e.target.value)} />
              {currentGame.use_teams && (
                <select data-testid="add-late-team-select" className="input sm:max-w-xs" value={newPlayerTeam} onChange={(e) => setNewPlayerTeam(e.target.value)}>
                  <option value="">— Pick team —</option>
                  {currentGame.teams.map((t) => <option key={t.key} value={t.key}>{t.name}</option>)}
                </select>
              )}
              <button data-testid="add-late-player-btn" className="btn-ghost px-4 py-2 rounded-lg flex items-center justify-center gap-2"><Plus size={14} /> Add</button>
            </form>
          </div>
        </div>
      </div>
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
    <div className="max-w-7xl mx-auto px-4 sm:px-5 py-6 sm:py-10">
      <div className="mb-5 sm:mb-6">
        <span className="label-eyebrow">ADMIN CONTROL ROOM</span>
        <h1 className="font-display text-3xl sm:text-4xl lg:text-5xl font-bold tracking-tighter mt-1">Game manager</h1>
      </div>
      {currentGame ? <ActiveGameControls /> : <StartGameForm key={refreshKey} onStarted={() => setRefreshKey((k) => k + 1)} />}
    </div>
  );
}
