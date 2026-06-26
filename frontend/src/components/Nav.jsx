import React from "react";
import { Link, useLocation } from "react-router-dom";
import { useAuth } from "@/context/AuthContext";
import { DiceFive, ChartBar, Gauge, SignOut, SignIn, Books } from "@phosphor-icons/react";

export default function Nav() {
  const { user, logout } = useAuth();
  const loc = useLocation();
  const link = (to, label, Icon, testid) => {
    const active = loc.pathname === to || (to !== "/" && loc.pathname.startsWith(to));
    return (
      <Link
        to={to}
        data-testid={testid}
        className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm transition-all ${
          active ? "text-white bg-white/5 border border-white/10" : "text-zinc-400 hover:text-white"
        }`}
      >
        <Icon size={16} weight={active ? "fill" : "regular"} />
        {label}
      </Link>
    );
  };

  return (
    <nav data-testid="main-nav" className="sticky top-0 z-30 backdrop-blur-xl bg-black/50 border-b border-white/5">
      <div className="max-w-7xl mx-auto px-5 py-3 flex items-center gap-2">
        <Link to="/" data-testid="logo-home" className="flex items-center gap-2 mr-3">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-green-400 to-yellow-300 flex items-center justify-center text-black font-black">
            <DiceFive size={20} weight="fill" />
          </div>
          <span className="font-display text-lg font-bold tracking-tight">SCOREBOARD<span className="text-green-400">.</span></span>
        </Link>
        <div className="flex items-center gap-1 ml-2">
          {link("/", "Live", Gauge, "nav-live")}
          {link("/library", "Library", Books, "nav-library")}
          {link("/stats", "Stats", ChartBar, "nav-stats")}
          {user && user.role === "admin" && link("/admin", "Admin", DiceFive, "nav-admin")}
        </div>
        <div className="ml-auto">
          {user && user.email ? (
            <div className="flex items-center gap-3">
              <span data-testid="user-email" className="text-xs text-zinc-400 hidden sm:block">{user.email}</span>
              <button data-testid="logout-btn" onClick={logout} className="btn-ghost px-3 py-2 rounded-lg text-sm flex items-center gap-2">
                <SignOut size={14} /> Logout
              </button>
            </div>
          ) : (
            <Link to="/login" data-testid="nav-login" className="btn-primary px-4 py-2 rounded-lg text-sm flex items-center gap-2 font-semibold">
              <SignIn size={14} weight="bold" /> Admin Login
            </Link>
          )}
        </div>
      </div>
    </nav>
  );
}
