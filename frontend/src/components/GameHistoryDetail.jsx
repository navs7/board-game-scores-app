import React, { useMemo } from "react";
import { motion } from "framer-motion";
import { ComposedChart, Bar, Line, XAxis, YAxis, Tooltip, Legend, CartesianGrid, ResponsiveContainer } from "recharts";

const ROW_COLORS = ["#22C55E", "#FACC15", "#60A5FA", "#F472B6", "#FB923C", "#A78BFA", "#34D399", "#F87171"];

export default function GameHistoryDetail({ game }) {
  // Rank players by total (desc for highest, asc for lowest)
  const ranked = useMemo(() => {
    const asc = game.ranking_order === "lowest";
    return [...game.players].sort((a, b) => (asc ? a.totalScore - b.totalScore : b.totalScore - a.totalScore));
  }, [game]);

  // Max rounds across players
  const maxRounds = useMemo(
    () => Math.max(0, ...ranked.map((p) => (p.scores || []).length)),
    [ranked]
  );

  // Chart data: [{ round: "R1", Alice: 10, Bob: 25, ...AliceCum: 10, BobCum: 25 }, ...]
  const chartData = useMemo(() => {
    const rows = [];
    for (let i = 0; i < maxRounds; i++) {
      const row = { round: `R${i + 1}` };
      ranked.forEach((p) => {
        const s = (p.scores || [])[i];
        row[p.name] = typeof s === "number" ? s : null;
        const cum = (p.scores || []).slice(0, i + 1).reduce((a, b) => a + b, 0);
        row[`${p.name} (total)`] = (p.scores || []).length > i ? cum : null;
      });
      rows.push(row);
    }
    return rows;
  }, [ranked, maxRounds]);

  return (
    <motion.div
      initial={{ height: 0, opacity: 0 }}
      animate={{ height: "auto", opacity: 1 }}
      exit={{ height: 0, opacity: 0 }}
      className="overflow-hidden"
    >
      <div className="mt-4 space-y-5">
        {/* Tabular ranking with R1..Rn */}
        <div className="overflow-x-auto rounded-lg border border-white/5">
          <table className="w-full text-sm min-w-[480px]" data-testid={`history-table-${game.id}`}>
            <thead>
              <tr className="text-zinc-500 label-eyebrow border-b border-white/5">
                <th className="text-left px-3 py-2">Rank</th>
                <th className="text-left px-3 py-2">Player</th>
                {Array.from({ length: maxRounds }).map((_, i) => (
                  <th key={`h-r${i}`} className="text-right px-2 py-2">R{i + 1}</th>
                ))}
                <th className="text-right px-3 py-2 text-green-300">Total</th>
              </tr>
            </thead>
            <tbody>
              {ranked.map((p, idx) => (
                <tr key={`${game.id}-${p.name}`} className={`border-b border-white/[0.04] ${idx === 0 ? "bg-yellow-500/5" : ""}`}>
                  <td className="px-3 py-2 font-mono-num font-bold">{idx === 0 ? "🏆" : `#${idx + 1}`}</td>
                  <td className="px-3 py-2 font-display font-semibold" style={{ color: ROW_COLORS[idx % ROW_COLORS.length] }}>{p.name}</td>
                  {Array.from({ length: maxRounds }).map((_, i) => (
                    <td key={`${p.name}-r${i}`} className="text-right px-2 py-2 font-mono-num text-zinc-300">
                      {(p.scores || [])[i] ?? "—"}
                    </td>
                  ))}
                  <td className="text-right px-3 py-2 font-mono-num font-bold text-white">{p.totalScore}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Chart */}
        {maxRounds > 0 && (
          <div className="border border-white/5 rounded-lg p-3 sm:p-4 bg-white/[0.015]" data-testid={`history-chart-${game.id}`}>
            <div className="label-eyebrow mb-2 text-zinc-400">Round-by-round (bars = per-round, lines = running total)</div>
            <div className="w-full h-72">
              <ResponsiveContainer width="100%" height="100%">
                <ComposedChart data={chartData} margin={{ top: 10, right: 12, left: -8, bottom: 4 }}>
                  <CartesianGrid stroke="rgba(255,255,255,0.05)" strokeDasharray="3 3" />
                  <XAxis dataKey="round" stroke="#71717a" fontSize={11} />
                  <YAxis stroke="#71717a" fontSize={11} />
                  <Tooltip
                    contentStyle={{ background: "#0a0a0a", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 8, fontSize: 12 }}
                    cursor={{ fill: "rgba(255,255,255,0.04)" }}
                  />
                  <Legend wrapperStyle={{ fontSize: 11 }} />
                  {ranked.map((p, idx) => (
                    <Bar
                      key={`bar-${p.name}`}
                      dataKey={p.name}
                      fill={ROW_COLORS[idx % ROW_COLORS.length]}
                      radius={[4, 4, 0, 0]}
                      opacity={0.65}
                    />
                  ))}
                  {ranked.map((p, idx) => (
                    <Line
                      key={`line-${p.name}`}
                      type="monotone"
                      dataKey={`${p.name} (total)`}
                      stroke={ROW_COLORS[idx % ROW_COLORS.length]}
                      strokeWidth={2}
                      dot={{ r: 3 }}
                    />
                  ))}
                </ComposedChart>
              </ResponsiveContainer>
            </div>
          </div>
        )}
      </div>
    </motion.div>
  );
}
