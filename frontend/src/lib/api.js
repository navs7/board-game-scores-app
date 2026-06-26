import axios from "axios";

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
export const API = `${BACKEND_URL}/api`;

/**
 * Token storage strategy
 * ----------------------
 * Primary mechanism: JWT issued in `Authorization: Bearer` header.
 *
 * The backend ALSO sets `access_token` / `refresh_token` as httpOnly cookies
 * which would be the more secure transport — however, the K8s ingress
 * forces `Access-Control-Allow-Origin: *` which forbids credentialed XHR.
 * Until that infra constraint changes, this app cannot use cookie auth
 * across origins and must use Bearer tokens.
 *
 * Tokens live in BOTH:
 *   - in-memory module variable (`_token`) — the primary read path
 *   - sessionStorage — only as a survive-page-reload mechanism. Cleared on
 *     tab close, so the persistence window is smaller than localStorage.
 *
 * XSS mitigation rests on the app's standard React escaping + CSP layer;
 * this is not an environment that calls `dangerouslySetInnerHTML` with
 * untrusted input.
 */
const TOKEN_KEY = "bgs_token";

let _token = null;
try {
  _token = sessionStorage.getItem(TOKEN_KEY);
} catch (e) {
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
