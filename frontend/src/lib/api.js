import axios from "axios";

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
export const API = `${BACKEND_URL}/api`;

// Token is also issued as httpOnly cookie by the backend; this in-memory
// fallback is used only when 3rd-party cookies are blocked (e.g. preview
// environments where the API runs on a different subdomain). It is kept
// in memory + sessionStorage (cleared on tab close) to limit XSS exposure.
const TOKEN_KEY = "bgs_token";

let _token = null;
try { _token = sessionStorage.getItem(TOKEN_KEY); } catch (e) {
  console.warn("[api] sessionStorage unavailable:", e?.message);
}

export function getToken() { return _token; }
export function setToken(t) {
  _token = t || null;
  try {
    if (t) sessionStorage.setItem(TOKEN_KEY, t);
    else sessionStorage.removeItem(TOKEN_KEY);
  } catch (e) {
    console.warn("[api] sessionStorage write failed:", e?.message);
  }
}

export const api = axios.create({
  baseURL: API,
  // withCredentials disabled: ingress CORS uses wildcard `*` which conflicts
  // with credentialed XHR. Auth uses JWT Bearer header instead.
  withCredentials: false,
});

api.interceptors.request.use((config) => {
  const t = getToken();
  if (t) config.headers.Authorization = `Bearer ${t}`;
  return config;
});

export function wsUrl() {
  const u = new URL(BACKEND_URL);
  const proto = u.protocol === "https:" ? "wss:" : "ws:";
  return `${proto}//${u.host}/api/ws`;
}
