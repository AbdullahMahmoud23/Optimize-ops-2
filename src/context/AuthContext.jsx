import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { API_URL } from "../config";

const AuthContext = createContext(null);

const TOKEN_KEY = "auth_token";
const USER_KEY = "auth_user";
const TOKEN_LIFETIME_MS = 120 * 60 * 1000;
const REFRESH_BEFORE_EXPIRY_MS = 60 * 1000;

function getNowMs() {
  return Date.now();
}

function serializeSession(session) {
  return JSON.stringify(session);
}

function deserializeSession(text) {
  try {
    return JSON.parse(text);
  } catch (_) {
    return null;
  }
}

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [token, setToken] = useState(null);
  const [expiresAt, setExpiresAt] = useState(null);
  const refreshTimerRef = useRef(null);

  function scheduleRefresh(expMs) {
    clearTimeout(refreshTimerRef.current);
    const now = getNowMs();
    const timeout = Math.max(expMs - now - REFRESH_BEFORE_EXPIRY_MS, 0);
    refreshTimerRef.current = setTimeout(() => {
      refresh().catch(() => logout());
    }, timeout);
  }

  function persistSession(next) {
    if (!next) {
      localStorage.removeItem(TOKEN_KEY);
      localStorage.removeItem(USER_KEY);
      return;
    }
    localStorage.setItem(
      TOKEN_KEY,
      serializeSession({ token: next.token, expiresAt: next.expiresAt })
    );
    localStorage.setItem(USER_KEY, serializeSession(next.user));
  }

  async function loginWithEmail({ email, password }) {
    try {
      const res = await fetch(`${API_URL}/api/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });

      if (!res.ok) {
        const errData = await res.json();
        throw new Error(errData.error || "Login failed");
      }

      const data = await res.json();
      
      // Create session with backend data
      const session = {
        token: data.token,
        expiresAt: getNowMs() + TOKEN_LIFETIME_MS,
        user: {
          email: data.user?.email || email,
          role: data.role,
          id: data.user?.id
        },
      };

      setUser(session.user);
      setToken(session.token);
      setExpiresAt(session.expiresAt);
      persistSession(session);
      scheduleRefresh(session.expiresAt);

      return session.user;
    } catch (err) {
      console.error("Login error:", err);
      throw new Error(err.message || "Login failed");
    }
  }

  async function loginWithGoogle() {
    try {
      // Get the Google token from the window object (set by GoogleLogin component)
      const token = window.googleAuthToken;
      
      if (!token) {
        throw new Error("Google authentication failed. Please try again.");
      }

      const res = await fetch(`${API_URL}/api/auth/google`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token }),
      });

      if (!res.ok) {
        const errData = await res.json();
        throw new Error(errData.error || "Google login failed");
      }

      const data = await res.json();

      // Create session with backend data
      const session = {
        token: data.token,
        expiresAt: getNowMs() + TOKEN_LIFETIME_MS,
        user: {
          email: data.user?.email,
          role: data.role,
          id: data.user?.id,
          name: data.user?.name
        },
      };

      setUser(session.user);
      setToken(session.token);
      setExpiresAt(session.expiresAt);
      persistSession(session);
      scheduleRefresh(session.expiresAt);

      return session.user;
    } catch (err) {
      console.error("Google login error:", err);
      throw new Error(err.message || "Google login failed");
    }
  }

  // Keep login as alias for backward compatibility
  const login = loginWithEmail;

  function logout() {
    setUser(null);
    setToken(null);
    setExpiresAt(null);
    clearTimeout(refreshTimerRef.current);
    persistSession(null);
  }

  async function refresh() {
    if (!token || !expiresAt) {
      throw new Error("No session");
    }
    await new Promise((r) => setTimeout(r, 300));
    const exp = getNowMs() + TOKEN_LIFETIME_MS;
    setExpiresAt(exp);
    persistSession({ token, expiresAt: exp, user });
    scheduleRefresh(exp);
  }

  useEffect(() => {
    const tokenData = deserializeSession(localStorage.getItem(TOKEN_KEY));
    const savedUser = deserializeSession(localStorage.getItem(USER_KEY));
    if (tokenData?.token && tokenData?.expiresAt && savedUser) {
      if (tokenData.expiresAt > getNowMs()) {
        setToken(tokenData.token);
        setExpiresAt(tokenData.expiresAt);
        setUser(savedUser);
        scheduleRefresh(tokenData.expiresAt);
      } else {
        persistSession(null);
      }
    }
    return () => clearTimeout(refreshTimerRef.current);
  }, []);

  useEffect(() => {
    if (!expiresAt) return;
    const now = getNowMs();
    const msUntilExpiry = Math.max(expiresAt - now + 250, 0);
    const id = setTimeout(() => logout(), msUntilExpiry);
    return () => clearTimeout(id);
  }, [expiresAt]);

  const isAuthenticated = !!token && !!user && (expiresAt ?? 0) > getNowMs();
  const role = user?.role || null;

  const value = useMemo(
    () => ({
      user,
      role,
      token,
      expiresAt,
      isAuthenticated,
      login,
      loginWithEmail,
      loginWithGoogle,
      logout,
      refresh,
    }),
    [user, role, token, expiresAt, isAuthenticated]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}