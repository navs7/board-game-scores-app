import React, { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { useAuth, formatApiErrorDetail } from "@/context/AuthContext";
import { motion } from "framer-motion";
import { DiceFive, Lock, Envelope, Warning } from "@phosphor-icons/react";

export default function Login() {
  const { login, register } = useAuth();
  const [mode, setMode] = useState("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);
  const nav = useNavigate();

  const submit = async (e) => {
    e.preventDefault();
    setErr("");
    setBusy(true);
    try {
      if (mode === "login") await login(email, password);
      else await register(email, password, name || email.split("@")[0]);
      nav("/admin");
    } catch (e) {
      setErr(formatApiErrorDetail(e.response?.data?.detail) || e.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="max-w-md mx-auto px-5 py-16">
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="card-surface p-8">
        <div className="flex items-center gap-3 mb-6">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-green-400 to-yellow-300 flex items-center justify-center">
            <DiceFive size={22} weight="fill" color="#000" />
          </div>
          <div>
            <h1 className="font-display text-2xl font-bold">{mode === "login" ? "Welcome back" : "Create account"}</h1>
            <p className="text-xs text-zinc-500">Admin access to start games</p>
          </div>
        </div>

        <form onSubmit={submit} className="space-y-4">
          {mode === "register" && (
            <div>
              <label className="label-eyebrow block mb-2">Name</label>
              <input data-testid="name-input" className="input" value={name} onChange={(e) => setName(e.target.value)} required />
            </div>
          )}
          <div>
            <label className="label-eyebrow block mb-2">Email</label>
            <div className="relative">
              <Envelope size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500" />
              <input data-testid="email-input" type="email" className="input pl-10" value={email} onChange={(e) => setEmail(e.target.value)} required />
            </div>
          </div>
          <div>
            <label className="label-eyebrow block mb-2">Password</label>
            <div className="relative">
              <Lock size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500" />
              <input data-testid="password-input" type="password" className="input pl-10" value={password} onChange={(e) => setPassword(e.target.value)} required minLength={6} />
            </div>
          </div>

          {err && (
            <div data-testid="auth-error" className="text-sm text-red-400 flex items-center gap-2 bg-red-500/10 border border-red-500/30 rounded-lg px-3 py-2">
              <Warning size={14} /> {err}
            </div>
          )}

          <button data-testid="submit-auth-btn" disabled={busy} type="submit" className="btn-primary w-full py-3 rounded-lg font-semibold disabled:opacity-50">
            {(() => {
              if (busy) return "Working…";
              return mode === "login" ? "Sign in" : "Create account";
            })()}
          </button>
        </form>

        <div className="mt-5 text-center text-sm text-zinc-500">
          {mode === "login" ? (
            <>New here? <button data-testid="toggle-register" className="text-green-400 hover:underline" onClick={() => setMode("register")}>Create account</button></>
          ) : (
            <>Already have one? <button data-testid="toggle-login" className="text-green-400 hover:underline" onClick={() => setMode("login")}>Sign in</button></>
          )}
        </div>

        <div className="mt-6 pt-6 border-t border-white/5 text-xs text-zinc-500 text-center">
          Default admin: <span className="font-mono-num text-zinc-300">admin@boardgame.app</span> / <span className="font-mono-num text-zinc-300">admin123</span>
        </div>

        <div className="mt-4 text-center">
          <Link to="/" className="text-xs text-zinc-500 hover:text-white">← Back to scoreboard</Link>
        </div>
      </motion.div>
    </div>
  );
}
