import React, { useCallback, useEffect, useState } from "react";
import { api } from "@/lib/api";
import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import { useAuth } from "@/context/AuthContext";
import { Plus, Trash, DiceFive, Books } from "@phosphor-icons/react";

export default function Library() {
  const { user } = useAuth();
  const [items, setItems] = useState([]);
  const [name, setName] = useState("");
  const [desc, setDesc] = useState("");
  const [ranking, setRanking] = useState("highest");
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    try {
      const r = await api.get("/catalog");
      setItems(r.data || []);
    } catch (e) {
      console.warn("[library] load failed:", e?.message);
    }
  }, []);
  useEffect(() => {
    load();
  }, [load]);

  const add = async (e) => {
    e.preventDefault();
    setBusy(true);
    try {
      await api.post("/catalog", { name, description: desc, default_ranking: ranking });
      setName("");
      setDesc("");
      await load();
    } finally {
      setBusy(false);
    }
  };

  const del = async (id) => {
    if (!window.confirm("Delete this game from library?")) return;
    await api.delete(`/catalog/${id}`);
    await load();
  };

  return (
    <div className="max-w-7xl mx-auto px-5 py-10">
      <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4 mb-8">
        <div>
          <span className="label-eyebrow flex items-center gap-2"><Books size={14} /> GAME LIBRARY</span>
          <h1 className="font-display text-4xl sm:text-5xl font-bold tracking-tighter mt-1">All your board games</h1>
          <p className="text-zinc-500 mt-2 max-w-xl">Track stats separately for each game. Pick one when starting a new match.</p>
        </div>
      </div>

      {user && user.role === "admin" && (
        <form onSubmit={add} className="card-surface p-5 mb-8 grid grid-cols-1 md:grid-cols-12 gap-3" data-testid="add-game-form">
          <input data-testid="catalog-name-input" placeholder="Game name (e.g. Catan)" className="input md:col-span-3" value={name} onChange={(e) => setName(e.target.value)} required />
          <input data-testid="catalog-desc-input" placeholder="Short description" className="input md:col-span-5" value={desc} onChange={(e) => setDesc(e.target.value)} />
          <select data-testid="catalog-ranking-select" className="input md:col-span-2" value={ranking} onChange={(e) => setRanking(e.target.value)}>
            <option value="highest">Highest wins</option>
            <option value="lowest">Lowest wins</option>
          </select>
          <button data-testid="add-game-btn" disabled={busy} className="btn-primary md:col-span-2 rounded-lg font-semibold flex items-center justify-center gap-2">
            <Plus size={16} weight="bold" /> Add
          </button>
        </form>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6" data-testid="catalog-grid">
        {items.map((it, idx) => (
          <motion.div
            key={it.id}
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: idx * 0.04 }}
            data-testid={`catalog-card-${it.id}`}
            className="card-surface p-6 group hover:border-green-500/40 transition-all relative overflow-hidden"
          >
            <div className="absolute -top-6 -right-6 opacity-5 group-hover:opacity-15 transition-opacity">
              <DiceFive size={140} weight="fill" />
            </div>
            <div className="flex items-start justify-between mb-3">
              <span className="chip">{it.default_ranking === "highest" ? "↑ Highest" : "↓ Lowest"} wins</span>
              {user && user.role === "admin" && (
                <button data-testid={`delete-catalog-${it.id}`} onClick={() => del(it.id)} className="text-zinc-500 hover:text-red-400 transition">
                  <Trash size={16} />
                </button>
              )}
            </div>
            <h3 className="font-display text-2xl font-bold">{it.name}</h3>
            <p className="text-sm text-zinc-500 mt-1 line-clamp-2 min-h-[2.5em]">{it.description || "No description."}</p>
            <div className="mt-5 pt-4 border-t border-white/5 flex items-center justify-between">
              <span className="text-xs text-zinc-500">{it.play_count || 0} plays</span>
              <Link to={`/stats?catalog=${it.id}`} className="text-sm text-green-400 hover:underline">View stats →</Link>
            </div>
          </motion.div>
        ))}
      </div>
    </div>
  );
}
