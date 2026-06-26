import React, { createContext, useContext, useEffect, useRef, useState } from "react";
import { api, wsUrl } from "@/lib/api";

const GameCtx = createContext(null);

export function GameProvider({ children }) {
  const [currentGame, setCurrentGame] = useState(null);
  const [connected, setConnected] = useState(false);
  const wsRef = useRef(null);

  useEffect(() => {
    let cancelled = false;
    let reconnectTimer = null;

    // Initial fetch
    api
      .get("/game/current")
      .then((r) => { if (!cancelled) setCurrentGame(r.data || null); })
      .catch((e) => console.warn("[game] initial fetch failed:", e?.message));

    function connect() {
      if (cancelled) return;
      const ws = new WebSocket(wsUrl());
      wsRef.current = ws;
      ws.onopen = () => setConnected(true);
      ws.onmessage = (evt) => {
        try {
          const msg = JSON.parse(evt.data);
          if (msg.type === "current_game") setCurrentGame(msg.data || null);
        } catch (e) {
          console.warn("[game] ws message parse failed:", e?.message);
        }
      };
      ws.onclose = () => {
        setConnected(false);
        if (!cancelled) reconnectTimer = setTimeout(connect, 2000);
      };
      ws.onerror = (e) => {
        console.warn("[game] ws error:", e?.message || "unknown");
        try { ws.close(); } catch (err) {
          console.warn("[game] ws close after error failed:", err?.message);
        }
      };
    }
    connect();

    return () => {
      cancelled = true;
      if (reconnectTimer) clearTimeout(reconnectTimer);
      try {
        if (wsRef.current) wsRef.current.close();
      } catch (e) {
        console.warn("[game] ws teardown failed:", e?.message);
      }
    };
  }, []);

  return (
    <GameCtx.Provider value={{ currentGame, connected }}>
      {children}
    </GameCtx.Provider>
  );
}

export const useGame = () => useContext(GameCtx);
