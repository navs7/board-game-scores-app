import React, { createContext, useContext, useEffect, useRef, useState } from "react";
import { api, wsUrl } from "@/lib/api";

const GameCtx = createContext(null);

export function GameProvider({ children }) {
  const [currentGame, setCurrentGame] = useState(null);
  const [connected, setConnected] = useState(false);
  const wsRef = useRef(null);

  useEffect(() => {
    // Initial fetch
    api
      .get("/game/current")
      .then((r) => setCurrentGame(r.data || null))
      .catch(() => { /* ignore */ });

    let cancelled = false;
    function connect() {
      if (cancelled) return;
      const ws = new WebSocket(wsUrl());
      wsRef.current = ws;
      ws.onopen = () => setConnected(true);
      ws.onmessage = (evt) => {
        try {
          const msg = JSON.parse(evt.data);
          if (msg.type === "current_game") setCurrentGame(msg.data || null);
        } catch (e) { /* ignore */ }
      };
      ws.onclose = () => {
        setConnected(false);
        setTimeout(connect, 2000);
      };
      ws.onerror = () => {
        try { ws.close(); } catch (e) { /* ignore */ }
      };
    }
    connect();
    return () => {
      cancelled = true;
      try { wsRef.current && wsRef.current.close(); } catch (e) { /* ignore */ }
    };
  }, []);

  return (
    <GameCtx.Provider value={{ currentGame, connected }}>
      {children}
    </GameCtx.Provider>
  );
}

export const useGame = () => useContext(GameCtx);
