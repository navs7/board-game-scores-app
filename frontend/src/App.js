import React from "react";
import "@/App.css";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AuthProvider } from "@/context/AuthContext";
import { GameProvider } from "@/context/GameContext";
import Nav from "@/components/Nav";
import LiveScoreboard from "@/pages/LiveScoreboard";
import Library from "@/pages/Library";
import Stats from "@/pages/Stats";
import Admin from "@/pages/Admin";
import Login from "@/pages/Login";

function Shell({ children }) {
  return (
    <div className="App relative min-h-screen">
      <div className="absolute inset-0 bg-grid opacity-30 pointer-events-none" />
      <Nav />
      <main className="relative z-10">{children}</main>
      <footer className="border-t border-white/5 mt-16 py-6 text-center text-xs text-zinc-600">
        Board Game Scoreboard · Built with WebSockets · Real-time live updates
      </footer>
    </div>
  );
}

function App() {
  return (
    <AuthProvider>
      <GameProvider>
        <BrowserRouter>
          <Shell>
            <Routes>
              <Route path="/" element={<LiveScoreboard />} />
              <Route path="/library" element={<Library />} />
              <Route path="/stats" element={<Stats />} />
              <Route path="/admin" element={<Admin />} />
              <Route path="/login" element={<Login />} />
            </Routes>
          </Shell>
        </BrowserRouter>
      </GameProvider>
    </AuthProvider>
  );
}

export default App;
