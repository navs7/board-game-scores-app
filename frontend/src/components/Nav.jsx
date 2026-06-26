import React, { useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { useAuth } from "@/context/AuthContext";
import { DiceFive, ChartBar, Gauge, SignOut, SignIn, Books, List, X } from "@phosphor-icons/react";

export default function Nav() {
  const { user, logout } = useAuth();
  const loc = useLocation();
  const [open, setOpen] = useState(false);

  const items = [
    { to: "/", label: "Live", Icon: Gauge, testid: "nav-live" },
    { to: "/library", label: "Library", Icon: Books, testid: "nav-library" },
    { to: "/stats", label: "Stats", Icon: ChartBar, testid: "nav-stats" },
    ...(user && user.role === "admin" ? [{ to: "/admin", label: "Admin", Icon: DiceFive, testid: "nav-admin" }] : []),
  ];

  const isActive = (to) => loc.pathname === to || (to !== "/" && loc.pathname.startsWith(to));

  const NavLink = ({ to, label, Icon, testid }) => {
    const active = isActive(to);
    return (
      <Link
        to={to}
        data-testid={testid}
        onClick={() => setOpen(false)}
        className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm transition-all ${active ? "text-white bg-white/5 border border-white/10" : "text-zinc-400 hover:text-white"}`}
      >
        <Icon size={16} weight={active ? "fill" : "regular"} />
        {label}
      </Link>
    );
  };

  return (
    <nav data-testid="main-nav" className="sticky top-0 z-30 backdrop-blur-xl bg-black/60 border-b border-white/5">
      <div className="max-w-7xl mx-auto px-4 sm:px-5 py-3 flex items-center gap-2">
        <Link to="/" data-testid="logo-home" className="flex items-center gap-2 mr-1 sm:mr-3 shrink-0">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-green-400 to-yellow-300 flex items-center justify-center text-black font-black">
            <DiceFive size={20} weight="fill" />
          </div>
          <span className="font-display text-base sm:text-lg font-bold tracking-tight">SCOREBOARD<span className="text-green-400">.</span></span>
        </Link>

        {/* desktop links */}
        <div className="hidden md:flex items-center gap-1 ml-2">
          {items.map((it) => <NavLink key={it.to} {...it} />)}
        </div>

        <div className="ml-auto flex items-center gap-2">
          {user && user.email ? (
            <>
              <span data-testid="user-email" className="text-xs text-zinc-400 hidden lg:block">{user.email}</span>
              <button data-testid="logout-btn" onClick={logout} className="btn-ghost px-3 py-2 rounded-lg text-sm flex items-center gap-2">
                <SignOut size={14} /> <span className="hidden sm:inline">Logout</span>
              </button>
            </>
          ) : (
            <Link to="/login" data-testid="nav-login" className="btn-primary px-3 sm:px-4 py-2 rounded-lg text-sm flex items-center gap-2 font-semibold">
              <SignIn size={14} weight="bold" /> <span className="hidden xs:inline">Admin Login</span><span className="xs:hidden">Login</span>
            </Link>
          )}
          <button
            data-testid="mobile-menu-btn"
            onClick={() => setOpen((o) => !o)}
            className="md:hidden btn-ghost px-2.5 py-2 rounded-lg"
            aria-label="Menu"
          >
            {open ? <X size={18} /> : <List size={18} />}
          </button>
        </div>
      </div>
      {open && (
        <div className="md:hidden border-t border-white/5 bg-black/80 backdrop-blur-xl">
          <div className="max-w-7xl mx-auto px-4 py-3 flex flex-col gap-1">
            {items.map((it) => <NavLink key={it.to} {...it} />)}
          </div>
        </div>
      )}
    </nav>
  );
}
